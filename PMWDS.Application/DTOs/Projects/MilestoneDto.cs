using PMWDS.Domain.Entities;
namespace PMWDS.Application.DTOs.Projects;
public record MilestoneDto(
 Guid Id,
 Guid ProjectId,
 Guid? DepartmentId,
 string? DepartmentName,
 string Name,
 string Description,
 int Order,
 DateTime DueDate,
 DateTime? CompletedDate,
 string Status,
 bool IsCritical,
 double ProgressPercentage,
 bool HasTasks,
 bool IsBlocked,
 string? BlockedByMessage,
 // A milestone only has one date of its own - its due date. Tasks inside it have a start
 // *and* a due date, so the client needs to know how far back a task may reach in order to
 // validate the pair. The milestone's creation date is that lower bound; without it the only
 // available reference was the due date, which made the two dates look like they had to be
 // identical.
 DateTime CreatedDate)
{
    public static MilestoneDto FromEntity(Milestone m)
    {
        var tasks = m.Tasks ?? new List<ProjectTask>();
        var hasTasks = tasks.Count > 0;
        var progress = m.RecalculateProgressFromTasks();
        m.RecalculateStatusFromTasks();
        return new(
        m.Id,
        m.ProjectId,
        m.DepartmentId,
        m.Department?.Name,
        m.Name,
        m.Description,
        m.Order,
        m.DueDate,
        m.CompletedDate,
        m.Status.ToString(),
        m.IsCritical,
        progress,
        hasTasks,
        m.IsBlocked,
        m.BlockedByMessage,
        m.CreatedDate);
    }
}