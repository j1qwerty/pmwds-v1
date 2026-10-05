using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class Integration : AuditableEntity
{
    public string IntegrationType { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string ConfigurationJson { get; private set; } = "{}";
    public DateTime? LastSync { get; private set; }
    public string Status { get; private set; } = "Inactive";

    protected Integration() { }

    public static Integration Create(string integrationType, string name, object? configuration, bool isEnabled)
    {
        var integration = new Integration
        {
            IntegrationType = integrationType.Trim(),
            Name = name.Trim(),
            ConfigurationJson = JsonSerializer.Serialize(configuration ?? new Dictionary<string, object>()),
            Status = isEnabled ? "Active" : "Inactive"
        };

        if (!isEnabled)
        {
            integration.Deactivate();
        }

        return integration;
    }

    public static Integration CreateWithConfigurationJson(string integrationType, string name, string configurationJson, bool isEnabled)
    {
        var integration = Create(integrationType, name, new Dictionary<string, object>(), isEnabled);
        integration.ConfigurationJson = string.IsNullOrWhiteSpace(configurationJson) ? "{}" : configurationJson;
        return integration;
    }

    public void Update(string integrationType, string name, object? configuration, bool isEnabled, string status)
    {
        IntegrationType = integrationType.Trim();
        Name = name.Trim();
        ConfigurationJson = JsonSerializer.Serialize(configuration ?? new Dictionary<string, object>());
        Status = status.Trim();
        if (isEnabled)
        {
            Activate();
        }
        else
        {
            Deactivate();
        }
    }

    public void UpdateConfigurationJson(string integrationType, string name, string configurationJson, bool isEnabled, string status)
    {
        IntegrationType = integrationType.Trim();
        Name = name.Trim();
        ConfigurationJson = string.IsNullOrWhiteSpace(configurationJson) ? "{}" : configurationJson;
        Status = status.Trim();
        if (isEnabled)
        {
            Activate();
        }
        else
        {
            Deactivate();
        }
    }

    public void MarkSynced(string status)
    {
        LastSync = DateTime.UtcNow;
        Status = status.Trim();
    }
}
