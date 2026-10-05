using PMWDS.Domain.Enums;
namespace PMWDS.Application.DTOs.Notifications;

public record NotificationDto(
  Guid Id,
  string Title,
  string Message,
  string Type,
  string Priority,
  bool IsRead,
  DateTime CreatedDate,
  DateTime? ReadDate,
    string? ActionUrl
);

public record SendNotificationDto(
  string UserId,
  string Title,
  string Message,
  NotificationType Type,
  NotificationPriority Priority = NotificationPriority.Normal,
  string? ActionUrl = null,
  string? RelatedEntityId = null,
  string? RelatedEntityType = null,
  bool IsAIGenerated = false
);