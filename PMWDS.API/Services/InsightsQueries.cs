using Microsoft.EntityFrameworkCore;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Services;

/// <summary>
/// Query helpers shared by the dashboard summary, project urgency, escalation and
/// activity endpoints. Every helper takes data that has ALREADY been scoped by
/// <see cref="RoleScopeService"/> (or applies the scope itself), so callers cannot
/// accidentally widen what the current user is allowed to see.
/// </summary>
public static class InsightsQueries
{
    /// <summary>AIDelayRiskScore is stored 0..1; tolerate values already expressed as 0..100.</summary>
    public static int ToRiskPercent(double score) =>
        (int)Math.Round(Math.Clamp(score <= 1 ? score * 100 : score, 0, 100));

    /// <summary>AIHealthScore is stored 0..100.</summary>
    public static int ToHealthPercent(double score) =>
        (int)Math.Round(Math.Clamp(score, 0, 100));

    /// <summary>
    /// Projects the current user can see, excluding Completed and Cancelled, ordered by
    /// urgency: delayed first, then AI delay risk (high to low), then nearest planned end.
    /// "Delayed" uses the same rule as GET projects/dashboard.
    /// </summary>
    public static async Task<List<UrgentProjectDto>> LoadUrgentProjectsAsync(
        ApplicationDbContext db,
        RoleScopeService scope,
        Guid? departmentId,
        int limit,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var take = Math.Clamp(limit, 1, 50);

        var query = db.Projects.AsNoTracking();

        if (departmentId.HasValue)
        {
            query = query.Where(project =>
                project.DepartmentId == departmentId.Value ||
                project.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        query = await scope.ScopeProjectsAsync(query, ct);

        var rows = await query
            .Where(project =>
                project.Status != ProjectStatus.Completed &&
                project.Status != ProjectStatus.Cancelled)
            .OrderByDescending(project =>
                project.Status == ProjectStatus.Delayed ||
                (project.ProgressPercentage < 100 && project.PlannedEndDate < now))
            .ThenByDescending(project => project.AIDelayRiskScore)
            .ThenBy(project => project.PlannedEndDate)
            .Take(take)
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.Priority,
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                project.PlannedEndDate
            })
            .ToListAsync(ct);

        if (rows.Count == 0)
        {
            return new List<UrgentProjectDto>();
        }

        var projectIds = rows.Select(row => row.Id).ToList();
        var taskCounts = await db.Tasks
            .AsNoTracking()
            .Where(task =>
                projectIds.Contains(task.ProjectId) &&
                task.ParentTaskId == null &&
                task.Status != TaskStatus.Completed &&
                task.Status != TaskStatus.Cancelled)
            .GroupBy(task => task.ProjectId)
            .Select(group => new
            {
                ProjectId = group.Key,
                Open = group.Count(),
                Overdue = group.Count(task => task.DueDate < now)
            })
            .ToListAsync(ct);
        var countsByProject = taskCounts.ToDictionary(item => item.ProjectId);

        return rows.Select(row =>
        {
            var isDelayed =
                row.Status == ProjectStatus.Delayed ||
                (row.ProgressPercentage < 100 && row.PlannedEndDate < now);
            var daysOverdue = isDelayed && row.PlannedEndDate < now
                ? (int)Math.Floor((now - row.PlannedEndDate).TotalDays)
                : 0;
            countsByProject.TryGetValue(row.Id, out var counts);

            return new UrgentProjectDto(
                row.Id,
                row.ProjectCode,
                row.Name,
                row.Status.ToString(),
                row.Priority.ToString(),
                row.ProgressPercentage,
                ToRiskPercent(row.AIDelayRiskScore),
                ToHealthPercent(row.AIHealthScore),
                row.PlannedEndDate,
                isDelayed,
                daysOverdue,
                counts?.Open ?? 0,
                counts?.Overdue ?? 0);
        }).ToList();
    }

    /// <summary>
    /// Escalated, not-completed tasks in projects the caller can access (same filter as
    /// GET tasks/escalated), newest escalation first.
    /// </summary>
    public static async Task<(int Total, List<EscalationItemDto> Items)> LoadEscalationsAsync(
        ApplicationDbContext db,
        HashSet<Guid> allowedProjectIds,
        int limit,
        CancellationToken ct)
    {
        var take = Math.Clamp(limit, 1, 50);

        var query = db.Tasks
            .AsNoTracking()
            .Where(task =>
                allowedProjectIds.Contains(task.ProjectId) &&
                task.IsEscalated &&
                task.Status != TaskStatus.Completed);

        var total = await query.CountAsync(ct);
        if (total == 0)
        {
            return (0, new List<EscalationItemDto>());
        }

        var rows = await query
            .OrderByDescending(task => task.ModifiedDate ?? task.CreatedDate)
            .Take(take)
            .Select(task => new
            {
                task.Id,
                task.Title,
                task.Status,
                task.Priority,
                task.ProjectId,
                ProjectName = task.Project != null ? task.Project.Name : null,
                task.AssignedToUserId,
                task.DueDate,
                task.EscalationLevel,
                task.EscalatedDate
            })
            .ToListAsync(ct);

        var assigneeIds = rows
            .Where(row => row.AssignedToUserId.HasValue)
            .Select(row => row.AssignedToUserId!.Value)
            .Distinct()
            .ToList();

        var assigneeNames = new Dictionary<Guid, string>();
        if (assigneeIds.Count > 0)
        {
            var users = await db.Users
                .AsNoTracking()
                .Where(user => assigneeIds.Contains(user.Id))
                .Select(user => new { user.Id, user.FirstName, user.LastName })
                .ToListAsync(ct);
            foreach (var user in users)
            {
                assigneeNames[user.Id] = $"{user.FirstName} {user.LastName}".Trim();
            }
        }

        var items = rows.Select(row => new EscalationItemDto(
            row.Id,
            row.Title,
            row.Status.ToString(),
            row.Priority.ToString(),
            row.ProjectId,
            row.ProjectName,
            row.AssignedToUserId,
            row.AssignedToUserId.HasValue && assigneeNames.TryGetValue(row.AssignedToUserId.Value, out var name)
                ? name
                : null,
            row.DueDate,
            row.EscalationLevel,
            row.EscalatedDate)).ToList();

        return (total, items);
    }

    /// <summary>
    /// Team activity for the last <paramref name="days"/> UTC days (today included), scoped to
    /// the same users as GET activitylogs/team. Every day in the range is returned, including
    /// days with no activity, so charts need no gap handling.
    /// </summary>
    public static async Task<List<ActivityDayDto>> LoadTeamActivityAsync(
        ApplicationDbContext db,
        RoleScopeService scope,
        int days,
        CancellationToken ct)
    {
        var dayCount = Math.Clamp(days, 1, 31);
        var today = DateTime.UtcNow.Date;
        var since = today.AddDays(-(dayCount - 1));

        var scopedUsers = await scope.ScopeUsersAsync(db.Users.AsQueryable(), ct);
        var teamUserIds = await scopedUsers.Select(user => user.Id).ToListAsync(ct);

        // Bounded read, bucketed in memory so grouping behaves the same on every database provider.
        var rows = await db.ActivityLogs
            .AsNoTracking()
            .Where(log => teamUserIds.Contains(log.UserId) && log.Timestamp >= since)
            .OrderByDescending(log => log.Timestamp)
            .Select(log => new { log.Timestamp, log.ActivityType })
            .Take(20000)
            .ToListAsync(ct);

        var byDay = rows
            .GroupBy(row => DateOnly.FromDateTime(row.Timestamp))
            .ToDictionary(group => group.Key, group => group.ToList());

        var result = new List<ActivityDayDto>(dayCount);
        for (var offset = 0; offset < dayCount; offset++)
        {
            var date = DateOnly.FromDateTime(since.AddDays(offset));
            if (!byDay.TryGetValue(date, out var dayRows))
            {
                result.Add(new ActivityDayDto(date, 0, new List<ActivityTypeCountDto>()));
                continue;
            }

            var byType = dayRows
                .GroupBy(row => string.IsNullOrWhiteSpace(row.ActivityType) ? "Other" : row.ActivityType)
                .Select(group => new ActivityTypeCountDto(group.Key, group.Count()))
                .OrderByDescending(item => item.Count)
                .ThenBy(item => item.Type, StringComparer.Ordinal)
                .Take(5)
                .ToList();

            result.Add(new ActivityDayDto(date, dayRows.Count, byType));
        }

        return result;
    }
}
