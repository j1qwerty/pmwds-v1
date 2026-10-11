using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Controllers;

/// <summary>
/// Read-only project insights. Shares the /api/v1/projects prefix with ProjectsController;
/// the literal "urgency" segment and the "{id}/health-timeline" suffix do not overlap with
/// any existing ProjectsController route.
/// </summary>
[ApiController]
[Route("api/v1/projects")]
public class ProjectInsightsController : BaseApiController
{
    private const string TimelineBasis =
        "Reconstructed from the due and completion dates of the tasks currently in this project. " +
        "Historical AI score snapshots are not stored, so only the task-based series has history.";

    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;

    public ProjectInsightsController(
        IMediator mediator,
        ApplicationDbContext db,
        RoleScopeService scope) : base(mediator)
    {
        _db = db;
        _scope = scope;
    }

    /// <summary>
    /// GET /api/v1/projects/urgency?limit=8&amp;departmentId=
    /// Slim, server-ranked project list: delayed first, then AI delay risk, then nearest end date.
    /// </summary>
    [HttpGet("urgency")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsView)]
    public async Task<IActionResult> GetUrgency(
        [FromQuery] int limit = 8,
        [FromQuery] Guid? departmentId = null,
        CancellationToken ct = default)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var items = await InsightsQueries.LoadUrgentProjectsAsync(_db, _scope, departmentId, limit, ct);
        return Ok(items);
    }

    /// <summary>
    /// GET /api/v1/projects/{id}/health-timeline?weeks=12
    /// Weekly planned-vs-actual completion and overdue-open counts for one project.
    /// </summary>
    [HttpGet("{id:guid}/health-timeline")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsView)]
    public async Task<IActionResult> GetHealthTimeline(
        Guid id,
        [FromQuery] int weeks = 12,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessProjectAsync(id, ct))
        {
            return Forbid();
        }

        var project = await _db.Projects
            .AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.Name, p.AIDelayRiskScore, p.AIHealthScore })
            .FirstOrDefaultAsync(ct);

        if (project is null)
        {
            return NotFound();
        }

        IQueryable<ProjectTask> tasksQuery = _db.Tasks
            .AsNoTracking()
            .Where(task =>
                task.ProjectId == id &&
                task.ParentTaskId == null &&
                task.Status != TaskStatus.Cancelled);

        // Same visibility rule as GET tasks/by-project: departments that are not the primary
        // department only see tasks in milestones assigned to them.
        if (!await _scope.CanSeeFullProjectDetailsAsync(id, ct))
        {
            var departmentIds = await _scope.GetDepartmentIdsAsync(ct);
            var visibleMilestoneIds = await _db.Milestones
                .Where(milestone =>
                    milestone.ProjectId == id &&
                    milestone.DepartmentId.HasValue &&
                    departmentIds.Contains(milestone.DepartmentId.Value))
                .Select(milestone => milestone.Id)
                .ToListAsync(ct);
            tasksQuery = tasksQuery.Where(task =>
                task.MilestoneId.HasValue && visibleMilestoneIds.Contains(task.MilestoneId.Value));
        }

        var rows = await tasksQuery
            .Select(task => new { task.DueDate, task.CompletedDate, task.Status })
            .ToListAsync(ct);

        var weekCount = Math.Clamp(weeks, 2, 52);
        var today = DateTime.UtcNow.Date;
        var total = rows.Count;
        var points = new List<HealthTimelinePointDto>(weekCount);

        for (var back = weekCount - 1; back >= 0; back--)
        {
            var weekEnding = today.AddDays(-7 * back);
            var asOf = weekEnding.AddDays(1); // exclusive upper bound: end of that UTC day
            var isLatest = back == 0;

            // A completed task with no recorded completion date can only be placed "now",
            // so it counts in the latest point and never in earlier ones.
            bool IsCompletedBy(DateTime? completedDate, TaskStatus status) =>
                status == TaskStatus.Completed &&
                (completedDate.HasValue ? completedDate.Value < asOf : isLatest);

            var due = 0;
            var completed = 0;
            var overdueOpen = 0;
            foreach (var row in rows)
            {
                var isDone = IsCompletedBy(row.CompletedDate, row.Status);
                if (isDone)
                {
                    completed++;
                }

                if (row.DueDate < asOf)
                {
                    due++;
                    if (!isDone)
                    {
                        overdueOpen++;
                    }
                }
            }

            points.Add(new HealthTimelinePointDto(
                DateOnly.FromDateTime(weekEnding),
                total,
                due,
                completed,
                overdueOpen,
                total == 0 ? 0 : Math.Round(due * 100.0 / total, 1),
                total == 0 ? 0 : Math.Round(completed * 100.0 / total, 1)));
        }

        return Ok(new ProjectHealthTimelineDto(
            project.Id,
            project.Name,
            InsightsQueries.ToRiskPercent(project.AIDelayRiskScore),
            InsightsQueries.ToHealthPercent(project.AIHealthScore),
            TimelineBasis,
            points));
    }
}
