using PMWDS.Application.DTOs.Notifications;
namespace PMWDS.Application.Interfaces.Services;

public interface INotificationService
{
    Task SendAsync(SendNotificationDto dto,
    CancellationToken ct = default);
    Task SendBulkAsync(IEnumerable<SendNotificationDto> dtos,
    CancellationToken ct = default);
    Task SendEmailAsync(string to, string subject,
    string body, CancellationToken ct = default);
    Task SendTaskAssignmentAlertAsync(
    Guid taskId, string assigneeId,
    CancellationToken ct = default);
    Task SendDeadlineReminderAsync(
    Guid taskId, int daysRemaining,
    CancellationToken ct = default);
    Task SendEscalationAlertAsync(
    Guid taskId, int escalationLevel,
    CancellationToken ct = default);
    Task SendProjectCreatedAsync(
    Guid projectId,
    CancellationToken ct = default);
    Task SendProjectStatusChangedAsync(
    Guid projectId,
    PMWDS.Domain.Enums.ProjectStatus oldStatus,
    PMWDS.Domain.Enums.ProjectStatus newStatus,
    CancellationToken ct = default);
    Task SendAIInsightAsync(
    string userId, string insight,
    CancellationToken ct = default);
}
