using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Services;

public static class SensitiveDataMigrationService
{
    public static async Task ProtectExistingAsync(
        ApplicationDbContext db,
        ISensitiveDataProtector protector,
        CancellationToken ct = default)
    {
        var changed = false;

        var credentials = await db.AIProviderCredentials.ToListAsync(ct);
        foreach (var credential in credentials)
        {
            if (!string.IsNullOrWhiteSpace(credential.ApiKey) && !protector.IsProtected(credential.ApiKey))
            {
                credential.Update(
                    credential.Provider,
                    credential.DisplayName,
                    credential.Enabled,
                    credential.UseEnvironmentDefault,
                    credential.BaseUrl,
                    protector.Protect(credential.ApiKey),
                    credential.DefaultModel);
                changed = true;
            }
        }

        var webhooks = await db.Webhooks.ToListAsync(ct);
        foreach (var webhook in webhooks)
        {
            if (!string.IsNullOrWhiteSpace(webhook.Secret) && !protector.IsProtected(webhook.Secret))
            {
                webhook.Update(
                    webhook.IntegrationId,
                    webhook.EventType,
                    webhook.CallbackUrl,
                    protector.Protect(webhook.Secret),
                    System.Text.Json.JsonSerializer.Deserialize<List<string>>(webhook.HeadersJson) ?? new(),
                    webhook.IsActive);
                changed = true;
            }
        }

        var integrations = await db.Integrations.ToListAsync(ct);
        foreach (var integration in integrations)
        {
            if (!protector.IsProtected(integration.ConfigurationJson))
            {
                integration.UpdateConfigurationJson(
                    integration.IntegrationType,
                    integration.Name,
                    protector.Protect(integration.ConfigurationJson),
                    integration.IsActive,
                    integration.Status);
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
