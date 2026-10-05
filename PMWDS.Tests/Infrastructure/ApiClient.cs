using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace PMWDS.Tests.Infrastructure;

/// <summary>
/// Thin typed wrapper over <see cref="HttpClient"/> that understands the API's response
/// envelope.
/// </summary>
/// <remarks>
/// Every response is wrapped as
/// <c>{ success, data, error, traceId, timestamp }</c> by <c>ApiResponseEnvelopeFilter</c>,
/// so tests assert against <c>data</c>. Failures carry <c>error.code</c> and, for validation
/// problems, <c>error.details</c> keyed by field name.
/// </remarks>
public sealed class ApiClient : IDisposable
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly bool _ownsClient;

    public ApiClient(HttpClient http, bool ownsClient = false)
    {
        _http = http;
        _ownsClient = ownsClient;
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    /// <summary>Bearer token for the authenticated session, if any.</summary>
    public string? Token { get; private set; }

    public Uri BaseAddress => _http.BaseAddress!;

    public void UseToken(string? token)
    {
        Token = token;
        _http.DefaultRequestHeaders.Authorization = token is null
            ? null
            : new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<Result<T>> GetAsync<T>(string path, object? query = null)
        => await SendAsync<T>(() => BuildRequest(HttpMethod.Get, path, query));

    public async Task<Result<T>> PostAsync<T>(string path, object? body = null)
        => await SendAsync<T>(() => BuildRequest(HttpMethod.Post, path, body));

    public async Task<Result<T>> PutAsync<T>(string path, object? body = null)
        => await SendAsync<T>(() => BuildRequest(HttpMethod.Put, path, body));

    public async Task<Result<T>> PatchAsync<T>(string path, object? body = null)
        => await SendAsync<T>(() => BuildRequest(HttpMethod.Patch, path, body));

    public async Task<Result<T>> DeleteAsync<T>(string path, object? query = null)
        => await SendAsync<T>(() => BuildRequest(HttpMethod.Delete, path, query));

    /// <summary>Multipart upload. Field names must match the controller's parameters.</summary>
    public async Task<Result<T>> PostFormAsync<T>(string path, MultipartFormDataContent form)
        => await SendAsync<T>(() =>
        {
            var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = form };
            return request;
        });

    /// <summary>Raw call that returns the response for binary content such as downloads.</summary>
    public async Task<HttpResponseMessage> DownloadAsync(string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, BuildUrl(path, null));
        return await _http.SendAsync(request);
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path, object? body)
    {
        var url = BuildUrl(path, body as QueryParameters);
        var request = new HttpRequestMessage(method, url);

        // A dictionary sent to a GET/DELETE is a query string, not a body.
        if (body is not null && body is not QueryParameters)
        {
            if (method == HttpMethod.Get || method == HttpMethod.Delete)
            {
                var query = QueryParameters.From(body);
                var withQuery = BuildUrl(path, query);
                request.RequestUri = new Uri(withQuery, UriKind.Relative);
            }
            else
            {
                request.Content = JsonContent.Create(body, options: Json);
            }
        }

        return request;
    }

    private string BuildUrl(string path, QueryParameters? query)
    {
        var relative = path.StartsWith('/') ? path : "/" + path;
        return query is { Count: > 0 }
            ? $"{relative}?{query.ToQueryString()}"
            : relative;
    }

    private async Task<Result<T>> SendAsync<T>(Func<HttpRequestMessage> build)
    {
        using var request = build();
        using var response = await _http.SendAsync(request);

        var payload = await response.Content.ReadAsStringAsync();
        return Result<T>.From(response.StatusCode, payload);
    }

    public void Dispose()
    {
        if (_ownsClient)
        {
            _http.Dispose();
        }
    }
}

/// <summary>Ordered query parameters; skips null/empty values like the React client does.</summary>
public sealed class QueryParameters : List<KeyValuePair<string, string>>
{
    public static QueryParameters From(object? source)
    {
        var parameters = new QueryParameters();
        if (source is null)
        {
            return parameters;
        }

        foreach (var property in source.GetType().GetProperties())
        {
            var value = property.GetValue(source);
            if (value is null)
            {
                continue;
            }

            var text = value is bool flag ? flag.ToString().ToLowerInvariant() : value.ToString();
            if (string.IsNullOrEmpty(text))
            {
                continue;
            }

            parameters.Add(new KeyValuePair<string, string>(property.Name, text!));
        }

        return parameters;
    }

    public string ToQueryString()
        => string.Join("&", this.Select(p =>
            $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value)}"));
}

/// <summary>Outcome of one API call: status code plus the unwrapped payload or error.</summary>
public sealed record Result<T>(
    HttpStatusCode Status,
    T? Data,
    string? ErrorCode,
    string? ErrorMessage,
    IReadOnlyDictionary<string, string[]>? ErrorDetails,
    string RawBody)
{
    public bool IsSuccess => (int)Status is >= 200 and < 300;

    public static Result<T> From(HttpStatusCode status, string body)
    {
        T? data = default;
        string? code = null;
        string? message = null;
        IReadOnlyDictionary<string, string[]>? details = null;

        if (!string.IsNullOrWhiteSpace(body))
        {
            try
            {
                using var document = JsonDocument.Parse(body);
                var root = document.RootElement;

                if (root.TryGetProperty("data", out var dataElement)
                    && dataElement.ValueKind is not JsonValueKind.Null
                    && dataElement.ValueKind is not JsonValueKind.Undefined)
                {
                    data = dataElement.Deserialize<T>(ApiClient.Json);
                }

                if (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.Object)
                {
                    if (error.TryGetProperty("code", out var c))
                    {
                        code = c.GetString();
                    }

                    if (error.TryGetProperty("message", out var m))
                    {
                        message = m.GetString();
                    }

                    if (error.TryGetProperty("details", out var d)
                        && d.ValueKind == JsonValueKind.Object)
                    {
                        details = d.EnumerateObject().ToDictionary(
                            p => p.Name,
                            p => p.Value.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToArray());
                    }
                }
                else if (root.TryGetProperty("message", out var topMessage))
                {
                    // Some endpoints (auth failures) return a bare { message } shape.
                    message = topMessage.GetString();
                }
            }
            catch (JsonException)
            {
                // Not JSON (a file download, or an empty 204). Leave everything null.
            }
        }

        return new Result<T>(status, data, code, message, details, body);
    }
}
