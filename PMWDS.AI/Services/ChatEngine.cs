using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PMWDS.Application.Common;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Infrastructure.Settings;
using PMWDS.Persistence.Context;

namespace PMWDS.AI.Services;

public interface IChatEngine
{
    Task<ChatResponseDto> ProcessAsync(
        string userId,
        string message,
        string contextDossier,
        string? provider = null,
        string? model = null,
        CancellationToken ct = default);

    Task<string> GenerateSummaryAsync(
        string context,
        string? provider = null,
        string? model = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<AIProviderInfoDto>> GetProvidersAsync(
        CancellationToken ct = default);

    Task<IReadOnlyList<AIModelInfoDto>> SearchModelsAsync(
        string provider,
        string? search = null,
        int limit = 25,
        CancellationToken ct = default);

    Task<AIProviderTestResultDto> TestProviderAsync(
        string provider,
        string? model = null,
        string? prompt = null,
        CancellationToken ct = default);

    Task<bool> IsConfiguredAsync(string? provider = null, CancellationToken ct = default);

    Task<string> GenerateStructuredReportAsync(
        string systemPrompt,
        string userContext,
        CancellationToken ct = default);
}

public class OpenAICompatibleChatEngine : IChatEngine
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;
    private readonly AISettings _settings;
    private readonly IUnitOfWork _uow;
    private readonly ApplicationDbContext _db;
    private readonly ISensitiveDataProtector _sensitiveData;
    private readonly ILogger<OpenAICompatibleChatEngine> _logger;

    // In-memory session history (production: use Redis)
    private static readonly ConcurrentDictionary<string, List<ChatMessagePayload>> Sessions = new();

    // Cached global DB defaults (refreshed per-resolve)
    private string? _globalDefaultProvider;
    private string? _globalDefaultModel;

    private static bool IsOpenRouterModel(string model)
        => model.Contains('/', StringComparison.Ordinal);

    private static bool IsOpenAiModel(string model)
        => !model.Contains('/', StringComparison.Ordinal);

    public OpenAICompatibleChatEngine(
        HttpClient httpClient,
        IOptions<AISettings> settings,
        IUnitOfWork uow,
        ApplicationDbContext db,
        ISensitiveDataProtector sensitiveData,
        ILogger<OpenAICompatibleChatEngine> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _uow = uow;
        _db = db;
        _sensitiveData = sensitiveData;
        _logger = logger;
    }

    public async Task<bool> IsConfiguredAsync(string? provider = null, CancellationToken ct = default)
    {
        try
        {
            // Resolve through the database so credentials saved from the Settings
            // page are honoured, not just environment configuration.
            return IsUsableProvider(await ResolveProviderAsync(provider, ct));
        }
        catch
        {
            return false;
        }
    }

    private static bool IsUsableProvider(ResolvedProviderConfig config)
        => config.Enabled &&
           !string.IsNullOrWhiteSpace(config.BaseUrl) &&
           !string.IsNullOrWhiteSpace(config.ApiKey) &&
           OutboundUrlGuard.IsAllowedAiProviderBaseUrl(config.ProviderId, config.BaseUrl, out _);

    public async Task<IReadOnlyList<AIProviderInfoDto>> GetProvidersAsync(
        CancellationToken ct = default)
    {
        var openAi = await ResolveProviderAsync("OpenAI", ct);
        var openRouter = await ResolveProviderAsync("OpenRouter", ct);
        IReadOnlyList<AIProviderInfoDto> providers =
        [
            BuildProviderInfo("OpenAI", "OpenAI", openAi),
            BuildProviderInfo("OpenRouter", "OpenRouter", openRouter)
        ];

        return providers;
    }

    public async Task<IReadOnlyList<AIModelInfoDto>> SearchModelsAsync(
        string provider,
        string? search = null,
        int limit = 25,
        CancellationToken ct = default)
    {
        var config = await ResolveProviderAsync(provider, ct);
        var response = await SendAsync(
            HttpMethod.Get,
            config,
            CombineUrl(config.BaseUrl, config.ModelsPath),
            body: null,
            ct);

        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var payload = await JsonSerializer.DeserializeAsync<ModelListResponse>(stream, JsonOptions, ct)
            ?? new ModelListResponse();

        return payload.Data
            .Where(m => !string.IsNullOrWhiteSpace(m.Id))
            .Where(m => string.IsNullOrWhiteSpace(search) ||
                        m.Id.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        (m.Name?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false))
            .Take(Math.Clamp(limit, 1, 100))
            .Select(m => new AIModelInfoDto(
                Provider: provider,
                Id: m.Id,
                Name: string.IsNullOrWhiteSpace(m.Name) ? m.Id : m.Name,
                ContextLength: m.ContextLength,
                Description: m.Description))
            .ToList();
    }

    public async Task<AIProviderTestResultDto> TestProviderAsync(
        string provider,
        string? model = null,
        string? prompt = null,
        CancellationToken ct = default)
    {
        var resolvedProvider = await ResolveProviderAsync(provider, ct);
        var resolvedModel = ResolveModel(resolvedProvider, model, !string.IsNullOrWhiteSpace(provider));
        var testPrompt = string.IsNullOrWhiteSpace(prompt)
            ? "Reply with exactly: provider test ok"
            : prompt;

        try
        {
            var completion = await CompleteChatAsync(
                resolvedProvider,
                resolvedModel,
                [
                    new ChatMessagePayload("system", "You are a concise test assistant."),
                    new ChatMessagePayload("user", testPrompt)
                ],
                ct);

            return new AIProviderTestResultDto(
                Provider: provider,
                // Report the model that actually answered, not the one requested, so
                // a test that silently fell back does not read as a pass on the
                // primary model.
                Model: completion.Model,
                Success: true,
                Message: completion.UsedFallback
                    ? $"Provider call succeeded on the fallback model (the requested model was rate limited)."
                    : "Provider call succeeded.",
                RawResponse: completion.Content,
                ExecutedAtUtc: DateTime.UtcNow);
        }
        catch (Exception ex)
        {
            return new AIProviderTestResultDto(
                Provider: provider,
                Model: resolvedModel,
                Success: false,
                Message: ex.Message,
                RawResponse: null,
                ExecutedAtUtc: DateTime.UtcNow);
        }
    }

    /// <summary>
    /// The standing instructions for the assistant.
    ///
    /// The rule that matters is the first one. The previous prompt said only "You are
    /// PMWDS AI Assistant, a concise project monitoring expert", and when the context
    /// block was empty the model had no way to tell the difference between "this user
    /// has no data" and "I was not given any data". It consistently chose the reading
    /// that produced the unhelpful answer users reported: "I don't have access to your
    /// organization's specific project data or database", followed by a menu of things
    /// it could do instead - connect Jira, upload a CSV, define what a project is. All
    /// of that advice was wrong, because the data was one section away and attached.
    ///
    /// So the prompt now states plainly that the dossier is the authoritative and
    /// complete source for this conversation, and that a question outside it is a
    /// genuine limit rather than an invitation to offer a substitute workflow.
    /// </summary>
    private static string BuildSystemPrompt()
        => """
           You are the PMWDS AI Assistant. You answer questions about the projects, tasks,
           subtasks, milestones, people and documents of one organisation, using the data
           dossier supplied with each question.

           How to use the dossier:

           - The dossier IS the data. It has already been filtered to what the person asking
             is allowed to see under their role. Never ask them to provide, connect, upload or
             export project data - they already have it and you already have it.
           - Never say you lack access to their project data, that you are not connected to a
             database, or that you would need a CSV, JSON export or integration (Jira, Asana,
           Monday.com, MS Project) to answer. That answer is always wrong here and was the
             single most common failure of this assistant.
           - If a question asks about something outside the dossier, say which part of the data
             you were given does not cover it, and answer everything in the question that you
             can. Do not offer an alternative workflow in place of an answer.
           - If the dossier says the user has 0 visible projects, tell them that plainly and
             explain that it depends on their role. Do not speculate about what they might have.
           - Quote real names, dates, numbers and statuses from the dossier. Never invent a
             project, person, figure or date, and never present a guess as a fact.

           How to answer:

           - Lead with the answer. Put the conclusion in the first sentence, then the detail.
           - Be specific and quantitative: "3 of 6 projects are behind schedule", not "several
             projects have issues".
           - Short markdown is fine - a few bullet points or a small table. Do not pad.
           - Do not open by restating the question or by describing what you are about to do.
           - If the dossier marks a section as partial or truncated, say your answer is based
             on a partial view rather than implying you saw everything.
           """;

    public async Task<ChatResponseDto> ProcessAsync(
        string userId,
        string message,
        string contextDossier,
        string? provider = null,
        string? model = null,
        CancellationToken ct = default)
    {
        var session = Sessions.GetOrAdd(userId, _ =>
            [
                new ChatMessagePayload("system", BuildSystemPrompt())
            ]);

        var intent = ChatIntents.Detect(message);

        List<ChatMessagePayload> requestMessages;
        lock (session)
        {
            session.Add(new ChatMessagePayload("user", message));

            // The dossier is attached per turn rather than stored in the session.
            //
            // Storing it was the old behaviour and it was wrong twice over: it made the
            // session grow by a full copy of the project data on every question until the
            // trim cut it, and every question in a session then saw the union of every
            // earlier question's data, which is both expensive and stale - the answer to
            // "what changed since yesterday" would be answered from yesterday's numbers.
            session.Add(new ChatMessagePayload(
                "system",
                $"DATA DOSSIER for this question (authoritative, already role-scoped):\n{contextDossier}"));

            requestMessages = session.ToList();
        }

        var resolvedProvider = await ResolveProviderAsync(provider, ct);
        var resolvedModel = ResolveModel(resolvedProvider, model, !string.IsNullOrWhiteSpace(provider));
        var completion = await CompleteChatAsync(resolvedProvider, resolvedModel, requestMessages, ct);

        lock (session)
        {
            session.Add(new ChatMessagePayload("assistant", completion.Content));

            // Trim the oldest turns, but always keep the standing instructions at
            // the front. Without them a long session degrades into the old
            // instruction-free behaviour and starts refusing to answer.
            const int keepSystem = 1;
            if (session.Count > 16)
            {
                var trimmed = session
                    .Take(keepSystem)
                    .Concat(session.TakeLast(14))
                    .ToList();
                session.Clear();
                session.AddRange(trimmed);
            }
        }

        return new ChatResponseDto(
            Message: completion.Content,
            Intent: intent,
            SuggestedActions: ChatIntents.SuggestedActions(intent),
            ContextData: new
            {
                dossierCharacters = contextDossier.Length,
                modelUsed = completion.Model,
                // Surfaced so the UI can say which model answered. Silently swapping
                // models would leave the reader believing a 550B model produced the
                // answer when a random free model did.
                usedFallbackModel = completion.UsedFallback
            },
            RequiresConfirmation: ChatIntents.NeedsConfirmation(intent));
    }

    public async Task<string> GenerateSummaryAsync(
        string context,
        string? provider = null,
        string? model = null,
        CancellationToken ct = default)
    {
        if (!await IsConfiguredAsync(provider, ct))
        {
            return "AI summary not available.";
        }

        var resolvedProvider = await ResolveProviderAsync(provider, ct);
        var resolvedModel = ResolveModel(resolvedProvider, model, !string.IsNullOrWhiteSpace(provider));

        return (await CompleteChatAsync(
            resolvedProvider,
            resolvedModel,
            [
                new ChatMessagePayload(
                    "system",
                    "You are a concise project management analyst. Generate a brief 2-3 sentence summary."),
                new ChatMessagePayload("user", context)
            ],
            ct)).Content;
    }

    public async Task<string> GenerateStructuredReportAsync(
        string systemPrompt,
        string userContext,
        CancellationToken ct = default)
    {
        if (!await IsConfiguredAsync(null, ct))
        {
            throw new InvalidOperationException(
                "AI provider is not configured. Please configure AI settings first.");
        }

        var resolvedProvider = await ResolveProviderAsync(null, ct);
        var resolvedModel = ResolveModel(resolvedProvider, null, false);

        return (await CompleteChatAsync(
            resolvedProvider,
            resolvedModel,
            [
                new ChatMessagePayload("system", systemPrompt),
                new ChatMessagePayload("user", userContext)
            ],
            ct)).Content;
    }

    /// <summary>
    /// Runs a completion, retrying once on the fallback model if the primary is rate
    /// limited.
    ///
    /// The result carries which model actually answered rather than keeping it in a
    /// field. The engine is registered as a transient, so instance state would
    /// appear to work and then leak between concurrent requests - one caller could
    /// be told it used the fallback because a different caller triggered it.
    /// </summary>
    private async Task<Completion> CompleteChatAsync(
        ResolvedProviderConfig provider,
        string model,
        IReadOnlyList<ChatMessagePayload> messages,
        CancellationToken ct)
    {
        try
        {
            return new Completion(
                await CompleteChatOnceAsync(provider, model, messages, ct), model, false);
        }
        catch (AiProviderException failure) when (ShouldRetryOnFallback(provider, model, failure))
        {
            var fallback = _settings.RateLimitFallbackModel.Trim();

            // Logged at Information, not Error. Being rate limited is the documented
            // behaviour of the free tier, not a fault, and an operator watching for
            // errors should not have to distinguish this from a real one.
            _logger.LogInformation(
                "Model {Model} is rate limited on {Provider}; retrying once on {Fallback}.",
                model,
                provider.ProviderId,
                fallback);

            try
            {
                var content = await CompleteChatOnceAsync(provider, fallback, messages, ct);
                return new Completion(content, fallback, true);
            }
            catch (AiProviderException fallbackFailure)
            {
                // The fallback is rate limited too. Report that rather than the
                // original, because it is the more recent and more accurate
                // account-level fact: the whole key has no quota left, not just
                // one model.
                throw new AiProviderException(
                    $"{provider.ProviderId} has rate limited this account on both " +
                    $"'{model}' and the fallback '{fallback}', so it cannot answer right now. " +
                    "This is a quota limit on the provider, not a problem with your data. " +
                    $"Provider said: {fallbackFailure.Message}",
                    "rate_limited",
                    fallbackFailure,
                    429);
            }
        }
    }

    private sealed record Completion(string Content, string Model, bool UsedFallback);

    /// <summary>
    /// Whether a failed call should be retried on the fallback model.
    ///
    /// Narrow on purpose. Only a 429 qualifies: retrying a 401 (bad key) or a 404
    /// (unknown model) on a different model cannot succeed, and retrying those would
    /// double the latency of a failure that is already correctly diagnosed.
    ///
    /// Also OpenRouter only, because the fallback is an OpenRouter model id. Asking
    /// OpenAI for "openrouter/free" returns a 404 and turns one clear error into two.
    /// </summary>
    private bool ShouldRetryOnFallback(
        ResolvedProviderConfig provider,
        string model,
        AiProviderException failure)
    {
        if (!_settings.EnableRateLimitFallback ||
            failure.UpstreamStatusCode != 429 ||
            !provider.ProviderId.Equals("OpenRouter", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var fallback = _settings.RateLimitFallbackModel?.Trim();

        return !string.IsNullOrWhiteSpace(fallback)
            && !string.IsNullOrWhiteSpace(model)
            && !model.Equals(fallback, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<string> CompleteChatOnceAsync(
        ResolvedProviderConfig provider,
        string model,
        IReadOnlyList<ChatMessagePayload> messages,
        CancellationToken ct)
    {
        var body = new ChatCompletionRequest(
            model,
            messages,
            Stream: false,
            MaxTokens: _settings.MaxOutputTokens > 0 ? _settings.MaxOutputTokens : null);
        var response = await SendAsync(
            HttpMethod.Post,
            provider,
            CombineUrl(provider.BaseUrl, "/chat/completions"),
            body,
            ct);

        var responseText = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw ProviderFailure(provider.ProviderId, response.StatusCode, responseText);
        }

        var content = ExtractAssistantText(responseText);

        // Do not return a prose placeholder here. Callers parse the result as JSON, so a sentence
        // like "The provider returned an empty response." surfaces as
        // "'T' is an invalid start of a value", which hides the real cause. Reasoning models can
        // return an empty content field when reasoning consumes the whole token budget, so throw
        // with the reason attached and let the caller degrade with a meaningful message.
        if (string.IsNullOrWhiteSpace(content))
        {
            var finishReason = TryGetFinishReason(responseText) ?? "unknown";
            var reasoningLength = TryGetReasoningLength(responseText);
            throw new InvalidOperationException(
                $"Provider '{provider.ProviderId}' returned no content (finish_reason={finishReason}" +
                (reasoningLength is { } len ? $", reasoning tokens produced {len} characters" : "") +
                "). For a reasoning model this usually means the token budget was consumed before the " +
                "answer was written. Increase AI:MaxOutputTokens or switch to a non-reasoning model.");
        }

        return content.Trim();
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method,
        ResolvedProviderConfig provider,
        string url,
        object? body,
        CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (!string.IsNullOrWhiteSpace(provider.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", provider.ApiKey);
        }

        foreach (var header in provider.Headers)
        {
            request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        if (body != null)
        {
            request.Content = JsonContent.Create(body, options: JsonOptions);
        }

        return await _httpClient.SendAsync(request, ct);
    }

    private async Task<ResolvedProviderConfig> ResolveProviderAsync(string? provider, CancellationToken ct)
    {
        var global = await _db.AIGlobalSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        _globalDefaultProvider = global?.DefaultProvider;
        _globalDefaultModel = global?.DefaultModel;

        var effectiveProvider = provider;
        if (string.IsNullOrWhiteSpace(effectiveProvider) && !string.IsNullOrWhiteSpace(_globalDefaultProvider))
        {
            effectiveProvider = _globalDefaultProvider;
        }

        var environmentProvider = ResolveEnvironmentProvider(effectiveProvider);
        var stored = await _db.AIProviderCredentials
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Provider == environmentProvider.ProviderId, ct);

        if (stored == null)
        {
            EnsureAllowedProviderUrl(environmentProvider);
            return environmentProvider;
        }

        var storedApiKey = _sensitiveData.Unprotect(stored.ApiKey);

        var resolved = stored.UseEnvironmentDefault
            ? environmentProvider with
            {
                Enabled = stored.Enabled,
                BaseUrl = string.IsNullOrWhiteSpace(stored.BaseUrl) ? environmentProvider.BaseUrl : stored.BaseUrl,
                DefaultModel = string.IsNullOrWhiteSpace(stored.DefaultModel) ? environmentProvider.DefaultModel : stored.DefaultModel
            }
            : environmentProvider with
            {
                Enabled = stored.Enabled,
                ApiKey = string.IsNullOrWhiteSpace(storedApiKey) ? environmentProvider.ApiKey : storedApiKey,
                BaseUrl = string.IsNullOrWhiteSpace(stored.BaseUrl) ? environmentProvider.BaseUrl : stored.BaseUrl,
                DefaultModel = string.IsNullOrWhiteSpace(stored.DefaultModel) ? environmentProvider.DefaultModel : stored.DefaultModel
            };
        EnsureAllowedProviderUrl(resolved);
        return resolved;
    }

    private ResolvedProviderConfig ResolveEnvironmentProvider(string? provider)
    {
        var providerId = string.IsNullOrWhiteSpace(provider)
            ? _settings.DefaultProvider
            : provider;

        if (providerId.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
        {
            var options = _settings.OpenAI ?? new AIProviderOptions();
            return new ResolvedProviderConfig(
                ProviderId: "OpenAI",
                Enabled: options.Enabled,
                ApiKey: string.IsNullOrWhiteSpace(options.ApiKey) ? _settings.OpenAIApiKey : options.ApiKey,
                BaseUrl: string.IsNullOrWhiteSpace(options.BaseUrl) ? "https://api.openai.com/v1" : options.BaseUrl,
                DefaultModel: string.IsNullOrWhiteSpace(options.DefaultModel) ? _settings.OpenAIModel : options.DefaultModel,
                ModelsPath: string.IsNullOrWhiteSpace(options.ModelsPath) ? "/models" : options.ModelsPath,
                Headers: new Dictionary<string, string>(options.Headers, StringComparer.OrdinalIgnoreCase));
        }

        if (providerId.Equals("OpenRouter", StringComparison.OrdinalIgnoreCase))
        {
            var options = _settings.OpenRouter ?? new AIProviderOptions();
            var headers = new Dictionary<string, string>(options.Headers, StringComparer.OrdinalIgnoreCase);
            if (!headers.ContainsKey("HTTP-Referer"))
            {
                headers["HTTP-Referer"] = _settings.AppUrl;
            }

            if (!headers.ContainsKey("X-OpenRouter-Title"))
            {
                headers["X-OpenRouter-Title"] = _settings.AppName;
            }

            return new ResolvedProviderConfig(
                ProviderId: "OpenRouter",
                Enabled: options.Enabled,
                ApiKey: options.ApiKey,
                BaseUrl: string.IsNullOrWhiteSpace(options.BaseUrl) ? "https://openrouter.ai/api/v1" : options.BaseUrl,
                DefaultModel: options.DefaultModel,
                ModelsPath: string.IsNullOrWhiteSpace(options.ModelsPath) ? "/models" : options.ModelsPath,
                Headers: headers);
        }

        throw new InvalidOperationException($"Unsupported AI provider '{providerId}'.");
    }

    private string ResolveModel(
        ResolvedProviderConfig provider,
        string? requestedModel,
        bool providerExplicitlySelected)
    {
        if (!string.IsNullOrWhiteSpace(requestedModel))
        {
            return requestedModel;
        }

        if (providerExplicitlySelected && !string.IsNullOrWhiteSpace(provider.DefaultModel))
        {
            return provider.DefaultModel;
        }

        // The global default model is only valid for the provider it belongs to.
        // Reusing an OpenAI model id against OpenRouter (or vice versa) makes the
        // provider reject the request, so fall back to the provider's own default.
        var globalDefault = !string.IsNullOrWhiteSpace(_globalDefaultModel)
            ? _globalDefaultModel
            : _settings.DefaultModel;

        if (!string.IsNullOrWhiteSpace(globalDefault) && ModelBelongsToProvider(globalDefault, provider.ProviderId))
        {
            return globalDefault;
        }

        if (!string.IsNullOrWhiteSpace(provider.DefaultModel))
        {
            return provider.DefaultModel;
        }

        throw new InvalidOperationException(
            $"No default model is configured for provider '{provider.ProviderId}'.");
    }

    private static bool ModelBelongsToProvider(string model, string providerId)
        => providerId.Equals("OpenRouter", StringComparison.OrdinalIgnoreCase)
            ? IsOpenRouterModel(model)
            : providerId.Equals("OpenAI", StringComparison.OrdinalIgnoreCase)
                ? IsOpenAiModel(model)
                : true;

    // Intent detection and context assembly used to live here. Both moved:
    // detection to ChatIntents in Application, because the API layer needs the same
    // verdict to decide which data to fetch, and context assembly to
    // ChatContextBuilder in the API layer, because role scoping belongs with
    // RoleScopeService rather than being reimplemented here.
    //
    // The context builder that was here fetched five rows of one entity type and
    // returned null for every other intent, which is why "tell me about all the
    // projects" reached the model with no data at all.

    private static AIProviderInfoDto BuildProviderInfo(
        string provider,
        string displayName,
        ResolvedProviderConfig config)
        => new(
            Provider: provider,
            DisplayName: displayName,
            IsEnabled: config.Enabled,
            IsConfigured: config.Enabled &&
                         !string.IsNullOrWhiteSpace(config.ApiKey) &&
                         !string.IsNullOrWhiteSpace(config.BaseUrl),
            DefaultModel: config.DefaultModel,
            BaseUrl: config.BaseUrl);

    private static string CombineUrl(string baseUrl, string path)
        => $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";

    private static void EnsureAllowedProviderUrl(ResolvedProviderConfig provider)
    {
        if (!OutboundUrlGuard.IsAllowedAiProviderBaseUrl(provider.ProviderId, provider.BaseUrl, out var error))
        {
            throw new InvalidOperationException(error);
        }
    }

    /// <summary>Reads choices[0].finish_reason for diagnostics. Returns null if absent.</summary>
    /// <summary>
    /// Turns a non-success provider response into an exception that says what to do.
    ///
    /// This used to be a bare InvalidOperationException, which the middleware mapped
    /// to 500 "An unexpected error occurred." So a provider that had run out of quota
    /// for the day looked identical to a bug in this application: same status, same
    /// useless message. Users retrying a rate limit and users with a bad API key need
    /// different things, so the common cases get named.
    /// </summary>
    private static AiProviderException ProviderFailure(
        string providerId,
        System.Net.HttpStatusCode status,
        string responseText)
    {
        var statusCode = (int)status;
        var detail = SummariseProviderError(responseText);

        var reason = statusCode switch
        {
            401 or 403 =>
                "authentication",
            429 =>
                "rate_limited",
            404 =>
                "model_not_found",
            _ =>
                "provider_error"
        };

        var message = statusCode switch
        {
            429 =>
                $"{providerId} has rate limited this account and cannot answer right now. " +
                "This is a quota limit on the provider, not a problem with your data. " +
                (detail is null ? "Try again later." : $"Provider said: {detail}"),

            401 or 403 =>
                $"{providerId} rejected the API key. Check the key under AI Settings. " +
                (detail is null ? string.Empty : $"Provider said: {detail}"),

            404 =>
                $"{providerId} does not recognise the selected model. " +
                "Pick a different model under AI Settings. " +
                (detail is null ? string.Empty : $"Provider said: {detail}"),

            _ =>
                $"{providerId} returned {statusCode}. " +
                (detail is null ? string.Empty : $"Provider said: {detail}")
        };

        return new AiProviderException(message.TrimEnd(), reason, null, statusCode);
    }

    /// <summary>
    /// Pulls the provider's own error message out of the response body.
    ///
    /// The body is JSON like {"error":{"message":"...","code":429}}. Returning the
    /// raw body would put hundreds of characters of headers and metadata in front of
    /// the user, so extract the message and fall back to null when it is not there.
    /// </summary>
    private static string? SummariseProviderError(string responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(responseText);
            if (document.RootElement.TryGetProperty("error", out var error))
            {
                if (error.ValueKind == JsonValueKind.String)
                {
                    return Truncate(error.GetString());
                }

                if (error.ValueKind == JsonValueKind.Object &&
                    error.TryGetProperty("message", out var message))
                {
                    return Truncate(message.GetString());
                }
            }
        }
        catch
        {
            // A non-JSON body is unusual; the status code still carries the meaning.
        }

        return Truncate(responseText);
    }

    private static string? Truncate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= 300 ? trimmed : trimmed[..300] + "...";
    }

    private static string? TryGetFinishReason(string responseText)
    {
        try
        {
            using var document = JsonDocument.Parse(responseText);
            if (document.RootElement.TryGetProperty("choices", out var choices) &&
                choices.ValueKind == JsonValueKind.Array &&
                choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("finish_reason", out var reason))
            {
                return reason.GetString();
            }
        }
        catch
        {
            // Diagnostics only; never let this mask the original failure.
        }

        return null;
    }

    /// <summary>Length of the reasoning field, used to explain empty completions.</summary>
    private static int? TryGetReasoningLength(string responseText)
    {
        try
        {
            using var document = JsonDocument.Parse(responseText);
            if (document.RootElement.TryGetProperty("choices", out var choices) &&
                choices.ValueKind == JsonValueKind.Array &&
                choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("message", out var message) &&
                message.TryGetProperty("reasoning", out var reasoning) &&
                reasoning.ValueKind == JsonValueKind.String)
            {
                return reasoning.GetString()?.Length;
            }
        }
        catch
        {
            // Diagnostics only.
        }

        return null;
    }

    private static string? ExtractAssistantText(string responseText)
    {
        using var document = JsonDocument.Parse(responseText);
        if (!document.RootElement.TryGetProperty("choices", out var choices) ||
            choices.ValueKind != JsonValueKind.Array ||
            choices.GetArrayLength() == 0)
        {
            return null;
        }

        var choice = choices[0];
        if (!choice.TryGetProperty("message", out var message))
        {
            return null;
        }

        if (!message.TryGetProperty("content", out var content))
        {
            return null;
        }

        if (content.ValueKind == JsonValueKind.String)
        {
            return content.GetString();
        }

        if (content.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var part in content.EnumerateArray())
        {
            if (part.TryGetProperty("type", out var type) &&
                type.GetString() == "text" &&
                part.TryGetProperty("text", out var text))
            {
                return text.GetString();
            }
        }

        return null;
    }

    private sealed record ResolvedProviderConfig(
        string ProviderId,
        bool Enabled,
        string ApiKey,
        string BaseUrl,
        string DefaultModel,
        string ModelsPath,
        Dictionary<string, string> Headers);

    private sealed record ChatCompletionRequest(
        string Model,
        IReadOnlyList<ChatMessagePayload> Messages,
        bool Stream,
        [property: JsonPropertyName("max_tokens")] int? MaxTokens = null);

    private sealed record ChatMessagePayload(
        string Role,
        string Content);

    private sealed class ModelListResponse
    {
        [JsonPropertyName("data")]
        public List<ModelPayload> Data { get; set; } = [];
    }

    private sealed class ModelPayload
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("context_length")]
        public int? ContextLength { get; set; }
    }
}
