using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class AuditLog : BaseEntity
{
    public string UserId { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public string EntityId { get; private set; } = string.Empty;
    public string? OldValues { get; private set; } // JSON
    public string? NewValues { get; private set; } // JSON
    public string? IPAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public bool IsAIAction { get; private set; }
    public string? AIModelUsed { get; private set; }
    protected AuditLog() { }
    public static AuditLog Create(
    string userId, string action,
    string entityType, string entityId,
    string? oldValues = null,
    string? newValues = null,
    string? ip = null,
    string? userAgent = null,
    bool isAI = false,
    string? aiModel = null)
    {
        return new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValues = oldValues,
            NewValues = newValues,
            IPAddress = ip,
            UserAgent = userAgent,
            IsAIAction = isAI,
            AIModelUsed = aiModel
        };
    }
}