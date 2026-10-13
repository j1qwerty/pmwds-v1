using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PMWDS.Application.DTOs.Controllers;
using PMWDS.Application.Exceptions;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Services;

public sealed class TaskWorkflowService : ITaskWorkflowService
{
    private readonly ApplicationDbContext _db;
    private readonly IUnitOfWork _uow;
    private readonly IProjectRepository _projects;
    private readonly ITaskRepository _tasks;
    private readonly IRepository<Milestone> _milestones;
    private readonly RoleScopeService _scope;
    private readonly IMemoryCache _cache;
    private readonly ICurrentUserService _currentUser;

    public TaskWorkflowService(
        ApplicationDbContext db,
        IUnitOfWork uow,
        IProjectRepository projects,
        ITaskRepository tasks,
        IRepository<Milestone> milestones,
        RoleScopeService scope,
        ICurrentUserService currentUser,
        IMemoryCache cache)
    {
        _db = db;
        _uow = uow;
        _projects = projects;
        _tasks = tasks;
        _milestones = milestones;
        _scope = scope;
        _cache = cache;
        _currentUser = currentUser;
    }

    public async Task RecalculateTaskMilestoneAsync(ProjectTask task, CancellationToken ct)
    {
        if (!task.MilestoneId.HasValue) return;
        // SQL Server is configured with EnableRetryOnFailure, whose execution strategy
        // forbids user-initiated transactions started outside it. Run the whole unit of
        // work inside the strategy so a transient failure retries the transaction as one
        // unit instead of throwing InvalidOperationException. _uow wraps this same scoped
        // DbContext, so the strategy and the transaction share a connection.
        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await _uow.BeginTransactionAsync(ct);
            try
            {
                var milestone = await _db.Milestones
                    .Include(m => m.Tasks)
                    .FirstOrDefaultAsync(m => m.Id == task.MilestoneId.Value, ct);
                if (milestone == null)
                {
                    await _uow.RollbackTransactionAsync(ct);
                    return;
                }

                milestone.RecalculateProgressFromTasks();
                milestone.RecalculateStatusFromTasks();
                milestone.SetModified(_currentUser.UserId ?? "system");
                await _milestones.UpdateAsync(milestone, ct);
                await _uow.SaveChangesAsync(ct);

                await RecalculateProjectFromMilestonesAsync(milestone.ProjectId, ct);
                await _uow.CommitTransactionAsync(ct);
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }
        });
    }

    public async Task ApplyStatusChangeAsync(ProjectTask task, UpdateTaskStatusRequest req, CancellationToken ct)
    {
        if (req.NewStatus == PMWDS.Domain.Enums.TaskStatus.NotStarted
            && task.ProgressPercentage > 0
            && !req.ConfirmReset)
        {
            throw new ConflictException(
                $"Task '{task.Title}' currently has {Math.Round(task.ProgressPercentage)}% progress. " +
                "Switching to Not Started will reset this task and all of its subtasks to 0% progress. " +
                "Re-submit with confirmReset=true to proceed.");
        }

        task.UpdateStatus(req.NewStatus);

        if (req.NewStatus == PMWDS.Domain.Enums.TaskStatus.NotStarted
            && req.ConfirmReset)
        {
            task.ResetAllProgress();
        }
        else if (req.NewStatus == PMWDS.Domain.Enums.TaskStatus.Completed)
        {
            task.MarkSubtaskCompleted();
        }

        // Same execution-strategy requirement as above: this transaction must run inside
        // CreateExecutionStrategy so SQL Server's retry policy does not reject it.
        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await _uow.BeginTransactionAsync(ct);
            try
            {
                task.SetModified(_currentUser.UserId ?? "system");
                await _tasks.UpdateAsync(task, ct);
                await _uow.SaveChangesAsync(ct);

                if (task.ParentTaskId.HasValue)
                {
                    var parent = await _tasks.GetWithDetailsAsync(task.ParentTaskId.Value, ct);
                    if (parent != null)
                    {
                        parent.RecalculateProgressFromSubtasks();
                        if (parent.ProgressPercentage >= 100)
                        {
                            parent.MarkSubtaskCompleted();
                        }
                        parent.SetModified(_currentUser.UserId ?? "system");
                        await _uow.SaveChangesAsync(ct);
                    }
                }

                await _uow.CommitTransactionAsync(ct);
            }
            catch
            {
                await _uow.RollbackTransactionAsync(ct);
                throw;
            }
        });
    }

    public async Task<bool> CanAccessTaskAsync(Guid taskId, CancellationToken ct)
    {
        var task = await _db.Tasks
            .Where(item => item.Id == taskId)
            .Select(item => new { item.ProjectId, item.MilestoneId })
            .FirstOrDefaultAsync(ct);
        if (task == null) return false;

        var departmentId = task.MilestoneId.HasValue
            ? await _db.Milestones
                .Where(milestone => milestone.Id == task.MilestoneId.Value)
                .Select(milestone => milestone.DepartmentId)
                .FirstOrDefaultAsync(ct)
            : await _db.Projects
                .Where(project => project.Id == task.ProjectId)
                .Select(project => (Guid?)project.DepartmentId)
                .FirstOrDefaultAsync(ct);

        return await _scope.CanAccessProjectDataAsync(
            task.ProjectId,
            departmentId,
            ct,
            PMWDS.Application.Security.PermissionCodes.TaskOwnView,
            PMWDS.Application.Security.PermissionCodes.TaskAllView,
            PMWDS.Application.Security.PermissionCodes.TaskOwnManage,
            PMWDS.Application.Security.PermissionCodes.TaskAllManage);
    }

    public async Task<bool> CanManageTaskAsync(Guid taskId, CancellationToken ct)
    {
        var task = await _db.Tasks
            .Where(item => item.Id == taskId)
            .Select(item => new { item.ProjectId, item.MilestoneId })
            .FirstOrDefaultAsync(ct);
        if (task == null) return false;

        var departmentId = task.MilestoneId.HasValue
            ? await _db.Milestones
                .Where(milestone => milestone.Id == task.MilestoneId.Value)
                .Select(milestone => milestone.DepartmentId)
                .FirstOrDefaultAsync(ct)
            : await _db.Projects
                .Where(project => project.Id == task.ProjectId)
                .Select(project => (Guid?)project.DepartmentId)
                .FirstOrDefaultAsync(ct);

        return await _scope.CanAccessProjectDataAsync(
            task.ProjectId,
            departmentId,
            ct,
            PMWDS.Application.Security.PermissionCodes.TaskOwnEdit,
            PMWDS.Application.Security.PermissionCodes.TaskAllEdit,
            PMWDS.Application.Security.PermissionCodes.TaskOwnManage,
            PMWDS.Application.Security.PermissionCodes.TaskAllManage);
    }

    public async Task<bool> CanWorkOnTaskAsync(Guid taskId, CancellationToken ct)
    {
        var currentUserId = Guid.TryParse(_currentUser.UserId, out var parsedCurrentUserId)
            ? parsedCurrentUserId
            : (Guid?)null;
        var task = await _db.Tasks
            .Where(item => item.Id == taskId)
            .Select(item => new
            {
                item.ProjectId,
                item.AssignedToUserId,
                HasAssignment = currentUserId != null && item.Assignments.Any(assignment => assignment.UserId == currentUserId)
            })
            .FirstOrDefaultAsync(ct);

        if (task == null)
        {
            return false;
        }

        if (await _scope.CanManageProjectAsync(task.ProjectId, ct))
        {
            return true;
        }

        return currentUserId.HasValue &&
            (task.AssignedToUserId == currentUserId || task.HasAssignment);
    }

    public async Task<bool> CanCreateSubtaskAsync(Guid parentTaskId, CancellationToken ct)
    {
        // Nullable value types do not narrow on a null comparison, so unwrap by pattern.
        if (await LoadScopeAsync(parentTaskId, ct) is not { } scope) return false;

        return await _scope.CanCreateProjectChildAsync(
            scope.ProjectId,
            scope.DepartmentId,
            ct,
            PermissionCodes.SubtaskOwnCreate,
            PermissionCodes.SubtaskAllCreate,
            PermissionCodes.SubtaskOwnManage,
            PermissionCodes.SubtaskAllManage);
    }

    public async Task<bool> CanModifySubtaskAsync(Guid subtaskId, CancellationToken ct)
    {
        if (await LoadScopeAsync(subtaskId, ct) is not { } scope) return false;

        if (await _scope.CanModifyProjectChildAsync(
                scope.ProjectId,
                scope.DepartmentId,
                ct,
                PermissionCodes.SubtaskOwnEdit,
                PermissionCodes.SubtaskAllEdit,
                PermissionCodes.SubtaskOwnManage,
                PermissionCodes.SubtaskAllManage))
        {
            return true;
        }

        // Someone with no Subtask grant can still work on a subtask assigned to them - or
        // on one under a task assigned to them. Without this the assignee of the *parent*
        // task could not touch their own subtasks at all.
        return await IsAssignedToTaskOrItsParentAsync(subtaskId, ct);
    }

    public async Task<bool> CanWorkOnSubtaskAsync(Guid subtaskId, CancellationToken ct)
    {
        return await CanModifySubtaskAsync(subtaskId, ct);
    }

    /// <summary>
    /// The project and department a task belongs to, used for department-scoped checks.
    /// The milestone's department wins over the project's, because that is the department
    /// actually doing the work on a cross-department project.
    /// </summary>
    private async Task<(Guid ProjectId, Guid? DepartmentId)?> LoadScopeAsync(
        Guid taskId,
        CancellationToken ct)
    {
        var task = await _db.Tasks
            .Where(item => item.Id == taskId)
            .Select(item => new { item.ProjectId, item.MilestoneId })
            .FirstOrDefaultAsync(ct);

        if (task == null) return null;

        var departmentId = task.MilestoneId.HasValue
            ? await _db.Milestones
                .Where(milestone => milestone.Id == task.MilestoneId.Value)
                .Select(milestone => milestone.DepartmentId)
                .FirstOrDefaultAsync(ct)
            : await _db.Projects
                .Where(project => project.Id == task.ProjectId)
                .Select(project => (Guid?)project.DepartmentId)
                .FirstOrDefaultAsync(ct);

        return (task.ProjectId, departmentId);
    }

    /// <summary>
    /// True when the caller is assigned to the task, or to the parent task when the task is
    /// a subtask. Subtasks are normally assigned independently, but a member who owns the
    /// parent task has to be able to work through its subtasks too.
    /// </summary>
    private async Task<bool> IsAssignedToTaskOrItsParentAsync(Guid taskId, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var currentUserId))
        {
            return false;
        }

        return await _db.Tasks
            .Where(item => item.Id == taskId)
            .AnyAsync(item =>
                item.AssignedToUserId == currentUserId ||
                item.Assignments.Any(assignment => assignment.UserId == currentUserId) ||
                (item.ParentTaskId.HasValue && _db.Tasks.Any(parent =>
                    parent.Id == item.ParentTaskId.Value &&
                    (parent.AssignedToUserId == currentUserId ||
                     parent.Assignments.Any(assignment => assignment.UserId == currentUserId)))),
                ct);
    }

    public async Task<HashSet<Guid>> GetAccessibleProjectIdsAsync(CancellationToken ct)
    {
        if (_currentUser.UserId is not { } userId)
        {
            return [];
        }

        var cacheKey = $"pmwds:accessible-project-ids:{userId}";
        if (_cache.TryGetValue(cacheKey, out HashSet<Guid>? cachedProjectIds))
        {
            return new HashSet<Guid>(cachedProjectIds!);
        }

        var scopedProjects = await _scope.ScopeProjectsAsync(
            _db.Projects.AsNoTracking(),
            ct);
        var projectIds = (await scopedProjects
            .Select(project => project.Id)
            .ToListAsync(ct))
            .ToHashSet();

        _cache.Set(cacheKey, projectIds, TimeSpan.FromSeconds(5));
        return new HashSet<Guid>(projectIds);
    }

    public async Task<bool> IsUserInProjectOrganizationAsync(string userId, Guid projectId, CancellationToken ct)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return false;
        }

        var organizationIds = await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => new
            {
                PrimaryOrganizationId = project.Department != null ? project.Department.OrganizationId : null,
                AssignedOrganizationIds = project.ProjectDepartments
                    .Where(assignment => assignment.Department != null && assignment.Department.OrganizationId.HasValue)
                    .Select(assignment => assignment.Department!.OrganizationId!.Value)
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (organizationIds == null)
        {
            return false;
        }

        var validOrganizationIds = organizationIds.AssignedOrganizationIds.ToHashSet();
        if (organizationIds.PrimaryOrganizationId.HasValue)
        {
            validOrganizationIds.Add(organizationIds.PrimaryOrganizationId.Value);
        }

        if (validOrganizationIds.Count == 0)
        {
            return false;
        }

        return await _db.Users.AnyAsync(user =>
            user.Id == parsedUserId &&
            ((user.OrganizationId.HasValue && validOrganizationIds.Contains(user.OrganizationId.Value)) ||
             user.DepartmentAssignments.Any(assignment =>
                assignment.Department != null &&
                assignment.Department.OrganizationId.HasValue &&
                validOrganizationIds.Contains(assignment.Department.OrganizationId.Value)) ||
             user.Department != null &&
                user.Department.OrganizationId.HasValue &&
                validOrganizationIds.Contains(user.Department.OrganizationId.Value)),
            ct);
    }

    public async Task<string> ResolveProjectNameAsync(Guid projectId, CancellationToken ct)
    {
        if (projectId == Guid.Empty) return "Unknown Project";
        var name = await _db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(ct);
        return name ?? "Unknown Project";
    }

    private async Task RecalculateProjectFromMilestonesAsync(Guid projectId, CancellationToken ct)
    {
        var project = await _db.Projects
            .Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) return;
        project.RecalculateProgressFromMilestones();
        project.RecalculateStatusFromMilestones();
        project.SetModified(_currentUser.UserId ?? "system");
        await _projects.UpdateAsync(project, ct);
        await _uow.SaveChangesAsync(ct);
    }
}
