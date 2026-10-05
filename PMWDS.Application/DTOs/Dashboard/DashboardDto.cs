using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.DTOs.Tasks;

namespace PMWDS.Application.DTOs.Dashboard;

public record DashboardDto(
 int TotalProjects,
 int ActiveProjects,
 int CompletedProjects,
 int OnHoldProjects,
 int TotalTasks,
 int CompletedTasks,
 int OverdueTasks,

 int EscalatedTasks,
 int TotalTeamMembers,
 int AvailableMembers,
 double OverallHealthScore,
 double OverallDelayRisk,
 decimal TotalBudget,
 decimal TotalActualCost,
 decimal BudgetVariance,
 List<ProjectSummaryDto> HighRiskProjects,
 List<TaskSummaryDto> RecentEscalations,
 List<ProjectHealthItem> ProjectHealthBreakdown,
 List<WorkloadItem> WorkloadDistribution,
 List<TrendPoint> TaskCompletionTrend,
 DateTime GeneratedAt
);
public record ProjectHealthItem(
 Guid Id,
 string Name,
 double HealthScore,
 double DelayRisk,
 string Status);
public record WorkloadItem(
 string UserId,
 string FullName,
 double WorkloadScore,
 double BurnoutRisk,
 int ActiveTasks);
public record TrendPoint(
 DateTime Date,
 int Completed,
 int Created);
