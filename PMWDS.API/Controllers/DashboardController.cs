using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Controllers;

/// <summary>
/// One-call dashboard summary. Replaces the six requests the dashboard used to make
/// (projects/dashboard, projects, tasks/dashboard-summary, tasks/escalated, notifications,
/// activitylogs/team) while applying exactly the same visibility rules as each of them.
///
/// Route: GET /api/v1/dashboard/summary
/// (not to be confused with /api/v1/dashboards, the custom-dashboard builder).
/// </summary>
[ApiController]
[Route("api/v1/dashboard")]
public class DashboardController : BaseApiController
{
    private const double HighRiskThreshold = 0.7; // same cut-off as GET projects/dashboard

    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;
    private readonly ITaskWorkflowService _taskWorkflow;
    private readonly ICurrentUserService _currentUser;
    private readonly IAuthorizationService _authorization;

    public DashboardController(
        IMediator mediator,
        ApplicationDbContext db,
        RoleScopeService scope,
        ITaskWorkflowService taskWorkflow,
        ICurrentUserService currentUser,
        IAuthorizationService authorization) : base(mediator)
    {
        _db = db;
        _scope = scope;
        _taskWorkflow = taskWorkflow;
        _currentUser = currentUser;
        _authorization = authorization;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] Guid? departmentId,
        [FromQuery] int topProjects = 8,
        [FromQuery] int escalations = 8,
        [FromQuery] int activityDays = 7,
        CancellationToken ct = default)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var now = DateTime.UtcNow;

        // ---- Projects (same scoping and delayed rule as GET projects/dashboard) ----
        var projectQuery = _db.Projects.AsNoTracking();
        if (departmentId.HasValue)
        {
            projectQuery = projectQuery.Where(project =>
                project.DepartmentId == departmentId.Value ||
                project.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        projectQuery = await _scope.ScopeProjectsAsync(projectQuery, ct);

        var metrics = await projectQuery
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Count(),
                Active = group.Count(project => project.Status == ProjectStatus.InProgress),
                Completed = group.Count(project => project.Status == ProjectStatus.Completed),
                OnHold = group.Count(project => project.Status == ProjectStatus.OnHold),
                Delayed = group.Count(project =>
                    project.Status == ProjectStatus.Delayed ||
                    (project.Status != ProjectStatus.Completed &&
                     project.ProgressPercentage < 100 &&
                     project.PlannedEndDate < now)),
                HighRisk = group.Count(project => project.AIDelayRiskScore >= HighRiskThreshold),
                AverageHealth = group.Average(project => project.AIHealthScore),
                Planned = group.Sum(project => project.PlannedBudget),
                Spent = group.Sum(project => project.ActualCost)
            })
            .FirstOrDefaultAsync(ct);

        var projectCounts = new DashboardProjectCountsDto(
            metrics?.Total ?? 0,
            metrics?.Active ?? 0,
            metrics?.Completed ?? 0,
            metrics?.OnHold ?? 0,
            metrics?.Delayed ?? 0,
            metrics?.HighRisk ?? 0,
            InsightsQueries.ToHealthPercent(metrics?.AverageHealth ?? 0));

        var budget = new DashboardBudgetDto(metrics?.Planned ?? 0m, metrics?.Spent ?? 0m);

        var topProjectItems = await InsightsQueries.LoadUrgentProjectsAsync(
            _db, _scope, departmentId, topProjects, ct);

        // ---- Tasks (same filter as GET tasks/dashboard-summary) ----
        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var taskCountsRow = await _db.Tasks
            .AsNoTracking()
            .Where(task => allowedProjectIds.Contains(task.ProjectId) && task.ParentTaskId == null)
            .GroupBy(task => 1)
            .Select(group => new
            {
                Total = group.Count(),
                InProgress = group.Count(task => task.Status == TaskStatus.InProgress),
                OnHold = group.Count(task => task.Status == TaskStatus.OnHold),
                Completed = group.Count(task => task.Status == TaskStatus.Completed),
                Delayed = group.Count(task =>
                    task.Status == TaskStatus.Delayed ||
                    (task.Status != TaskStatus.Completed && task.DueDate < now))
            })
            .FirstOrDefaultAsync(ct);

        var taskCounts = new DashboardTaskCountsDto(
            taskCountsRow?.Total ?? 0,
            taskCountsRow?.InProgress ?? 0,
            taskCountsRow?.OnHold ?? 0,
            taskCountsRow?.Completed ?? 0,
            taskCountsRow?.Delayed ?? 0);

        // ---- Escalations (GET tasks/escalated requires the Tasks.View policy, so does this) ----
        var escalationTotal = 0;
        var escalationItems = new List<EscalationItemDto>();
        var canViewTasks = (await _authorization.AuthorizeAsync(User, AuthorizationPolicies.TasksView)).Succeeded;
        if (canViewTasks)
        {
            (escalationTotal, escalationItems) = await InsightsQueries.LoadEscalationsAsync(
                _db, allowedProjectIds, escalations, ct);
        }

        // ---- Team activity (same user scope as GET activitylogs/team) ----
        var activity = await InsightsQueries.LoadTeamActivityAsync(_db, _scope, activityDays, ct);

        // ---- Unread notifications (current user only) ----
        var unread = 0;
        var userId = _currentUser.UserId;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            unread = await _db.Notifications
                .AsNoTracking()
                .CountAsync(notification => notification.UserId == userId && !notification.IsRead, ct);
        }

        return Ok(new DashboardSummaryDto(
            projectCounts,
            taskCounts,
            budget,
            topProjectItems,
            escalationTotal,
            escalationItems,
            activity,
            unread,
            now));
    }
}
