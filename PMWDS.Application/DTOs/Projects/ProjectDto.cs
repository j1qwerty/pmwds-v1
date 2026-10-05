using PMWDS.Domain.Entities;
using PMWDS.Application.DTOs.Tasks;
using PMWDS.Application.DTOs.Users;
namespace PMWDS.Application.DTOs.Projects;

public record ProjectDto(
 Guid Id,
 string ProjectCode,
 string Name,
 string? Description,
 string Category,
 string Status,
 string Priority,
 DateTime PlannedStartDate,
 DateTime PlannedEndDate,
 DateTime? ActualStartDate,
 DateTime? ActualEndDate,
 decimal PlannedBudget,
 decimal ActualCost,
 decimal BudgetVariance,
 double ProgressPercentage,
 double AIHealthScore,
 double AIDelayRiskScore,
 double AIBudgetRiskScore,
 string? AIInsightsSummary,
 Guid DepartmentId,
 string? DepartmentName,
 List<Guid> DepartmentIds,
 List<ProjectDepartmentDto> Departments,
 string ProjectManagerId,
 string? ProjectManagerName,
 int TotalTasks,
 int CompletedTasks,
 int OverdueTasks,
 int TotalMilestones,
  int CompletedMilestones,
  DateTime CreatedDate,
  bool IsNewForCurrentUser = true)
{
    public static ProjectDto FromEntity(Project p, string? projectManagerName = null)
    => new(
    Id: p.Id,
    ProjectCode: p.ProjectCode,
    Name: p.Name,
    Description: p.Description,
    Category: p.Category,
    Status: p.Status.ToString(),
    Priority: p.Priority.ToString(),
    PlannedStartDate: p.PlannedStartDate,
    PlannedEndDate: p.PlannedEndDate,
    ActualStartDate: p.ActualStartDate,
    ActualEndDate: p.ActualEndDate,
    PlannedBudget: p.PlannedBudget,
    ActualCost: p.ActualCost,
    BudgetVariance: p.PlannedBudget - p.ActualCost,
    ProgressPercentage: RecalculateAndReturnProgress(p),
    AIHealthScore: (double)p.AIHealthScore,
    AIDelayRiskScore: (double)p.AIDelayRiskScore,
    AIBudgetRiskScore: (double)p.AIBudgetRiskScore,
    AIInsightsSummary: p.AIInsightsSummary,
    DepartmentId: p.DepartmentId,
    DepartmentName: p.Department?.Name,
    DepartmentIds: p.ProjectDepartments.Any()
        ? p.ProjectDepartments.Select(assignment => assignment.DepartmentId).Distinct().ToList()
        : new List<Guid> { p.DepartmentId },
    Departments: p.ProjectDepartments.Any()
        ? p.ProjectDepartments.Select(assignment => new ProjectDepartmentDto(
        assignment.DepartmentId,
        assignment.Department?.Name,
        assignment.IsPrimary)).ToList()
        : new List<ProjectDepartmentDto>
        {
            new(p.DepartmentId, p.Department?.Name, true)
        },
    ProjectManagerId: p.ProjectManagerId?.ToString() ?? string.Empty,
    ProjectManagerName: projectManagerName,
    TotalTasks: p.Tasks?.Count ?? 0,
    CompletedTasks: p.Tasks?.Count(t =>
    t.Status ==
   Domain.Enums.TaskStatus
    .Completed) ?? 0,
    OverdueTasks: p.Tasks?.Count(t =>
    t.IsOverdue()) ?? 0,
    TotalMilestones: p.Milestones?.Count ?? 0,
    CompletedMilestones: p.Milestones?.Count(m =>
    m.Status ==
   Domain.Enums.MilestoneStatus
    .Completed) ?? 0,
    CreatedDate: p.CreatedDate
    );

    private static double RecalculateAndReturnProgress(Project p)
    {
        p.RecalculateProgressFromMilestones();
        p.RecalculateStatusFromMilestones();
        return p.ProgressPercentage;
    }
}
public record ProjectDepartmentDto(
 Guid DepartmentId,
 string? DepartmentName,
 bool IsPrimary);
public record ProjectDetailDto(
 Guid Id,
 string ProjectCode,
 string Name,
 string? Description,
 string Category,
 string Status,
 string Priority,
 DateTime PlannedStartDate,
 DateTime PlannedEndDate,
 DateTime? ActualStartDate,
 DateTime? ActualEndDate,
 decimal PlannedBudget,
 decimal ActualCost,
 decimal BudgetVariance,
 double ProgressPercentage,
 double AIHealthScore,
 double AIDelayRiskScore,
 double AIBudgetRiskScore,
 string? AIInsightsSummary,
 Guid DepartmentId,


string? DepartmentName,
 List<Guid> DepartmentIds,
 List<ProjectDepartmentDto> Departments,
 string ProjectManagerId,
 string? ProjectManagerName,
 List<TaskDto> Tasks,
 List<MilestoneDto> Milestones,
 List<UserSummaryDto> TeamMembers,
 int TotalTasks,
 int CompletedTasks,
 int OverdueTasks,
 int EscalatedTasks,
 int TotalMilestones,
 int CompletedMilestones,
 DateTime CreatedDate,
 string CreatedBy);
public record ProjectSummaryDto(
  Guid Id,
  string ProjectCode,
  string Name,
  string Status,
  double ProgressPercentage,
  double AIHealthScore,
  double AIDelayRiskScore,
  int DelayDays,
  DateTime PlannedEndDate)
{
    public static ProjectSummaryDto FromEntity(Project p)
    => new(
    p.Id, p.ProjectCode, p.Name,
    p.Status.ToString(),
    p.ProgressPercentage,
    (double)p.AIHealthScore,
    (double)p.AIDelayRiskScore,
    p.GetDelayDays(),
    p.PlannedEndDate);
}
public record CreateProjectDto(
 string? ProjectCode = null,
 string Name = "",
 string? Description = null,
 string Category = "",
 DateTime PlannedStartDate = default,
 DateTime PlannedEndDate = default,
 decimal PlannedBudget = 0,
 Guid DepartmentId = default,
 string ProjectManagerId = "",
 IReadOnlyCollection<Guid>? DepartmentIds = null,
 Domain.Enums.ProjectPriority Priority =
 Domain.Enums.ProjectPriority.Medium);
public record UpdateProjectDto(
 string Name,
 string? Description,
 string Category,
 DateTime PlannedStartDate,
 DateTime PlannedEndDate,
 decimal PlannedBudget,
 Guid DepartmentId,
 string ProjectManagerId,
 Domain.Enums.ProjectPriority Priority,
 IReadOnlyCollection<Guid>? DepartmentIds = null);
