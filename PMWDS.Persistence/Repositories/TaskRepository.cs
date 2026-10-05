using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;
namespace PMWDS.Persistence.Repositories;

public class TaskRepository
 : EfRepository<ProjectTask>, ITaskRepository
{
    public TaskRepository(ApplicationDbContext ctx)
    : base(ctx) { }
    public async Task<ProjectTask?> GetWithDetailsAsync(
    Guid taskId, CancellationToken ct = default)
    => await _dbSet
    .Include(t => t.SubTasks)
        .ThenInclude(st => st.Assignments)
    .Include(t => t.SubTasks)
        .ThenInclude(st => st.Comments)
    .Include(t => t.SubTasks)
        .ThenInclude(st => st.Attachments)
    .Include(t => t.SubTasks)
        .ThenInclude(st => st.Dependencies)
    .Include(t => t.Comments)
    .Include(t => t.Attachments)
    .Include(t => t.Dependencies)
        .ThenInclude(d => d.PredecessorTask)
    .Include(t => t.Assignments)
    .Include(t => t.Project)
    .Include(t => t.Milestone)
    .AsSplitQuery()
    .FirstOrDefaultAsync(t => t.Id == taskId, ct);
    public async Task<IEnumerable<ProjectTask>>
    GetByProjectAsync(
    Guid projectId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => t.ProjectId == projectId)
    .Include(t => t.Assignments)
    .Include(t => t.SubTasks)
    .Include(t => t.Comments)
    .Include(t => t.Attachments)
    .Include(t => t.Dependencies)
    .Include(t => t.Project)
    .Include(t => t.Milestone)
    .AsSplitQuery()
    .OrderBy(t => t.DueDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetByAssigneeAsync(
    Guid userId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => (t.AssignedToUserId == userId ||
    t.Assignments.Any(a => a.UserId == userId && a.IsActive))
    && t.Status != Domain.Enums.TaskStatus.Completed
    && t.Status != Domain.Enums.TaskStatus.Cancelled)
    .Include(t => t.Assignments)
    .Include(t => t.SubTasks)
    .Include(t => t.Comments)
    .Include(t => t.Attachments)
    .Include(t => t.Dependencies)
    .Include(t => t.Project)
    .Include(t => t.Milestone)
    .AsSplitQuery()
    .OrderBy(t => t.DueDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetOverdueTasksAsync(
    CancellationToken ct = default)
    => await _dbSet
    .Where(t =>
    t.DueDate < DateTime.UtcNow
    && t.Status != Domain.Enums.TaskStatus.Completed
    && t.Status != Domain.Enums.TaskStatus.Cancelled)
    .Include(t => t.Project)
    .AsSplitQuery()
    .OrderBy(t => t.DueDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetByMilestoneAsync(
    Guid milestoneId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => t.MilestoneId == milestoneId)
    .OrderBy(t => t.DueDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetUnassignedTasksAsync(
    CancellationToken ct = default)
    => await _dbSet
    .Where(t =>
    t.AssignedToUserId == null
    && t.Status == Domain.Enums.TaskStatus.NotStarted)
    .Include(t => t.Project)
    .AsSplitQuery()
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetHighRiskTasksAsync(
    double threshold = 0.7,
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => t.AIDelayProbability >= threshold)
    .Include(t => t.Project)
    .AsSplitQuery()
    .OrderByDescending(t => t.AIDelayProbability)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetEscalatedTasksAsync(
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => t.IsEscalated
    && t.Status != Domain.Enums.TaskStatus.Completed)
    .Include(t => t.Project)
    .AsSplitQuery()
    .OrderByDescending(t => t.EscalationLevel)
    .ToListAsync(ct);
    public async Task<IEnumerable<ProjectTask>>
    GetSubtasksByParentIdAsync(
    Guid parentTaskId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(t => t.ParentTaskId == parentTaskId)
    .Include(t => t.Assignments)
    .Include(t => t.Comments)
    .Include(t => t.Attachments)
    .Include(t => t.Dependencies)
        .ThenInclude(d => d.PredecessorTask)
    .Include(t => t.Project)
    .Include(t => t.Milestone)
    .AsSplitQuery()
    .OrderBy(t => t.DueDate)
    .ToListAsync(ct);

    public async Task<IEnumerable<TaskDependency>> GetDependenciesForTaskAsync(
    Guid taskId,
    CancellationToken ct = default)
    => await _context.TaskDependencies
    .Where(d => d.PredecessorTaskId == taskId || d.SuccessorTaskId == taskId)
    .Include(d => d.PredecessorTask)
    .Include(d => d.SuccessorTask)
    .OrderBy(d => d.CreatedDate)
    .ToListAsync(ct);

    public async Task DeleteTaskGraphAsync(
    Guid taskId,
    CancellationToken ct = default)
    {
        var taskIds = await GetTaskGraphIdsAsync(new[] { taskId }, ct);
        if (taskIds.Count == 0) return;
        await DeleteTaskGraphsByIdsAsync(taskIds, ct);
    }

    public async Task DeleteTasksByMilestoneAsync(
    Guid milestoneId,
    CancellationToken ct = default)
    {
        var rootIds = await _dbSet
        .Where(t => t.MilestoneId == milestoneId)
        .Select(t => t.Id)
        .ToListAsync(ct);
        var taskIds = await GetTaskGraphIdsAsync(rootIds, ct);
        await DeleteTaskGraphsByIdsAsync(taskIds, ct);
    }

    public async Task DeleteTasksByProjectAsync(
    Guid projectId,
    CancellationToken ct = default)
    {
        var rootIds = await _dbSet
        .Where(t => t.ProjectId == projectId)
        .Select(t => t.Id)
        .ToListAsync(ct);
        var taskIds = await GetTaskGraphIdsAsync(rootIds, ct);
        await DeleteTaskGraphsByIdsAsync(taskIds, ct);
    }

    private async Task<HashSet<Guid>> GetTaskGraphIdsAsync(
    IEnumerable<Guid> rootIds,
    CancellationToken ct)
    {
        var taskIds = rootIds.Where(id => id != Guid.Empty).ToHashSet();
        var frontier = taskIds.ToList();

        while (frontier.Count > 0)
        {
            var children = await _dbSet
            .Where(t => t.ParentTaskId.HasValue && frontier.Contains(t.ParentTaskId.Value))
            .Select(t => t.Id)
            .ToListAsync(ct);

            frontier = children.Where(taskIds.Add).ToList();
        }

        return taskIds;
    }

    private async Task DeleteTaskGraphsByIdsAsync(
    HashSet<Guid> taskIds,
    CancellationToken ct)
    {
        if (taskIds.Count == 0) return;

        var dependencies = await _context.TaskDependencies
        .Where(d => taskIds.Contains(d.PredecessorTaskId) || taskIds.Contains(d.SuccessorTaskId))
        .ToListAsync(ct);
        _context.TaskDependencies.RemoveRange(dependencies);

        // Utilization certificates link optionally to the task whose delivery they
        // certify. The link is informational: an approved financial certificate must
        // outlive the work item it paid for, so it is detached rather than deleted.
        //
        // This cannot be left to the database. The TaskId foreign key is ON DELETE SET NULL
        // on SQLite, but that is impossible on SQL Server - Tasks cascade from Projects,
        // and Projects already reaches UtilizationCertificates through ProjectDocuments,
        // so a second cascade path makes SQL Server reject the table (it permits one per
        // table). Unlinking here means both providers behave identically, and covers every
        // task-deletion path because all of them funnel through this method.
        var certificates = await _context.UtilizationCertificates
        .Where(c => c.TaskId.HasValue && taskIds.Contains(c.TaskId.Value))
        .ToListAsync(ct);
        foreach (var certificate in certificates)
        {
            certificate.UnlinkTask();
        }

        var tasks = await _dbSet
        .Where(t => taskIds.Contains(t.Id))
        .OrderByDescending(t => t.ParentTaskId.HasValue)
        .ToListAsync(ct);
        _dbSet.RemoveRange(tasks);
    }
}
