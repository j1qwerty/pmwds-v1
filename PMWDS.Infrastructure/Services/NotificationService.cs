using Microsoft.Extensions.Logging;
using PMWDS.Application.DTOs.Notifications;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

namespace PMWDS.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly IUnitOfWork _uow;
    private readonly IEmailService _email;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IUnitOfWork uow,
        IEmailService email,
        ILogger<NotificationService> logger)
    {
        _uow = uow;
        _email = email;
        _logger = logger;
    }

    public async Task SendAsync(
        SendNotificationDto dto,
        CancellationToken ct = default)
    {
        var notification = Notification.Create(
            dto.UserId,
            dto.Title,
            dto.Message,
            dto.Type,
            dto.Priority,
            dto.ActionUrl,
            dto.RelatedEntityId,
            dto.RelatedEntityType,
            dto.IsAIGenerated);

        notification.SetCreatedBy("system");

        await _uow.Notifications.AddAsync(notification, ct);
        await _uow.SaveChangesAsync(ct);

        if (dto.Priority >= NotificationPriority.High &&
            Guid.TryParse(dto.UserId, out var userId))
        {
            var user = await _uow.Users.GetByIdAsync(userId, ct);
            if (user != null && !string.IsNullOrWhiteSpace(user.Email))
            {
                try
                {
                    await _email.SendEmailAsync(
                        user.Email,
                        dto.Title,
                        dto.Message,
                        ct);
                }
                catch
                {
                    // Email sending failed (e.g., SMTP not configured)
                    // Notification is already saved in DB
                }
            }
        }
    }

    public async Task SendBulkAsync(
        IEnumerable<SendNotificationDto> dtos,
        CancellationToken ct = default)
    {
        foreach (var dto in dtos)
        {
            await SendAsync(dto, ct);
        }
    }

    public Task SendEmailAsync(
        string to,
        string subject,
        string body,
        CancellationToken ct = default)
        => _email.SendEmailAsync(to, subject, body, ct);

    public async Task SendTaskAssignmentAlertAsync(
        Guid taskId,
        string assigneeId,
        CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetByIdAsync(taskId, ct);
        if (task == null)
        {
            return;
        }

        await SendAsync(new SendNotificationDto(
            UserId: assigneeId,
            Title: "New Task Assigned",
            Message: $"You have been assigned: {task.Title}",
            Type: NotificationType.TaskAssigned,
            Priority: NotificationPriority.Normal,
            ActionUrl: $"/projects/{task.ProjectId}/tasks?taskId={taskId}",
            RelatedEntityId: taskId.ToString(),
            RelatedEntityType: "Task"),
            ct);
    }

    public async Task SendDeadlineReminderAsync(
        Guid taskId,
        int daysRemaining,
        CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetByIdAsync(taskId, ct);
        if (task?.AssignedToUserId == null)
        {
            return;
        }

        await SendAsync(new SendNotificationDto(
            UserId: task.AssignedToUserId.Value.ToString(),
            Title: "Task Deadline Approaching",
            Message: $"Task '{task.Title}' is due in {daysRemaining} day(s).",
            Type: NotificationType.TaskDeadline,
            Priority: daysRemaining <= 1
                ? NotificationPriority.Urgent
                : NotificationPriority.High,
            ActionUrl: $"/tasks/{taskId}",
            RelatedEntityId: taskId.ToString(),
            RelatedEntityType: "Task"),
            ct);
    }

    public async Task SendEscalationAlertAsync(
        Guid taskId,
        int escalationLevel,
        CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetByIdAsync(taskId, ct);
        if (task == null)
        {
            return;
        }

        var project = await _uow.Projects.GetByIdAsync(task.ProjectId, ct);
        if (project?.ProjectManagerId == null)
        {
            return;
        }

        await SendAsync(new SendNotificationDto(
            UserId: project.ProjectManagerId.Value.ToString(),
            Title: $"Task Escalated - Level {escalationLevel}",
            Message: $"Task '{task.Title}' requires attention.",
            Type: NotificationType.TaskEscalated,
            Priority: NotificationPriority.Urgent,
            ActionUrl: $"/tasks/{taskId}",
            RelatedEntityId: taskId.ToString(),
            RelatedEntityType: "Task"),
            ct);
    }

    public async Task SendProjectCreatedAsync(
        Guid projectId,
        CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetByIdAsync(projectId, ct);
        if (project?.ProjectManagerId == null)
        {
            return;
        }

        await SendAsync(new SendNotificationDto(
            UserId: project.ProjectManagerId.Value.ToString(),
            Title: "Project Created",
            Message: $"You are the project manager for '{project.Name}'.",
            Type: NotificationType.ProjectAlert,
            Priority: NotificationPriority.Normal,
            ActionUrl: $"/projects/{projectId}",
            RelatedEntityId: projectId.ToString(),
            RelatedEntityType: "Project"),
            ct);
    }

    public async Task SendProjectStatusChangedAsync(
        Guid projectId,
        ProjectStatus oldStatus,
        ProjectStatus newStatus,
        CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetByIdAsync(projectId, ct);
        if (project?.ProjectManagerId == null)
        {
            return;
        }

        await SendAsync(new SendNotificationDto(
            UserId: project.ProjectManagerId.Value.ToString(),
            Title: "Project Status Changed",
            Message: $"'{project.Name}' changed from {oldStatus} to {newStatus}.",
            Type: NotificationType.ProjectAlert,
            Priority: NotificationPriority.Normal,
            ActionUrl: $"/projects/{projectId}",
            RelatedEntityId: projectId.ToString(),
            RelatedEntityType: "Project"),
            ct);
    }

    public async Task SendAIInsightAsync(
        string userId,
        string insight,
        Guid? projectId = null,
        CancellationToken ct = default)
    {
        // Without an ActionUrl the client had nowhere to navigate on click, so the row was
        // effectively dead. Scope to the project when there is one, otherwise to the AI page,
        // which always exists.
        var actionUrl = projectId.HasValue ? $"/projects/{projectId.Value}" : "/ai";

        await SendAsync(new SendNotificationDto(
            UserId: userId,
            Title: "AI Insight",
            Message: insight,
            Type: NotificationType.AIInsight,
            Priority: NotificationPriority.Normal,
            ActionUrl: actionUrl,
            RelatedEntityId: projectId?.ToString(),
            RelatedEntityType: projectId.HasValue ? "Project" : null,
            IsAIGenerated: true),
            ct);

        _logger.LogInformation(
            "AI insight notification sent to user {UserId}",
            userId);
    }
}
