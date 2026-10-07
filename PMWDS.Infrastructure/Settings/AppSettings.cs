namespace PMWDS.Infrastructure.Settings;

public class EmailSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public bool UseSsl { get; set; } = true;
    public string ClientBaseUrl { get; set; } = "http://localhost:5175";
    public int PasswordResetMinutes { get; set; } = 30;
}

public class AzureStorageSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string ContainerName { get; set; } = string.Empty;
    public string LocalUploadPath { get; set; } = string.Empty;
    public string LocalBaseUrl { get; set; } = "/files";
}

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 30;
    public int RefreshTokenDays { get; set; } = 14;
}

public class SecurityValidationSettings
{
    public bool ValidateSecretsOnStartup { get; set; } = true;
}

public class AISettings
{
    public string OpenAIModel { get; set; } = "gpt-4o";

    /// <summary>
    /// Top-level OpenAI key, bound from AI__OpenAIApiKey.
    ///
    /// Read only as a fallback when the per-provider AI__OpenAI__ApiKey is blank,
    /// so an existing single-key configuration keeps working unchanged. The
    /// per-provider value wins when both are present.
    /// </summary>
    public string OpenAIApiKey { get; set; } = string.Empty;

    public string DefaultProvider { get; set; } = "OpenRouter";
    public string DefaultModel { get; set; } = "nvidia/nemotron-3-ultra-550b-a55b:free";
    public string AppName { get; set; } = "PMWDS";
    public string AppUrl { get; set; } = "http://localhost:5179";
    public string MLModelPath { get; set; } = string.Empty;
    public bool UseLocalModel { get; set; } = false;
    public double RiskThreshold { get; set; } = 0.7;
    public int TrainingCronHour { get; set; } = 2; // 2 AM

    /// <summary>
    /// Overall timeout for provider calls. The default HttpClient timeout is
    /// 100s, which is not enough for large structured report completions on a
    /// large model such as the 550B default.
    /// </summary>
    public int RequestTimeoutSeconds { get; set; } = 600;

    /// <summary>
    /// Caps the completion length. Must be large enough to hold a complete
    /// JSON report body; if the cap truncates the response mid-object the
    /// JSON will not parse and the report falls back.
    /// </summary>
    public int MaxOutputTokens { get; set; } = 16000;

    /// <summary>
    /// Model to switch to when the primary model is rate limited (HTTP 429).
    /// Blank disables the fallback, leaving the original behaviour of failing fast.
    /// </summary>
    public string RateLimitFallbackModel { get; set; } = "openrouter/free";

    /// <summary>
    /// Whether to retry on the fallback model after a 429. Kept separate from the
    /// model name so the fallback can be disabled without editing configuration.
    /// </summary>
    public bool EnableRateLimitFallback { get; set; } = true;
    public AIProviderOptions OpenAI { get; set; } = new()
    {
        Enabled = true,
        BaseUrl = "https://api.openai.com/v1",
        DefaultModel = "gpt-4o"
    };
    public AIProviderOptions OpenRouter { get; set; } = new()
    {
        Enabled = true,
        BaseUrl = "https://openrouter.ai/api/v1",
        DefaultModel = "nvidia/nemotron-3-ultra-550b-a55b:free"
    };
}

public class AIProviderOptions
{
    public bool Enabled { get; set; } = false;
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string DefaultModel { get; set; } = string.Empty;
    public string ModelsPath { get; set; } = "/models";
    public Dictionary<string, string> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public class HangfireSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string DashboardPath { get; set; } = "/hangfire";
}

public class DatabaseSettings
{
    public bool ForceSqlite { get; set; } = false;
    public string SqliteConnectionString { get; set; } = "Data Source=App_Data/pmwds-v1.sqlite";

    /// <summary>
    /// Permits SQLite outside Development. Off by default so Production still demands SQL Server
    /// unless a deployment deliberately opts in (single-instance hosting, no Hangfire).
    /// </summary>
    public bool AllowSqliteInProduction { get; set; } = false;
}

public class LocalFileStorageSettings
{
    public string BasePath { get; set; } = string.Empty;
    public string AvatarsPath { get; set; } = "avatars";
    public string DocumentsPath { get; set; } = "documents";

    // Resolve relative BasePath against AppContext.BaseDirectory so callers never get a
    // working-directory-dependent path (systemd runs with a different working directory).
    // Empty BasePath keeps the historical App_Data default.
    private string ResolvedBasePath =>
        StoragePathResolver.Resolve(BasePath, AppContext.BaseDirectory, "App_Data");

    public string FullAvatarsPath => Path.Combine(ResolvedBasePath, AvatarsPath);
    public string FullDocumentsPath => Path.Combine(ResolvedBasePath, DocumentsPath);
}
