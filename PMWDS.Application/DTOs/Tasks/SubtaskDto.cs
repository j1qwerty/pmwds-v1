namespace PMWDS.Application.DTOs.Tasks;

public record CreateSubtaskDto(
    string Title,
    string? Description,
    DateTime StartDate,
    DateTime? DueDate,
    float EstimatedHours,
    Guid ProjectId,
    Guid? MilestoneId,
    string? AssignedToUserId,
    Domain.Enums.TaskPriority Priority = Domain.Enums.TaskPriority.Medium);