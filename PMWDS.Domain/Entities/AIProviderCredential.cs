using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class AIProviderCredential : AuditableEntity
{
    public string Provider { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public bool Enabled { get; private set; }
    public bool UseEnvironmentDefault { get; private set; } = true;
    public string BaseUrl { get; private set; } = string.Empty;
    public string? ApiKey { get; private set; }
    public string DefaultModel { get; private set; } = string.Empty;

    protected AIProviderCredential() { }

    public static AIProviderCredential Create(
        string provider,
        string displayName,
        bool enabled,
        bool useEnvironmentDefault,
        string baseUrl,
        string? apiKey,
        string defaultModel)
    {
        var credential = new AIProviderCredential();
        credential.Update(provider, displayName, enabled, useEnvironmentDefault, baseUrl, apiKey, defaultModel);
        return credential;
    }

    public void Update(
        string provider,
        string displayName,
        bool enabled,
        bool useEnvironmentDefault,
        string baseUrl,
        string? apiKey,
        string defaultModel)
    {
        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new ArgumentException("Provider is required.", nameof(provider));
        }

        Provider = provider.Trim();
        DisplayName = string.IsNullOrWhiteSpace(displayName) ? Provider : displayName.Trim();
        Enabled = enabled;
        UseEnvironmentDefault = useEnvironmentDefault;
        BaseUrl = baseUrl.Trim();
        ApiKey = string.IsNullOrWhiteSpace(apiKey) ? ApiKey : apiKey.Trim();
        DefaultModel = defaultModel.Trim();
    }
}
