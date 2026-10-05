using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
namespace PMWDS.Domain.Entities;

public class Notification : BaseEntity
{
    public string UserId { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public NotificationType Type { get; private set; }
    public NotificationPriority Priority { get; private set; }
    public bool IsRead { get; private set; }
    public DateTime? ReadDate { get; private set; }
    public string? ActionUrl { get; private set; }
    public string? RelatedEntityId { get; private set; }
    public string? RelatedEntityType { get; private set; }
    public bool IsAIGenerated { get; private set; }
    protected Notification() { }
    public static Notification Create(
    string userId, string title,
    string message,
    NotificationType type,
    NotificationPriority priority = NotificationPriority.Normal,
    string? actionUrl = null,
    string? relatedEntityId = null,
    string? relatedEntityType = null,
    bool isAIGenerated = false)
    {
        return new Notification
        {
            UserId = userId,
            Title = title,
            Message = message,
            Type = type,
            Priority = priority,
            IsRead = false,
            ActionUrl = actionUrl,
            RelatedEntityId = relatedEntityId,
            RelatedEntityType = relatedEntityType,
            IsAIGenerated = isAIGenerated
        };
    }
    public void MarkAsRead()
    {
        IsRead = true;
        ReadDate = DateTime.UtcNow;
    }
}