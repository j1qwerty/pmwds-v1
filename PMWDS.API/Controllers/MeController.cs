using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Controllers;

/// <summary>Endpoints about the signed-in user. Route: /api/v1/me</summary>
public class MeController : BaseApiController
{
    private const int MaxItemsPerBucket = 25;

    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly ITaskWorkflowService _taskWorkflow;

    public MeController(
        IMediator mediator,
        ApplicationDbContext db,
        ICurrentUserService currentUser,
        ITaskWorkflowService taskWorkflow) : base(mediator)
    {
        _db = db;
        _currentUser = currentUser;
        _taskWorkflow = taskWorkflow;
    }

    /// <summary>
    /// GET /api/v1/me/work?utcOffsetMinutes=330&amp;horizonDays=7
    ///
    /// The caller's own open tasks grouped into Overdue, Due today and Due soon.
    /// Unlike GET tasks/my-tasks this ALWAYS filters to the caller (my-tasks returns every
    /// task for a SuperAdmin). Day boundaries use <c>utcOffsetMinutes</c> so "today" matches
    /// the caller's clock; pass <c>-new Date().getTimezoneOffset()</c> from the browser.
    /// </summary>
    [HttpGet("work")]
    public async Task<IActionResult> GetWork(
        [FromQuery] int utcOffsetMinutes = 0,
        [FromQuery] int horizonDays = 7,
        CancellationToken ct = default)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var me))
        {
            return Unauthorized();
        }

        var offset = Math.Clamp(utcOffsetMinutes, -840, 840);
        var horizon = Math.Clamp(horizonDays, 1, 30);

        var now = DateTime.UtcNow;
        var todayStartUtc = now.AddMinutes(offset).Date.AddMinutes(-offset);
        var tomorrowStartUtc = todayStartUtc.AddDays(1);
        var horizonEndUtc = tomorrowStartUtc.AddDays(horizon);

        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);

        var mine = _db.Tasks
            .AsNoTracking()
            .Where(task =>
                allowedProjectIds.Contains(task.ProjectId) &&
                task.Status != TaskStatus.Completed &&
                task.Status != TaskStatus.Cancelled &&
                (task.AssignedToUserId == me ||
                 task.Assignments.Any(assignment => assignment.UserId == me && assignment.IsActive)));

        var overdueQuery = mine.Where(task => task.DueDate < todayStartUtc);
        var todayQuery = mine.Where(task => task.DueDate >= todayStartUtc && task.DueDate < tomorrowStartUtc);
        var soonQuery = mine.Where(task => task.DueDate >= tomorrowStartUtc && task.DueDate < horizonEndUtc);

        var counts = new MyWorkCountsDto(
            await overdueQuery.CountAsync(ct),
            await todayQuery.CountAsync(ct),
            await soonQuery.CountAsync(ct),
            await mine.CountAsync(task => task.Status == TaskStatus.InProgress, ct));

        var overdue = await LoadBucketAsync(overdueQuery, todayStartUtc, ct);
        var dueToday = await LoadBucketAsync(todayQuery, todayStartUtc, ct);
        var dueSoon = await LoadBucketAsync(soonQuery, todayStartUtc, ct);

        return Ok(new MyWorkDto(counts, overdue, dueToday, dueSoon, horizon, now));
    }

    private static async Task<List<MyWorkTaskDto>> LoadBucketAsync(
        IQueryable<ProjectTask> query,
        DateTime todayStartUtc,
        CancellationToken ct)
    {
        var rows = await query
            .OrderBy(task => task.DueDate)
            .ThenByDescending(task => task.Priority)
            .Take(MaxItemsPerBucket)
            .Select(task => new
            {
                task.Id,
                task.Title,
                task.Status,
                task.Priority,
                task.ProjectId,
                ProjectName = task.Project != null ? task.Project.Name : null,
                MilestoneName = task.Milestone != null ? task.Milestone.Name : null,
                task.DueDate,
                task.ProgressPercentage,
                task.IsEscalated,
                task.ParentTaskId
            })
            .ToListAsync(ct);

        return rows.Select(row => new MyWorkTaskDto(
            row.Id,
            row.Title,
            row.Status.ToString(),
            row.Priority.ToString(),
            row.ProjectId,
            row.ProjectName,
            row.MilestoneName,
            row.DueDate,
            row.ProgressPercentage,
            row.IsEscalated,
            row.ParentTaskId.HasValue,
            (int)Math.Floor((row.DueDate - todayStartUtc).TotalDays))).ToList();
    }
}
