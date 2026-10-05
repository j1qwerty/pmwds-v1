using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class NotificationTemplate : AuditableEntity
{
    public string TemplateType { get; private set; } = string.Empty;
    public string SubjectTemplate { get; private set; } = string.Empty;
    public string BodyTemplate { get; private set; } = string.Empty;
    public string VariablesJson { get; private set; } = "[]";
    public string SupportedChannelsJson { get; private set; } = "[]";

    protected NotificationTemplate() { }

    public static NotificationTemplate Create(
        string templateType,
        string subjectTemplate,
        string bodyTemplate,
        IEnumerable<string>? variables,
        IEnumerable<string>? supportedChannels)
    {
        return new NotificationTemplate
        {
            TemplateType = templateType.Trim(),
            SubjectTemplate = subjectTemplate,
            BodyTemplate = bodyTemplate,
            VariablesJson = JsonSerializer.Serialize(variables ?? Enumerable.Empty<string>()),
            SupportedChannelsJson = JsonSerializer.Serialize(supportedChannels ?? Enumerable.Empty<string>())
        };
    }

    public void Update(
        string templateType,
        string subjectTemplate,
        string bodyTemplate,
        IEnumerable<string>? variables,
        IEnumerable<string>? supportedChannels)
    {
        TemplateType = templateType.Trim();
        SubjectTemplate = subjectTemplate;
        BodyTemplate = bodyTemplate;
        VariablesJson = JsonSerializer.Serialize(variables ?? Enumerable.Empty<string>());
        SupportedChannelsJson = JsonSerializer.Serialize(supportedChannels ?? Enumerable.Empty<string>());
    }

    public IEnumerable<string> GetVariables() => JsonSerializer.Deserialize<List<string>>(VariablesJson) ?? new();
    public IEnumerable<string> GetSupportedChannels() => JsonSerializer.Deserialize<List<string>>(SupportedChannelsJson) ?? new();
}
