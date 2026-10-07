using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Application.DTOs.Tasks;

public record TaskDto(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    DateTime StartDate,
    DateTime DueDate,
    DateTime? CompletedDate,
    float EstimatedHours,
    double ProgressPercentage,
    Guid ProjectId,
    string? ProjectName,
    Guid? MilestoneId,
    string? MilestoneName,
    Guid? ParentTaskId,
    string? AssignedToUserId,
    string? AssignedToUserName,
    List<TaskAssigneeDto> Assignees,
    bool IsEscalated,
    int EscalationLevel,
    DateTime? EscalatedDate,
    double AIDelayProbability,
    string? AIRiskFactors,
    bool IsOverdue,
    DateTime CreatedDate,
    List<TaskDependencyDto> Dependencies,
    List<TaskCommentDto> Comments,
    List<TaskAttachmentDto> Attachments,
    List<TaskDto> SubTasks,
    bool HasSubTasks,
    double AIOptimalAssigneeScore,
    DateTime? AIPredictedCompletionDate,
    string? AIRecommendedAssigneeId)
    {
        public static TaskDto FromEntity(ProjectTask t)
        {
            var assignments = t.Assignments ?? new List<TaskAssignment>();
            var dependencies = t.Dependencies ?? new List<TaskDependency>();
            var comments = t.Comments ?? new List<TaskComment>();
            var attachments = t.Attachments ?? new List<TaskAttachment>();
            var subTasks = t.SubTasks ?? new List<ProjectTask>();

            var hasSubTasks = subTasks.Count > 0;
            var progress = hasSubTasks
                ? Math.Round(subTasks.Average(st => Math.Clamp(st.ProgressPercentage, 0, 100)), 1)
                : t.ProgressPercentage;

            return new(
            Id: t.Id,
            Title: t.Title,
            Description: t.Description,
            Status: t.Status.ToString(),
            Priority: t.Priority.ToString(),
            StartDate: t.StartDate,
            DueDate: t.DueDate,
            CompletedDate: t.CompletedDate,
            EstimatedHours: t.EstimatedHours,
            ProgressPercentage: progress,
            ProjectId: t.ProjectId,
            ProjectName: t.Project?.Name,
            MilestoneId: t.MilestoneId,
            MilestoneName: t.Milestone?.Name,
            ParentTaskId: t.ParentTaskId,
            AssignedToUserId: t.AssignedToUserId?.ToString(),
            AssignedToUserName: assignments
            .Where(a => a.IsActive)
            .Select(a => a.User != null ? a.User.FullName : null)
            .FirstOrDefault(n => !string.IsNullOrEmpty(n)),
            Assignees: assignments
            .Where(a => a.IsActive)
            .Select(a => new TaskAssigneeDto(a.UserId.ToString(), a.User?.FullName))
            .ToList(),
            IsEscalated: t.IsEscalated,
            EscalationLevel: t.EscalationLevel,
            EscalatedDate: t.EscalatedDate,
            AIDelayProbability: t.AIDelayProbability,
            AIRiskFactors: t.AIRiskFactors,
            IsOverdue: t.IsOverdue(),
            CreatedDate: t.CreatedDate,
            Dependencies: dependencies
            .Select(d => TaskDependencyDto.FromEntity(d))
            .ToList(),
            Comments: comments
            .Select(c => TaskCommentDto.FromEntity(c))
            .ToList(),
            Attachments: attachments
            .Select(a => TaskAttachmentDto.FromEntity(a))
            .ToList(),
            SubTasks: subTasks
            .Select(st => FromEntity(st))
            .ToList(),
            HasSubTasks: hasSubTasks,
            AIOptimalAssigneeScore: t.AIOptimalAssigneeScore,
            AIPredictedCompletionDate: t.AIPredictedCompletionDate,
            AIRecommendedAssigneeId: t.AIRecommendedAssigneeId?.ToString()
            );
        }
    }
    public record TaskAssigneeDto(string UserId, string? FullName);
    public record TaskDependencyDto(
        Guid Id,
        Guid PredecessorTaskId,
        string? PredecessorTaskTitle,
        Guid SuccessorTaskId,
        string? SuccessorTaskTitle,
        string Type,
        int LagDays)
    {
        public static TaskDependencyDto FromEntity(TaskDependency d)
        => new(
            Id: d.Id,
            PredecessorTaskId: d.PredecessorTaskId,
            PredecessorTaskTitle: d.PredecessorTask?.Title,
            SuccessorTaskId: d.SuccessorTaskId,
            SuccessorTaskTitle: d.SuccessorTask?.Title,
            Type: d.Type.ToString(),
            LagDays: d.LagDays
        );
    }
    public record TaskCommentDto(
        Guid Id,
        Guid TaskId,
        string UserId,
        string Content,
        bool IsSystemGenerated,
        Guid? ParentCommentId,
        DateTime CreatedDate)
    {
        public static TaskCommentDto FromEntity(TaskComment c)
        => new(
            Id: c.Id,
            TaskId: c.TaskId,
            UserId: c.UserId?.ToString() ?? "system",
            Content: c.Content,
            IsSystemGenerated: c.IsSystemGenerated,
            ParentCommentId: c.ParentCommentId,
            CreatedDate: c.CreatedDate
        );
    }
    public record TaskAttachmentDto(
        Guid Id,
        Guid TaskId,
        string FileName,
        string FilePath,
        string ContentType,
        long FileSizeBytes,
        string UploadedByUserId,
        DateTime CreatedDate)
    {
        public static TaskAttachmentDto FromEntity(TaskAttachment a)
        => new(
            Id: a.Id,
            TaskId: a.TaskId,
            FileName: a.FileName,
            FilePath: a.FilePath,
            ContentType: a.ContentType,
            FileSizeBytes: a.FileSizeBytes,
            UploadedByUserId: a.UploadedByUserId,
            CreatedDate: a.CreatedDate
        );
    }
    public record TaskSummaryDto(
    Guid Id,
    string Title,
    string Status,
    string Priority,
    DateTime DueDate,
    double AIDelayProbability,
    bool IsEscalated)
    {
        public static TaskSummaryDto FromEntity(ProjectTask t)
        => new(t.Id, t.Title,
        t.Status.ToString(),
        t.Priority.ToString(),
        t.DueDate,
        t.AIDelayProbability,
        t.IsEscalated);
    }

    public record TaskDashboardPreviewDto(
        Guid Id,
        string Title,
        string Status,
        Guid ProjectId,
        string? ProjectName,
        Guid? MilestoneId,
        string? MilestoneName,
        double ProgressPercentage,
        DateTime CreatedDate);

    public record TaskDashboardStatsDto(
        int TotalTasks,
        int InProgressTasks,
        int OnHoldTasks,
        int CompletedTasks,
        int DelayedTasks,
        List<TaskDashboardPreviewDto> RecentTasks,
        List<TaskDashboardPreviewDto> RecentInProgressTasks,
        List<TaskDashboardPreviewDto> RecentOnHoldTasks,
        List<TaskDashboardPreviewDto> RecentCompletedTasks,
        List<TaskDashboardPreviewDto> RecentDelayedTasks);
    public record CreateTaskDto(
    string Title,
    string? Description,
    DateTime StartDate,
    DateTime DueDate,
    float EstimatedHours,
    Guid ProjectId,
    Guid? MilestoneId,
    Guid? ParentTaskId,
    string? AssignedToUserId,
    Domain.Enums.TaskPriority Priority =
    Domain.Enums.TaskPriority.Medium,
    List<string>? AssignedToUserIds = null);
    public record UpdateTaskDto(
    string Title,
    string? Description,
    DateTime StartDate,
    DateTime DueDate,
    float EstimatedHours,
    Domain.Enums.TaskPriority Priority,
    Guid? MilestoneId);
    public record UpdateTaskProgressDto(
    double ProgressPercentage,
    string? Notes = null);
    public record CreateDependencyDto(
        Guid PredecessorTaskId,
        Guid SuccessorTaskId,
        DependencyType Type = DependencyType.FinishToStart,
        int LagDays = 0);
    public record UpdateDependencyDto(
        DependencyType Type,
        int LagDays);
