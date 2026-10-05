using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class AlertRule : AuditableEntity
{
    public string Name { get; private set; } = string.Empty;
    public string ConditionType { get; private set; } = string.Empty;
    public string ConditionExpression { get; private set; } = string.Empty;
    public string ActionType { get; private set; } = string.Empty;
    public string ActionParametersJson { get; private set; } = "{}";
    public bool IsEnabled { get; private set; } = true;
    public DateTime? LastTriggered { get; private set; }

    protected AlertRule() { }

    public static AlertRule Create(
        string name,
        string conditionType,
        string conditionExpression,
        string actionType,
        object? actionParameters,
        bool isEnabled = true)
    {
        return new AlertRule
        {
            Name = name.Trim(),
            ConditionType = conditionType.Trim(),
            ConditionExpression = conditionExpression.Trim(),
            ActionType = actionType.Trim(),
            ActionParametersJson = JsonSerializer.Serialize(actionParameters ?? new Dictionary<string, string>()),
            IsEnabled = isEnabled
        };
    }

    public void Update(
        string name,
        string conditionType,
        string conditionExpression,
        string actionType,
        object? actionParameters,
        bool isEnabled)
    {
        Name = name.Trim();
        ConditionType = conditionType.Trim();
        ConditionExpression = conditionExpression.Trim();
        ActionType = actionType.Trim();
        ActionParametersJson = JsonSerializer.Serialize(actionParameters ?? new Dictionary<string, string>());
        IsEnabled = isEnabled;
    }

    public void MarkTriggered()
    {
        LastTriggered = DateTime.UtcNow;
    }
}
