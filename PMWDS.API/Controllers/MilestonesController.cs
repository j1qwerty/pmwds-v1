using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Notifications;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Exceptions;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class MilestonesController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;
    private readonly INotificationService _notifications;
    private readonly ICurrentUserService _currentUser;
    private readonly IDataChangeNotifier _changes;

    public MilestonesController(IMediator mediator, IUnitOfWork uow, ApplicationDbContext db, RoleScopeService scope, INotificationService notifications, ICurrentUserService currentUser, IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _db = db;
        _scope = scope;
        _notifications = notifications;
        _currentUser = currentUser;
        _changes = changes;
    }

    // ── Milestone Dependency Endpoints ──────────────────────────────────

    [HttpGet("by-project/{projectId:guid}/dependencies")]
    public async Task<IActionResult> GetDependenciesByProject(Guid projectId, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
            return Forbid();

        var depsQuery = _db.MilestoneDependencies
            .Include(d => d.PrerequisiteMilestone)
            .Include(d => d.DependentMilestone)
            .Where(d => d.ProjectId == projectId);

        if (!_scope.IsDirector && !_scope.IsSuperAdmin && _scope.IsDepartmentHead)
        {
            var departmentIds = await _scope.GetDepartmentIdsAsync(ct);
            if (!await _scope.CanAccessProjectAsPrimaryDepartmentAsync(projectId, ct))
            {
                depsQuery = depsQuery.Where(d =>
                    (d.PrerequisiteMilestone != null &&
                        d.PrerequisiteMilestone.DepartmentId.HasValue &&
                        departmentIds.Contains(d.PrerequisiteMilestone.DepartmentId.Value)) ||
                    (d.DependentMilestone != null &&
                        d.DependentMilestone.DepartmentId.HasValue &&
                        departmentIds.Contains(d.DependentMilestone.DepartmentId.Value)));
            }
        }

        var deps = await depsQuery.ToListAsync(ct);
        return Ok(deps.Select(MilestoneDependencyDto.FromEntity));
    }

    [HttpPost("dependencies")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesEdit)]
    public async Task<IActionResult> CreateDependency([FromBody] CreateMilestoneDependencyDto dto, CancellationToken ct)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == dto.ProjectId, ct);
        if (project == null)
            return NotFound(new { message = "Project not found" });

        if (!await _scope.CanModifyProjectChildAsync(dto.ProjectId, null, ct,
            PermissionCodes.MilestoneOwnEdit, PermissionCodes.MilestoneAllEdit,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage))
            return Forbid();

        if (dto.PrerequisiteMilestoneId == dto.DependentMilestoneId)
            return BadRequest(new { message = "A milestone cannot depend on itself" });

        var prerequisiteExists = await _db.Milestones.AnyAsync(m => m.Id == dto.PrerequisiteMilestoneId && m.ProjectId == dto.ProjectId, ct);
        if (!prerequisiteExists)
            return BadRequest(new { message = "Prerequisite milestone not found in this project" });

        var dependentExists = await _db.Milestones.AnyAsync(m => m.Id == dto.DependentMilestoneId && m.ProjectId == dto.ProjectId, ct);
        if (!dependentExists)
            return BadRequest(new { message = "Dependent milestone not found in this project" });

        var duplicate = await _db.MilestoneDependencies.AnyAsync(d =>
            d.PrerequisiteMilestoneId == dto.PrerequisiteMilestoneId &&
            d.DependentMilestoneId == dto.DependentMilestoneId &&
            d.ProjectId == dto.ProjectId, ct);
        if (duplicate)
            return BadRequest(new { message = "This dependency already exists" });

        // Circular dependency check: if B depends on A, A cannot depend on B
        var reverseExists = await _db.MilestoneDependencies.AnyAsync(d =>
            d.PrerequisiteMilestoneId == dto.DependentMilestoneId &&
            d.DependentMilestoneId == dto.PrerequisiteMilestoneId &&
            d.ProjectId == dto.ProjectId, ct);
        if (reverseExists)
            return BadRequest(new { message = "Circular dependency detected" });

        if (!Enum.TryParse<MilestoneDependencyType>(dto.Type, ignoreCase: true, out var depType))
            return BadRequest(new { message = "Invalid dependency type. Valid values: CompletionBased, ProgressThreshold" });

        if (depType == MilestoneDependencyType.ProgressThreshold && (dto.ThresholdPercentage == null || dto.ThresholdPercentage < 0 || dto.ThresholdPercentage > 100))
            return BadRequest(new { message = "Threshold percentage must be between 0 and 100 for ProgressThreshold type" });

        var dep = MilestoneDependency.Create(
            dto.ProjectId,
            dto.PrerequisiteMilestoneId,
            dto.DependentMilestoneId,
            depType,
            dto.ThresholdPercentage);
        dep.SetCreatedBy("system");

        await _uow.MilestoneDependencies.AddAsync(dep, ct);
        await _uow.SaveChangesAsync(ct);

        var loaded = await _db.MilestoneDependencies
            .Include(d => d.PrerequisiteMilestone)
            .Include(d => d.DependentMilestone)
            .FirstAsync(d => d.Id == dep.Id, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Dependency Added",
            Description: $"{CurrentUserName} added dependency: \"{loaded.PrerequisiteMilestone?.Name}\" must precede \"{loaded.DependentMilestone?.Name}\" in project \"{loaded.Project?.Name ?? await ResolveProjectNameAsync(dto.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["dependencyId"] = dep.Id,
                ["prerequisiteMilestoneId"] = dto.PrerequisiteMilestoneId,
                ["prerequisiteMilestoneName"] = loaded.PrerequisiteMilestone?.Name ?? "",
                ["dependentMilestoneId"] = dto.DependentMilestoneId,
                ["dependentMilestoneName"] = loaded.DependentMilestone?.Name ?? "",
                ["projectId"] = dto.ProjectId,
                ["type"] = dto.Type
            },
            ProjectId: dto.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, dep.Id.ToString(), dto.ProjectId, ct);

        return Ok(MilestoneDependencyDto.FromEntity(loaded));
    }

    [HttpPut("dependencies/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesEdit)]
    public async Task<IActionResult> UpdateDependency(Guid id, [FromBody] UpdateMilestoneDependencyDto dto, CancellationToken ct)
    {
        var dep = await _db.MilestoneDependencies
            .Include(d => d.PrerequisiteMilestone)
            .Include(d => d.DependentMilestone)
            .FirstOrDefaultAsync(d => d.Id == id, ct);
        if (dep == null)
            return NotFound();

        if (!await _scope.CanManageProjectAsync(dep.ProjectId, ct))
            return Forbid();

        if (!Enum.TryParse<MilestoneDependencyType>(dto.Type, ignoreCase: true, out var depType))
            return BadRequest(new { message = "Invalid dependency type" });

        if (depType == MilestoneDependencyType.ProgressThreshold && (dto.ThresholdPercentage == null || dto.ThresholdPercentage < 0 || dto.ThresholdPercentage > 100))
            return BadRequest(new { message = "Threshold percentage must be between 0 and 100" });

        dep.Update(depType, dto.ThresholdPercentage);
        dep.SetModified("system");

        await _uow.MilestoneDependencies.UpdateAsync(dep, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Dependency Updated",
            Description: $"{CurrentUserName} updated dependency between \"{dep.PrerequisiteMilestone?.Name}\" and \"{dep.DependentMilestone?.Name}\" in project \"{dep.Project?.Name ?? await ResolveProjectNameAsync(dep.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["dependencyId"] = id,
                ["prerequisiteMilestoneId"] = dep.PrerequisiteMilestoneId,
                ["prerequisiteMilestoneName"] = dep.PrerequisiteMilestone?.Name ?? "",
                ["dependentMilestoneId"] = dep.DependentMilestoneId,
                ["dependentMilestoneName"] = dep.DependentMilestone?.Name ?? "",
                ["projectId"] = dep.ProjectId,
                ["type"] = dto.Type
            },
            ProjectId: dep.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, id.ToString(), dep.ProjectId, ct);

        return Ok(MilestoneDependencyDto.FromEntity(dep));
    }

    [HttpDelete("dependencies/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesDelete)]
    public async Task<IActionResult> DeleteDependency(Guid id, CancellationToken ct)
    {
        var dep = await _db.MilestoneDependencies
            .Include(d => d.PrerequisiteMilestone)
            .Include(d => d.DependentMilestone)
            .FirstOrDefaultAsync(d => d.Id == id, ct);
        if (dep == null)
            return NotFound();

        if (!await _scope.CanManageProjectAsync(dep.ProjectId, ct))
            return Forbid();

        var prereqName = dep.PrerequisiteMilestone?.Name ?? "Unknown";
        var depName = dep.DependentMilestone?.Name ?? "Unknown";
        var projectId = dep.ProjectId;

        await _uow.MilestoneDependencies.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Dependency Removed",
            Description: $"{CurrentUserName} removed dependency between \"{prereqName}\" and \"{depName}\" from project \"{await ResolveProjectNameAsync(projectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["dependencyId"] = id,
                ["prerequisiteMilestoneName"] = prereqName,
                ["dependentMilestoneName"] = depName,
                ["projectId"] = projectId
            },
            ProjectId: projectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, id.ToString(), projectId, ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/dependency-status")]
    public async Task<IActionResult> GetDependencyStatus(Guid id, CancellationToken ct)
    {
        var milestone = await _db.Milestones
            .Include(m => m.DependentDependencies)
                .ThenInclude(d => d.PrerequisiteMilestone)
            .FirstOrDefaultAsync(m => m.Id == id, ct);
        if (milestone == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(milestone.ProjectId, ct))
            return Forbid();

        var deps = milestone.DependentDependencies.Select(MilestoneDependencyDto.FromEntity).ToList();
        return Ok(new
        {
            isBlocked = milestone.IsBlocked,
            blockedByMessage = milestone.BlockedByMessage,
            dependencies = deps
        });
    }

    [HttpGet("by-project/{projectId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesView)]
    public async Task<IActionResult> GetByProject(Guid projectId, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
        {
            return Forbid();
        }

        var query = _db.Milestones
            .Include(m => m.Department)
            .Include(m => m.DependentDependencies)
                .ThenInclude(d => d.PrerequisiteMilestone)
            .Where(m => m.ProjectId == projectId);

        if (!await _scope.CanSeeFullProjectDetailsAsync(projectId, ct))
        {
            var departmentIds = await _scope.GetDepartmentIdsAsync(ct);
            query = query.Where(m => m.DepartmentId.HasValue && departmentIds.Contains(m.DepartmentId.Value));
        }

        var milestones = await query
            .Include(m => m.Tasks)
            .ToListAsync(ct);
        return Ok(milestones.Select(MilestoneDto.FromEntity));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesView)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var milestone = await _db.Milestones
            .Include(m => m.Tasks)
            .Include(m => m.Department)
            .FirstOrDefaultAsync(m => m.Id == id, ct);
        if (milestone == null)
        {
            return NotFound();
        }

        if (!await _scope.CanAccessProjectAsync(milestone.ProjectId, ct))
        {
            return Forbid();
        }
        if (!await CanAccessMilestoneAsync(milestone, ct))
        {
            return Forbid();
        }

        return Ok(MilestoneDto.FromEntity(milestone));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.MilestonesCreate)]
    public async Task<IActionResult> Create([FromBody] CreateMilestoneDto dto, CancellationToken ct)
    {
        if (!await _scope.CanCreateProjectChildAsync(dto.ProjectId, dto.DepartmentId, ct,
            PermissionCodes.MilestoneOwnCreate, PermissionCodes.MilestoneAllCreate,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage))
        {
            return Forbid();
        }

        if (dto.DepartmentId.HasValue && !await IsDepartmentAssignedToProjectAsync(dto.ProjectId, dto.DepartmentId.Value, ct))
        {
            return BadRequest(new { message = "Milestone department must be assigned to the project." });
        }

        var milestone = Milestone.Create(dto.ProjectId, dto.Name, dto.Description, dto.DueDate, dto.Order, dto.IsCritical, dto.DepartmentId);
        milestone.SetCreatedBy("system");
        await _uow.Milestones.AddAsync(milestone, ct);
        await _uow.SaveChangesAsync(ct);
        await RecalculateProjectFromMilestonesAsync(milestone.ProjectId, ct);
        await SendProjectAssignedNotificationAsync(milestone.ProjectId, dto.DepartmentId, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Created",
            Description: $"{CurrentUserName} created milestone \"{milestone.Name}\" in project \"{await ResolveProjectNameAsync(milestone.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["milestoneId"] = milestone.Id,
                ["milestoneName"] = milestone.Name,
                ["projectId"] = milestone.ProjectId
            },
            ProjectId: milestone.ProjectId
        );

        // Milestone counts roll up into the project, so both scopes must refetch.
        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestone.Id.ToString(), milestone.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, milestone.ProjectId.ToString(), milestone.ProjectId, ct);

        return CreatedAtAction(nameof(GetById), new { id = milestone.Id }, MilestoneDto.FromEntity(milestone));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesEdit)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateMilestoneDto dto, CancellationToken ct)
    {
        var milestone = await _db.Milestones
            .Include(m => m.Tasks)
            .Include(m => m.Department)
            .FirstOrDefaultAsync(m => m.Id == id, ct);
        if (milestone == null)
        {
            return NotFound();
        }

        if (!await _scope.CanModifyProjectChildAsync(milestone.ProjectId, milestone.DepartmentId, ct,
            PermissionCodes.MilestoneOwnEdit, PermissionCodes.MilestoneAllEdit,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage))
        {
            return Forbid();
        }
        if (!await CanAccessMilestoneAsync(milestone, ct))
        {
            return Forbid();
        }

        if (dto.DepartmentId.HasValue && !await IsDepartmentAssignedToProjectAsync(milestone.ProjectId, dto.DepartmentId.Value, ct))
        {
            return BadRequest(new { message = "Milestone department must be assigned to the project." });
        }

        milestone.Update(dto.Name, dto.Description, dto.DueDate, dto.Order, dto.IsCritical, dto.DepartmentId);

        if (milestone.Tasks.Count > 0)
        {
            milestone.RecalculateProgressFromTasks();
            milestone.RecalculateStatusFromTasks();
        }
        else
        {
            milestone.UpdateProgress(dto.ProgressPercentage);
        }

        milestone.SetModified("system");
        await _uow.Milestones.UpdateAsync(milestone, ct);
        await _uow.SaveChangesAsync(ct);
        await RecalculateProjectFromMilestonesAsync(milestone.ProjectId, ct);
        var refreshed = await _db.Milestones
            .Include(m => m.Tasks)
            .Include(m => m.Department)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Updated",
            Description: $"{CurrentUserName} updated milestone \"{milestone.Name}\" in project \"{await ResolveProjectNameAsync(milestone.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["milestoneId"] = milestone.Id,
                ["milestoneName"] = milestone.Name,
                ["projectId"] = milestone.ProjectId
            },
            ProjectId: milestone.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestone.Id.ToString(), milestone.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, milestone.ProjectId.ToString(), milestone.ProjectId, ct);

        return Ok(MilestoneDto.FromEntity(refreshed ?? milestone));
    }

    [HttpPatch("{id:guid}/complete")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesEdit)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct, [FromQuery] bool forceComplete = false)
    {
        var milestone = await _db.Milestones
            .Include(m => m.Tasks)
                .ThenInclude(t => t.SubTasks)
            .FirstOrDefaultAsync(m => m.Id == id, ct);
        if (milestone == null)
        {
            return NotFound();
        }

        if (!await _scope.CanModifyProjectChildAsync(milestone.ProjectId, milestone.DepartmentId, ct,
            PermissionCodes.MilestoneOwnEdit, PermissionCodes.MilestoneAllEdit,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage))
        {
            return Forbid();
        }
        if (!await CanAccessMilestoneAsync(milestone, ct))
        {
            return Forbid();
        }

        if (milestone.HasTasks && !milestone.AllTasksCompleted)
        {
            if (forceComplete)
            {
                milestone.CompleteAllTasks();
            }
            else
            {
                return Conflict(new
                {
                    error = $"{milestone.GetIncompleteTaskCount()} task(s) are still not completed. Use forceComplete=true to complete all tasks and subtasks.",
                    incompleteTaskCount = milestone.GetIncompleteTaskCount(),
                    totalTaskCount = milestone.Tasks.Count
                });
            }
        }
        else
        {
            milestone.MarkComplete();
        }

        await _uow.Milestones.UpdateAsync(milestone, ct);
        await _uow.SaveChangesAsync(ct);
        await RecalculateProjectFromMilestonesAsync(milestone.ProjectId, ct);
        var refreshed = await _db.Milestones
            .Include(m => m.Tasks)
            .Include(m => m.Department)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Status Changed",
            Description: $"{CurrentUserName} completed milestone \"{milestone.Name}\" in project \"{await ResolveProjectNameAsync(milestone.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["milestoneId"] = milestone.Id,
                ["milestoneName"] = milestone.Name,
                ["projectId"] = milestone.ProjectId,
                ["newStatus"] = "Completed"
            },
            ProjectId: milestone.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestone.Id.ToString(), milestone.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, milestone.ProjectId.ToString(), milestone.ProjectId, ct);

        return Ok(MilestoneDto.FromEntity(refreshed ?? milestone));
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesEdit)]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetMilestoneStatusDto dto, CancellationToken ct)
    {
        var milestone = await _db.Milestones
            .Include(m => m.Tasks)
                .ThenInclude(t => t.SubTasks)
            .FirstOrDefaultAsync(m => m.Id == id, ct);
        if (milestone == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageProjectAsync(milestone.ProjectId, ct))
        {
            return Forbid();
        }
        if (!await CanAccessMilestoneAsync(milestone, ct))
        {
            return Forbid();
        }

        if (!Enum.TryParse<MilestoneStatus>(dto.Status, ignoreCase: true, out var status))
        {
            return BadRequest(new { error = $"Invalid status: {dto.Status}. Valid values: Pending, InProgress, Completed, Delayed" });
        }

        if (status == MilestoneStatus.Completed && milestone.HasTasks && !milestone.AllTasksCompleted)
        {
            if (dto.ForceComplete)
            {
                milestone.CompleteAllTasks();
            }
            else
            {
                return Conflict(new
                {
                    error = $"{milestone.GetIncompleteTaskCount()} task(s) are still not completed. Use forceComplete=true to complete all tasks and subtasks.",
                    incompleteTaskCount = milestone.GetIncompleteTaskCount(),
                    totalTaskCount = milestone.Tasks.Count
                });
            }
        }
        else
        {
            if (milestone.Tasks.Count > 0)
            {
                milestone.RecalculateProgressFromTasks();
                milestone.RecalculateStatusFromTasks();
            }
            milestone.SetStatus(status);
        }

        milestone.SetModified("system");
        await _uow.Milestones.UpdateAsync(milestone, ct);
        await _uow.SaveChangesAsync(ct);
        await RecalculateProjectFromMilestonesAsync(milestone.ProjectId, ct);
        var refreshed = await _db.Milestones
            .Include(m => m.Tasks)
            .Include(m => m.Department)
            .FirstOrDefaultAsync(m => m.Id == id, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Status Changed",
            Description: $"{CurrentUserName} set milestone \"{milestone.Name}\" to \"{dto.Status}\" in project \"{await ResolveProjectNameAsync(milestone.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["milestoneId"] = milestone.Id,
                ["milestoneName"] = milestone.Name,
                ["projectId"] = milestone.ProjectId,
                ["newStatus"] = dto.Status
            },
            ProjectId: milestone.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestone.Id.ToString(), milestone.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, milestone.ProjectId.ToString(), milestone.ProjectId, ct);

        return Ok(MilestoneDto.FromEntity(refreshed ?? milestone));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.MilestonesDelete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var milestone = await _uow.Milestones.GetByIdAsync(id, ct);
        if (milestone == null)
        {
            return NotFound();
        }

        var projectId = milestone.ProjectId;

        if (!await _scope.CanModifyProjectChildAsync(projectId, milestone.DepartmentId, ct,
            PermissionCodes.MilestoneOwnDelete, PermissionCodes.MilestoneAllDelete,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage))
        {
            return Forbid();
        }
        if (!await CanAccessMilestoneAsync(milestone, ct))
        {
            return Forbid();
        }

        var milestoneName = milestone.Name;

        var deps = await _db.MilestoneDependencies
            .Where(d => d.PrerequisiteMilestoneId == id || d.DependentMilestoneId == id)
            .ToListAsync(ct);
        if (deps.Count > 0)
            _db.MilestoneDependencies.RemoveRange(deps);

        await _uow.Tasks.DeleteTasksByMilestoneAsync(id, ct);

        // A milestone is soft-deleted, so no foreign key fires and nothing at the database level
        // clears the document links. Do it here: the documents themselves are uploaded evidence
        // and must survive, while their link to a milestone that no longer exists must not.
        var milestoneDocuments = await _db.ProjectDocuments
            .Where(document => document.MilestoneId == id)
            .ToListAsync(ct);
        foreach (var document in milestoneDocuments)
        {
            document.UnlinkMilestone();
        }

        await _uow.Milestones.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        await RecalculateProjectFromMilestonesAsync(projectId, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Milestone Deleted",
            Description: $"{CurrentUserName} deleted milestone \"{milestoneName}\" from project \"{await ResolveProjectNameAsync(projectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["milestoneName"] = milestoneName,
                ["projectId"] = projectId
            },
            ProjectId: projectId
        );

        // Deleting a milestone cascades its subtasks.
        await _changes.NotifyAsync(DataChangeScopes.Milestones, id.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, projectId.ToString(), projectId, ct);

        return NoContent();
    }

    private async Task RecalculateProjectFromMilestonesAsync(Guid projectId, CancellationToken ct)
    {
        var project = await _db.Projects
            .Include(p => p.Milestones)
            .FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project == null) return;
        project.RecalculateProgressFromMilestones();
        project.RecalculateStatusFromMilestones();
        project.SetModified("system");
        await _uow.Projects.UpdateAsync(project, ct);
        await _uow.SaveChangesAsync(ct);
    }

    private async Task<List<Milestone>> ScopeMilestonesForCurrentUserAsync(List<Milestone> milestones, CancellationToken ct)
    {
        if (!_scope.IsDepartmentHead || _scope.IsDirector || _scope.IsSuperAdmin)
        {
            return milestones;
        }

        var departmentIds = await _scope.GetDepartmentIdsAsync(ct);
        var projectIds = milestones.Select(m => m.ProjectId).Distinct().ToList();
        var primaryDeptProjectIds = await _db.Projects
            .Where(p => projectIds.Contains(p.Id) && departmentIds.Contains(p.DepartmentId))
            .Select(p => p.Id)
            .ToListAsync(ct);
        var primaryDeptAllowedProjectIds = new HashSet<Guid>();
        foreach (var projectId in primaryDeptProjectIds)
        {
            if (await _scope.CanAccessProjectAsPrimaryDepartmentAsync(projectId, ct))
            {
                primaryDeptAllowedProjectIds.Add(projectId);
            }
        }

        return milestones
            .Where(m => primaryDeptAllowedProjectIds.Contains(m.ProjectId) ||
                        (m.DepartmentId.HasValue && departmentIds.Contains(m.DepartmentId.Value)))
            .ToList();
    }

    private Task<bool> CanAccessMilestoneAsync(Milestone milestone, CancellationToken ct)
        => _scope.CanAccessProjectDataAsync(
            milestone.ProjectId,
            milestone.DepartmentId,
            ct,
            PermissionCodes.MilestoneOwnView,
            PermissionCodes.MilestoneAllView,
            PermissionCodes.MilestoneOwnManage,
            PermissionCodes.MilestoneAllManage);

    private Task<bool> IsDepartmentAssignedToProjectAsync(Guid projectId, Guid departmentId, CancellationToken ct)
        => _db.Projects.AnyAsync(project =>
            project.Id == projectId &&
            (project.DepartmentId == departmentId ||
             project.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId)),
            ct);

    private async Task SendProjectAssignedNotificationAsync(Guid projectId, Guid? departmentId, CancellationToken ct)
    {
        if (!departmentId.HasValue)
        {
            return;
        }

        var project = await _db.Projects
            .Where(item => item.Id == projectId)
            .Select(item => new { item.Name })
            .FirstOrDefaultAsync(ct);
        if (project == null)
        {
            return;
        }

        var departmentHeadIds = await _db.Departments
            .Where(department => department.Id == departmentId.Value && department.DepartmentHeadUserId != null)
            .Select(department => department.DepartmentHeadUserId!)
            .ToListAsync(ct);

        foreach (var userId in departmentHeadIds.Distinct())
        {
            var alreadySent = await _db.Notifications.AnyAsync(notification =>
                notification.UserId == userId &&
                notification.RelatedEntityId == projectId.ToString() &&
                notification.RelatedEntityType == "Project",
                ct);
            if (alreadySent)
            {
                continue;
            }

            await _notifications.SendAsync(new SendNotificationDto(
                UserId: userId,
                Title: "New Project Assigned",
                Message: $"'{project.Name}' has been assigned to your department.",
                Type: NotificationType.ProjectAlert,
                Priority: NotificationPriority.Normal,
                ActionUrl: $"/projects/{projectId}/milestones",
                RelatedEntityId: projectId.ToString(),
                RelatedEntityType: "Project"),
                ct);
        }
    }
    private string CurrentUserName => _currentUser.FullName ?? "System";

    private async Task<string> ResolveProjectNameAsync(Guid projectId, CancellationToken ct)
    {
        var project = await _db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => p.Name)
            .FirstOrDefaultAsync(ct);
        return project ?? "Unknown Project";
    }
}
