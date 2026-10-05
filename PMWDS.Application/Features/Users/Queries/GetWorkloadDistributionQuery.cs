using MediatR;
using PMWDS.Application.DTOs.Users;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Enums;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Application.Features.Users.Queries;
public record GetWorkloadDistributionQuery(
 Guid? DepartmentId,
 IReadOnlyCollection<Guid>? UserIds = null)
 : IRequest<WorkloadDistributionDto>;
public class GetWorkloadDistributionQueryHandler
 : IRequestHandler<
 GetWorkloadDistributionQuery,
 WorkloadDistributionDto>
{
 private readonly IUnitOfWork _uow;
 public GetWorkloadDistributionQueryHandler(
 IUnitOfWork uow)
 => _uow = uow;
 public async Task<WorkloadDistributionDto> Handle(
 GetWorkloadDistributionQuery req,
 CancellationToken ct)
 {
 var users = req.DepartmentId.HasValue
 ? (await _uow.Users.GetByDepartmentAsync(
 req.DepartmentId.Value, ct)).ToList()
 : (await _uow.Users.GetAllAsync(ct)).ToList();
 if (req.UserIds is not null)
 {
 users = users.Where(user => req.UserIds.Contains(user.Id)).ToList();
 }
 var allTasks = (await _uow.Tasks.GetAllAsync(ct)).ToList();
 var assignments = (await _uow.TaskAssignments.GetAllAsync(ct)).ToList();
 var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);

 var distribution = users.Select(u =>
 {
 var userId = u.Id;
 var assignedTaskIds = assignments
 .Where(a => a.UserId == userId && a.IsActive)
 .Select(a => a.TaskId)
 .ToHashSet();
 var userTasks = allTasks
 .Where(t => t.AssignedToUserId == userId || assignedTaskIds.Contains(t.Id))
 .ToList();
 var activeTasks = userTasks
 .Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled)
 .ToList();
 var completedThisMonth = userTasks.Count(t => t.CompletedDate >= monthStart);
 var workloadScore = CalculateWorkload(activeTasks, allTasks, u.AvailabilityPercentage);
 var burnoutRisk = CalculateBurnout(workloadScore, activeTasks, u.AvailabilityPercentage);

 return new UserWorkloadItem(
 UserId: userId.ToString(),
 FullName: u.FullName,
 JobTitle: u.JobTitle,
 AvailabilityPercent: u.AvailabilityPercentage,
 WorkloadScore: workloadScore,
 BurnoutRisk: burnoutRisk,
 PerformanceScore: Math.Round(u.AIPerformanceScore, 1),
 ActiveTaskCount: activeTasks.Count,
 CompletedThisMonth: completedThisMonth,
 Skills: u.Skills
 .Select(s =>
 s.Skill?.Name ?? "")
 .Where(name => !string.IsNullOrWhiteSpace(name))
 .ToList(),
 Status: workloadScore switch
 {
 >= 90 => "Overloaded",
 >= 70 => "High",
 >= 45 => "Moderate",
 _ => "Available"
 }
 );
 }).ToList();
 return new WorkloadDistributionDto(
 DepartmentId: req.DepartmentId,
 TotalMembers: users.Count,
 AvailableCount: users.Count(u =>
 u.AvailabilityStatus ==
 Domain.Enums.AvailabilityStatus.Available),
 OverloadedCount: distribution.Count(d =>
 d.Status == "Overloaded"),
 AverageWorkload: distribution.Any()
 ? Math.Round(distribution
 .Average(d => d.WorkloadScore), 1)
 : 0.0,
 AverageBurnoutRisk: distribution.Any()
 ? Math.Round(distribution
 .Average(d => d.BurnoutRisk), 4)
 : 0.0,
 Members: distribution
 .OrderByDescending(d => d.WorkloadScore)
 .ToList(),
 GeneratedAt: DateTime.UtcNow
 );
 }

 private static double CalculateWorkload(
 List<Domain.Entities.ProjectTask> activeTasks,
 List<Domain.Entities.ProjectTask> allTasks,
 double availabilityPercentage)
 {
 if (activeTasks.Count == 0)
 {
 return 0;
 }

 var now = DateTime.UtcNow;
 var activeTaskIds = activeTasks.Select(t => t.Id).ToHashSet();
 var subtasksByParent = allTasks
 .Where(t => t.ParentTaskId.HasValue && activeTaskIds.Contains(t.ParentTaskId.Value))
 .GroupBy(t => t.ParentTaskId!.Value)
 .ToDictionary(g => g.Key, g => g.ToList());

 var weightedRemaining = activeTasks.Sum(task =>
 {
 var subtasks = subtasksByParent.TryGetValue(task.Id, out var children) ? children : new List<Domain.Entities.ProjectTask>();
 var progress = subtasks.Count > 0
 ? subtasks.Average(s => s.ProgressPercentage)
 : task.ProgressPercentage;
 var remainingRatio = Math.Clamp((100 - progress) / 100d, 0, 1);
 var estimate = Math.Max(task.EstimatedHours, 1);
 var priorityWeight = task.Priority switch
 {
 TaskPriority.Critical => 1.45,
 TaskPriority.High => 1.25,
 TaskPriority.Medium => 1.0,
 _ => 0.8
 };
 var overdueWeight = task.DueDate < now ? 1.35 : 1.0;
 var subtaskWeight = subtasks.Count > 0 ? 1 + Math.Min(subtasks.Count, 8) * 0.04 : 1.0;
 return estimate * remainingRatio * priorityWeight * overdueWeight * subtaskWeight;
 });

 var capacityHours = Math.Max(8, 40 * (Math.Clamp(availabilityPercentage, 1, 100) / 100d));
 return Math.Round(Math.Clamp(weightedRemaining / capacityHours * 100, 0, 100), 1);
 }

 private static double CalculateBurnout(
 double workloadScore,
 List<Domain.Entities.ProjectTask> activeTasks,
 double availabilityPercentage)
 {
 var overdueCount = activeTasks.Count(t => t.DueDate < DateTime.UtcNow);
 var escalatedCount = activeTasks.Count(t => t.IsEscalated);
 var availabilityPressure = Math.Max(0, 100 - availabilityPercentage) * 0.2;
 var score = workloadScore * 0.65 + overdueCount * 7 + escalatedCount * 10 + availabilityPressure;
 return Math.Round(Math.Clamp(score, 0, 100), 1);
 }
}
