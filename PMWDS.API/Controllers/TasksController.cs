using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.DTOs.Tasks;
using PMWDS.Application.Exceptions;
using PMWDS.Application.Features.AI.Queries;
using PMWDS.Application.Features.Tasks.Commands;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Infrastructure.Services;
using PMWDS.Persistence.Context;
using TaskDependency = PMWDS.Domain.Entities.TaskDependency;
using TaskPriority = PMWDS.Domain.Enums.TaskPriority;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Controllers;

public class TasksController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notifications;
    private readonly IFileStorageService _files;
    private readonly ITaskWorkflowService _taskWorkflow;
    private readonly RoleScopeService _scope;
    private readonly ApplicationDbContext _db;
    private readonly IDataChangeNotifier _changes;

    public TasksController(
        IMediator mediator,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        INotificationService notifications,
        IFileStorageService files,
        ITaskWorkflowService taskWorkflow,
        RoleScopeService scope,
        ApplicationDbContext db,
        IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _notifications = notifications;
        _files = files;
        _taskWorkflow = taskWorkflow;
        _scope = scope;
        _db = db;
        _changes = changes;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? departmentId,
        [FromQuery] string? search,
        [FromQuery] string[]? statuses,
        [FromQuery] string[]? priorities,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        [FromQuery] PaginationQuery pagination,
        CancellationToken ct)
    {
        if (projectId.HasValue && !await _scope.CanAccessProjectAsync(projectId.Value, ct))
        {
            return Forbid();
        }

        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var query = _db.Tasks.AsNoTracking()
            .Where(task => allowedProjectIds.Contains(task.ProjectId) && task.ParentTaskId == null)
            .Include(task => task.Project)
            .Include(task => task.Milestone)
            .Include(task => task.Assignments)
                .ThenInclude(assignment => assignment.User)
            .Include(task => task.SubTasks)
            .AsSplitQuery()
            .AsQueryable();

        if (projectId.HasValue)
        {
            query = query.Where(task => task.ProjectId == projectId.Value);
        }

        if (departmentId.HasValue)
        {
            query = query.Where(task =>
                task.Project!.DepartmentId == departmentId.Value ||
                task.Project.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId.Value) ||
                (task.Milestone != null && task.Milestone.DepartmentId == departmentId.Value));
        }

        var normalizedSearch = search?.Trim();
        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            query = query.Where(task =>
                task.Title.Contains(normalizedSearch) ||
                task.Project!.Name.Contains(normalizedSearch) ||
                task.Assignments.Any(assignment =>
                    assignment.IsActive &&
                    assignment.User != null &&
                    assignment.User.FullName.Contains(normalizedSearch)));
        }

        var statusValues = ParseEnumFilters<TaskStatus>(statuses);
        if (statusValues.Count > 0)
        {
            query = query.Where(task => statusValues.Contains(task.Status));
        }

        var priorityValues = ParseEnumFilters<TaskPriority>(priorities);
        if (priorityValues.Count > 0)
        {
            query = query.Where(task => priorityValues.Contains(task.Priority));
        }

        query = (sortBy?.Trim().ToLowerInvariant(), sortDirection?.Trim().ToLowerInvariant()) switch
        {
            ("title", "desc") => query.OrderByDescending(task => task.Title),
            ("title", _) => query.OrderBy(task => task.Title),
            ("progress", "desc") => query.OrderByDescending(task => task.ProgressPercentage),
            ("progress", _) => query.OrderBy(task => task.ProgressPercentage),
            ("duedate", "desc") => query.OrderByDescending(task => task.DueDate),
            ("duedate", _) => query.OrderBy(task => task.DueDate),
            _ => query.OrderByDescending(task => task.CreatedDate)
        };

        var totalCount = await query.CountAsync(ct);
        var tasks = await query
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);

        var items = tasks.Select(TaskDto.FromEntity).ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(items, pagination, totalCount));
    }

    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary(CancellationToken ct)
    {
        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var query = _db.Tasks
            .AsNoTracking()
            .Where(task => allowedProjectIds.Contains(task.ProjectId) && task.ParentTaskId == null);

        var counts = await query
            .GroupBy(task => 1)
            .Select(group => new
            {
                Total = group.Count(),
                InProgress = group.Count(task => task.Status == TaskStatus.InProgress),
                OnHold = group.Count(task => task.Status == TaskStatus.OnHold),
                Completed = group.Count(task => task.Status == TaskStatus.Completed),
                Delayed = group.Count(task =>
                    task.Status == TaskStatus.Delayed ||
                    (task.Status != TaskStatus.Completed && task.DueDate < DateTime.UtcNow))
            })
            .FirstOrDefaultAsync(ct);

        async Task<List<TaskDashboardPreviewDto>> LoadRecentAsync(
            IQueryable<ProjectTask> source)
        {
            return await source
                .Include(task => task.Project)
                .Include(task => task.Milestone)
                .OrderByDescending(task => task.CreatedDate)
                .Take(5)
                .Select(task => new TaskDashboardPreviewDto(
                    task.Id,
                    task.Title,
                    task.Status.ToString(),
                    task.ProjectId,
                    task.Project != null ? task.Project.Name : null,
                    task.MilestoneId,
                    task.Milestone != null ? task.Milestone.Name : null,
                    task.ProgressPercentage,
                    task.CreatedDate))
                .ToListAsync(ct);
        }

        var recent = await LoadRecentAsync(query);
        var inProgress = await LoadRecentAsync(query.Where(task => task.Status == TaskStatus.InProgress));
        var onHold = await LoadRecentAsync(query.Where(task => task.Status == TaskStatus.OnHold));
        var completed = await LoadRecentAsync(query.Where(task => task.Status == TaskStatus.Completed));
        var delayed = await LoadRecentAsync(query.Where(task =>
            task.Status == TaskStatus.Delayed ||
            (task.Status != TaskStatus.Completed && task.DueDate < DateTime.UtcNow)));

        return Ok(new TaskDashboardStatsDto(
            counts?.Total ?? 0,
            counts?.InProgress ?? 0,
            counts?.OnHold ?? 0,
            counts?.Completed ?? 0,
            counts?.Delayed ?? 0,
            recent,
            inProgress,
            onHold,
            completed,
            delayed));
    }

    [HttpGet("by-project/{projectId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetByProject(Guid projectId, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
        {
            return Forbid();
        }

        var tasksQuery = _db.Tasks
            .Include(t => t.SubTasks)
            .Where(task => task.ProjectId == projectId);

        if (!await _scope.CanSeeFullProjectDetailsAsync(projectId, ct))
        {
            var departmentIds = await _scope.GetDepartmentIdsAsync(ct);
            var visibleMilestoneIds = await _db.Milestones
                .Where(milestone =>
                    milestone.ProjectId == projectId &&
                    milestone.DepartmentId.HasValue &&
                    departmentIds.Contains(milestone.DepartmentId.Value))
                .Select(milestone => milestone.Id)
                .ToListAsync(ct);
            tasksQuery = tasksQuery.Where(task =>
                task.MilestoneId.HasValue && visibleMilestoneIds.Contains(task.MilestoneId.Value));
        }

        var tasks = await tasksQuery
            .OrderByDescending(task => task.CreatedDate)
            .ToListAsync(ct);
        return Ok(tasks.Select(TaskDto.FromEntity).ToList());
    }

    [HttpGet("my-tasks")]
    public async Task<IActionResult> GetMyTasks([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var currentUserId))
            return Unauthorized();

        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        IQueryable<ProjectTask> query = _db.Tasks.AsNoTracking()
            .Where(t => allowedProjectIds.Contains(t.ProjectId))
            .Include(t => t.Assignments)
                .ThenInclude(assignment => assignment.User)
            .Include(t => t.SubTasks)
            .Include(t => t.Project)
            .Include(t => t.Milestone);

        if (!_scope.IsSuperAdmin)
        {
            query = query.Where(t =>
                (t.AssignedToUserId == currentUserId ||
                 t.Assignments.Any(a => a.UserId == currentUserId && a.IsActive)) &&
                t.Status != TaskStatus.Completed &&
                t.Status != TaskStatus.Cancelled);
        }

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .AsSplitQuery()
            .OrderByDescending(task => task.CreatedDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        var response = items
            .Select(TaskDto.FromEntity)
            .ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(response, pagination, totalCount));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        if (task == null)
        {
            return NotFound();
        }

        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        return Ok(TaskDto.FromEntity(task));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.TasksCreate)]
    public async Task<IActionResult> Create([FromBody] CreateTaskDto dto, CancellationToken ct)
    {
        if (!await _scope.CanCreateProjectChildAsync(dto.ProjectId, await ResolveTaskDepartmentIdAsync(dto.ProjectId, dto.MilestoneId, ct), ct,
            PermissionCodes.TaskOwnCreate, PermissionCodes.TaskAllCreate,
            PermissionCodes.TaskOwnManage, PermissionCodes.TaskAllManage))
        {
            return Forbid();
        }

        if (!string.IsNullOrWhiteSpace(dto.AssignedToUserId) &&
            !await _taskWorkflow.IsUserInProjectOrganizationAsync(dto.AssignedToUserId, dto.ProjectId, ct))
        {
            return BadRequest(new { message = "Assignee must belong to the selected project organization." });
        }

        var result = await Mediator.Send(new CreateTaskCommand(dto), ct);
        if (dto.MilestoneId.HasValue)
        {
            var createdTask = await _uow.Tasks.GetByIdAsync(result.Id, ct);
            if (createdTask != null) await _taskWorkflow.RecalculateTaskMilestoneAsync(createdTask, ct);
        }

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Created",
            Description: $"{_currentUser.FullName} created task \"{result.Title}\" under milestone \"{result.MilestoneName}\" in project \"{result.ProjectName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = result.Id,
                ["taskTitle"] = result.Title,
                ["milestoneId"] = result.MilestoneId?.ToString() ?? string.Empty,
                ["milestoneName"] = result.MilestoneName ?? "",
                ["projectId"] = result.ProjectId,
                ["projectName"] = result.ProjectName ?? ""
            },
            ProjectId: result.ProjectId
        );

        // Task counts and completion feed the project rollup.
        await _changes.NotifyAsync(DataChangeScopes.Tasks, result.Id.ToString(), result.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, result.ProjectId.ToString(), result.ProjectId, ct);

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TasksEdit)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskDto dto, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null)
            return NotFound();

        if (!await _scope.CanModifyProjectChildAsync(task.ProjectId, await ResolveTaskDepartmentIdAsync(task.ProjectId, task.MilestoneId, ct), ct,
            PermissionCodes.TaskOwnEdit, PermissionCodes.TaskAllEdit,
            PermissionCodes.TaskOwnManage, PermissionCodes.TaskAllManage))
        {
            return Forbid();
        }

        var oldMilestoneId = task.MilestoneId;
        task.UpdateDetails(
            dto.Title,
            dto.Description ?? string.Empty,
            dto.Priority,
            dto.StartDate,
            dto.DueDate,
            (int)dto.EstimatedHours,
            dto.MilestoneId);
        task.SetModified(_currentUser.UserId ?? "system");
        await _uow.SaveChangesAsync(ct);
        if (dto.MilestoneId.HasValue) await _taskWorkflow.RecalculateTaskMilestoneAsync(task, ct);
        if (oldMilestoneId.HasValue && oldMilestoneId != dto.MilestoneId)
        {
            var oldMilestone = await _db.Milestones
                .Include(m => m.Tasks)
                .FirstOrDefaultAsync(m => m.Id == oldMilestoneId.Value, ct);
            if (oldMilestone != null)
            {
                oldMilestone.RecalculateProgressFromTasks();
                oldMilestone.RecalculateStatusFromTasks();
                oldMilestone.SetModified(_currentUser.UserId ?? "system");
                await _uow.Milestones.UpdateAsync(oldMilestone, ct);
                await _uow.SaveChangesAsync(ct);
            }
        }

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Updated",
            Description: $"{_currentUser.FullName} updated task \"{task.Title}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = task.Id,
                ["taskTitle"] = task.Title,
                ["projectId"] = task.ProjectId
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, task.ProjectId.ToString(), task.ProjectId, ct);

        return Ok(TaskDto.FromEntity(task));
    }

    [HttpPatch("{id:guid}/progress")]
    [Authorize(Policy = AuthorizationPolicies.TasksEdit)]
    public async Task<IActionResult> UpdateProgress(Guid id, [FromBody] UpdateTaskProgressDto dto, CancellationToken ct)
    {
        var taskForWrite = await _uow.Tasks.GetByIdAsync(id, ct);
        if (taskForWrite == null ||
            !await _scope.CanModifyProjectChildAsync(taskForWrite.ProjectId, await ResolveTaskDepartmentIdAsync(taskForWrite.ProjectId, taskForWrite.MilestoneId, ct), ct,
            PermissionCodes.TaskOwnEdit, PermissionCodes.TaskAllEdit,
                PermissionCodes.TaskOwnManage, PermissionCodes.TaskAllManage))
        {
            return Forbid();
        }

        var result = await Mediator.Send(new UpdateTaskProgressCommand(id, dto), ct);
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task != null) await _taskWorkflow.RecalculateTaskMilestoneAsync(task, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Progress Updated",
            Description: $"{_currentUser.FullName} updated progress of task \"{task?.Title}\" to {dto.ProgressPercentage}% in project \"{await _taskWorkflow.ResolveProjectNameAsync(task?.ProjectId ?? Guid.Empty, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = id,
                ["taskTitle"] = task?.Title ?? "",
                ["projectId"] = task?.ProjectId ?? Guid.Empty,
                ["progressPercentage"] = dto.ProgressPercentage
            },
            ProjectId: task?.ProjectId
        );

        if (task is not null)
        {
            await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
            await _changes.NotifyAsync(DataChangeScopes.Projects, task.ProjectId.ToString(), task.ProjectId, ct);
        }

        return Ok(result);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateTaskStatusRequest req, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        if (task == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        var oldStatus = task.Status;
        await _taskWorkflow.ApplyStatusChangeAsync(task, req, ct);
        await _taskWorkflow.RecalculateTaskMilestoneAsync(task, ct);
        var refreshed = await _uow.Tasks.GetWithDetailsAsync(id, ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Status Changed",
            Description: $"{_currentUser.FullName} changed task \"{task.Title}\" status from \"{oldStatus}\" to \"{req.NewStatus}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = task.Id,
                ["taskTitle"] = task.Title,
                ["projectId"] = task.ProjectId,
                ["oldStatus"] = oldStatus.ToString(),
                ["newStatus"] = req.NewStatus.ToString()
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, task.ProjectId.ToString(), task.ProjectId, ct);

        return Ok(TaskDto.FromEntity(refreshed ?? task));
    }

    [HttpPost("{id:guid}/assign")]
    [Authorize(Policy = "Tasks.Assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignTaskRequest req, CancellationToken ct)
    {
        var assigneeIds = req.AssigneeIds?.Where(value => !string.IsNullOrWhiteSpace(value)).Distinct().ToList();
        if (assigneeIds is not { Count: > 0 })
        {
            if (string.IsNullOrWhiteSpace(req.AssigneeId))
            {
                return BadRequest(new { message = "At least one assignee is required." });
            }

            var assigneeId = req.AssigneeId!;
            var singleTask = await _uow.Tasks.GetByIdAsync(id, ct);
            if (singleTask == null)
            {
                return NotFound();
            }

            if (!await _scope.CanManageProjectAsync(singleTask.ProjectId, ct))
            {
                return Forbid();
            }

            if (!await _taskWorkflow.IsUserInProjectOrganizationAsync(assigneeId, singleTask.ProjectId, ct))
            {
                return BadRequest(new { message = "Assignee must belong to the selected project organization." });
            }

            var assignResult = await Mediator.Send(new AssignTaskCommand(id, assigneeId, req.UseAIRecommendation), ct);

            HttpContext.Items["ActivityLog"] = new ActivityLogContext(
                ActivityType: "Task Assigned",
                Description: $"{_currentUser.FullName} assigned task \"{assignResult.Title}\" to {assignResult.AssignedToUserName} in project \"{assignResult.ProjectName}\"",
                Metadata: new Dictionary<string, object>
                {
                    ["taskId"] = assignResult.Id,
                    ["taskTitle"] = assignResult.Title,
                    ["assigneeId"] = assigneeId,
                    ["assigneeName"] = assignResult.AssignedToUserName ?? "",
                    ["projectId"] = assignResult.ProjectId,
                    ["projectName"] = assignResult.ProjectName ?? ""
                },
                ProjectId: assignResult.ProjectId
            );

            return Ok(assignResult);
        }

        var task = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        if (task == null)
        {
            return NotFound();
        }

        if (!await _scope.CanManageProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        foreach (var userId in assigneeIds)
        {
            if (!Guid.TryParse(userId, out var parsedUserId) ||
                await _uow.Users.GetByIdAsync(parsedUserId, ct) == null ||
                !await _taskWorkflow.IsUserInProjectOrganizationAsync(userId, task.ProjectId, ct))
            {
                return BadRequest(new { message = $"Invalid assignee '{userId}'." });
            }
        }

        var parsedAssigneeIds = assigneeIds.Select(Guid.Parse).ToList();
        foreach (var active in task.Assignments.Where(a => a.IsActive && !parsedAssigneeIds.Contains(a.UserId)))
        {
            active.Release();
        }

        var assignedBy = Guid.TryParse(_currentUser.UserId, out var assignedById)
            ? assignedById
            : throw new InvalidOperationException("Invalid current user id.");
        task.AssignTo(parsedAssigneeIds[0], assignedBy);

        foreach (var userId in parsedAssigneeIds)
        {
            if (task.Assignments.All(a => a.UserId != userId || !a.IsActive))
            {
                await _uow.TaskAssignments.AddAsync(TaskAssignment.Create(task.Id, userId), ct);
                await _notifications.SendTaskAssignmentAlertAsync(task.Id, userId.ToString(), ct);
            }
        }

        task.SetModified(_currentUser.UserId ?? "system");
        await _uow.SaveChangesAsync(ct);

        var refreshed = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        var assigneeNames = await _db.Users
            .Where(u => parsedAssigneeIds.Contains(u.Id))
            .Select(u => u.FullName)
            .ToListAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Assigned",
            Description: $"{_currentUser.FullName} assigned task \"{task.Title}\" to {string.Join(", ", assigneeNames)} in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = task.Id,
                ["taskTitle"] = task.Title,
                ["assigneeIds"] = string.Join(",", assigneeIds),
                ["assigneeNames"] = string.Join(", ", assigneeNames),
                ["projectId"] = task.ProjectId
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);

        return Ok(TaskDto.FromEntity(refreshed!));
    }

    [HttpGet("{id:guid}/ai/recommend-assignee")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetAIAssignee(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetAIAssigneeRecommendationQuery(id), ct));

    [HttpGet("{id:guid}/ai/delay-prediction")]
    public async Task<IActionResult> GetDelayPrediction(Guid id, CancellationToken ct)
    {
        if (!await _taskWorkflow.CanAccessTaskAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(await Mediator.Send(new GetTaskDelayPredictionQuery(id), ct));
    }

    [HttpPost("{id:guid}/escalate")]
    [Authorize(Policy = AuthorizationPolicies.TasksEdit)]
    public async Task<IActionResult> Escalate(Guid id, CancellationToken ct)
    {
        if (!await _taskWorkflow.CanManageTaskAsync(id, ct))
        {
            return Forbid();
        }

        var result = await Mediator.Send(new EscalateTaskCommand(id), ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), null, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/comments")]
    [Authorize(Policy = "Tasks.Comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentRequest req, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null)
            return NotFound();

        if (!await _taskWorkflow.CanWorkOnTaskAsync(id, ct))
        {
            return Forbid();
        }

        var comment = TaskComment.Create(
            id,
            Guid.TryParse(_currentUser.UserId, out var commentUserId) ? commentUserId : null,
            req.Comment);
        await _uow.TaskComments.AddAsync(comment, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Comment Added",
            Description: $"{_currentUser.FullName} commented on task \"{task.Title}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = task.Id,
                ["taskTitle"] = task.Title,
                ["projectId"] = task.ProjectId,
                ["commentPreview"] = (req.Comment?.Length > 100 ? req.Comment[..100] : req.Comment) ?? ""
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);

        return Ok(new { Message = "Comment added.", Comment = comment.Content });
    }

    [HttpPost("{id:guid}/attachments")]
    [Authorize(Policy = "Tasks.Attachments")]
    public async Task<IActionResult> UploadAttachment(Guid id, IFormFile file, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null)
            return NotFound();

        if (!await _taskWorkflow.CanWorkOnTaskAsync(id, ct))
        {
            return Forbid();
        }

        await using var stream = file.OpenReadStream();
        var filePath = await _files.UploadAsync(stream, file.FileName, file.ContentType, ct);

        var attachment = TaskAttachment.Create(
            id,
            file.FileName,
            filePath,
            file.ContentType,
            file.Length,
            _currentUser.UserId ?? "system");
        await _uow.TaskAttachments.AddAsync(attachment, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Attachment Uploaded",
            Description: $"{_currentUser.FullName} uploaded \"{file.FileName}\" to task \"{task.Title}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskId"] = task.Id,
                ["taskTitle"] = task.Title,
                ["projectId"] = task.ProjectId,
                ["fileName"] = file.FileName,
                ["fileSize"] = file.Length
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Documents, attachment.Id.ToString(), task.ProjectId, ct);

        return Ok(new { Message = "Attachment uploaded.", FileName = file.FileName });
    }

    [HttpGet("overdue")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetOverdue([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var query = _db.Tasks.AsNoTracking()
            .Where(task =>
                allowedProjectIds.Contains(task.ProjectId) &&
                task.DueDate < DateTime.UtcNow &&
                task.Status != TaskStatus.Completed &&
                task.Status != TaskStatus.Cancelled)
            .Include(task => task.Project);
        var totalCount = await query.CountAsync(ct);
        var tasks = await query
            .OrderBy(task => task.DueDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        var items = tasks.Select(TaskDto.FromEntity).ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(items, pagination, totalCount));
    }

    private static IReadOnlyCollection<TEnum> ParseEnumFilters<TEnum>(IEnumerable<string>? rawValues)
        where TEnum : struct, Enum
    {
        if (rawValues == null)
        {
            return Array.Empty<TEnum>();
        }

        return rawValues
            .SelectMany(value => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Select(value => Enum.TryParse<TEnum>(value, ignoreCase: true, out var parsed) ? parsed : (TEnum?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();
    }

    [HttpGet("escalated")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetEscalated([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var query = _db.Tasks.AsNoTracking()
            .Where(task =>
                allowedProjectIds.Contains(task.ProjectId) &&
                task.IsEscalated &&
                task.Status != TaskStatus.Completed)
            .Include(task => task.Project);
        var totalCount = await query.CountAsync(ct);
        var tasks = await query
            .OrderByDescending(task => task.ModifiedDate ?? task.CreatedDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        var items = tasks.Select(TaskDto.FromEntity).ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(items, pagination, totalCount));
    }

    [HttpGet("unassigned")]
    [Authorize(Policy = AuthorizationPolicies.TasksView)]
    public async Task<IActionResult> GetUnassigned([FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
        var query = _db.Tasks.AsNoTracking()
            .Where(task =>
                allowedProjectIds.Contains(task.ProjectId) &&
                task.AssignedToUserId == null &&
                task.Status == TaskStatus.NotStarted)
            .Include(task => task.Project);
        var totalCount = await query.CountAsync(ct);
        var tasks = await query
            .OrderByDescending(task => task.CreatedDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        var items = tasks.Select(TaskDto.FromEntity).ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(items, pagination, totalCount));
    }

    [HttpGet("{id:guid}/subtasks")]
    public async Task<IActionResult> GetSubtasks(Guid id, [FromQuery] PaginationQuery pagination, CancellationToken ct)
    {
        var parentTask = await _uow.Tasks.GetByIdAsync(id, ct);
        if (parentTask == null) return NotFound();
        if (!await _scope.CanAccessProjectAsync(parentTask.ProjectId, ct)) return Forbid();
        var query = _db.Tasks.AsNoTracking()
            .Where(task => task.ParentTaskId == id)
            .Include(task => task.Assignments)
            .Include(task => task.Comments)
            .Include(task => task.Attachments)
            .Include(task => task.Dependencies)
                .ThenInclude(dependency => dependency.PredecessorTask)
            .Include(task => task.Project)
            .Include(task => task.Milestone);
        var totalCount = await query.CountAsync(ct);
        var subtasks = await query
            .AsSplitQuery()
            .OrderByDescending(task => task.CreatedDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);
        var items = subtasks.Select(TaskDto.FromEntity).ToList();
        return Ok(PaginatedResponse<TaskDto>.Create(items, pagination, totalCount));
    }

    [HttpPost("{id:guid}/subtasks")]
    public async Task<IActionResult> CreateSubtask(Guid id, [FromBody] CreateSubtaskDto dto, CancellationToken ct)
    {
        var parentTask = await _uow.Tasks.GetByIdAsync(id, ct);
        if (parentTask == null)
            return NotFound();

        if (!await _taskWorkflow.CanWorkOnTaskAsync(parentTask.Id, ct))
        {
            return Forbid();
        }

        if (dto.ProjectId != parentTask.ProjectId)
        {
            return BadRequest(new { message = "Subtask project must match the parent task project." });
        }

        if (!string.IsNullOrWhiteSpace(dto.AssignedToUserId) &&
            !await _taskWorkflow.IsUserInProjectOrganizationAsync(dto.AssignedToUserId, parentTask.ProjectId, ct))
        {
            return BadRequest(new { message = "Assignee must belong to the selected project organization." });
        }

        var dueDate = dto.DueDate ?? DateTime.UtcNow.AddDays(7);
        var createDto = new CreateTaskDto(
            dto.Title,
            dto.Description ?? string.Empty,
            dto.StartDate,
            dueDate,
            dto.EstimatedHours,
            dto.ProjectId,
            dto.MilestoneId,
            id,
            dto.AssignedToUserId,
            dto.Priority);
        var result = await Mediator.Send(new CreateTaskCommand(createDto), ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Subtask Created",
            Description: $"{_currentUser.FullName} created subtask \"{result.Title}\" under task \"{parentTask.Title}\" in project \"{result.ProjectName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["subtaskId"] = result.Id,
                ["subtaskTitle"] = result.Title,
                ["parentTaskId"] = parentTask.Id,
                ["parentTaskTitle"] = parentTask.Title,
                ["projectId"] = result.ProjectId,
                ["projectName"] = result.ProjectName ?? ""
            },
            ProjectId: result.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, result.Id.ToString(), result.ProjectId, ct);

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet("subtasks/{id:guid}")]
    public async Task<IActionResult> GetSubtaskById(Guid id, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        if (task == null || task.ParentTaskId == null)
            return NotFound();
        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct)) return Forbid();
        return Ok(TaskDto.FromEntity(task));
    }

    [HttpPut("subtasks/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SubtasksEdit)]
    public async Task<IActionResult> UpdateSubtask(Guid id, [FromBody] UpdateTaskDto dto, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null || task.ParentTaskId == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        if (!await _scope.CanManageProjectAsync(task.ProjectId, ct) &&
            task.AssignedToUserId != _scope.CurrentUserId)
        {
            return Forbid();
        }

        task.UpdateDetails(
            dto.Title,
            dto.Description ?? string.Empty,
            dto.Priority,
            dto.StartDate,
            dto.DueDate,
            (int)dto.EstimatedHours,
            dto.MilestoneId);
        task.SetModified(_currentUser.UserId ?? "system");
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Subtask Updated",
            Description: $"{_currentUser.FullName} updated subtask \"{task.Title}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["subtaskId"] = task.Id,
                ["subtaskTitle"] = task.Title,
                ["projectId"] = task.ProjectId
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);

        return Ok(TaskDto.FromEntity(task));
    }

    [HttpPatch("subtasks/{id:guid}/progress")]
    public async Task<IActionResult> UpdateSubtaskProgress(Guid id, [FromBody] UpdateTaskProgressDto dto, CancellationToken ct)
    {
        if (!await _taskWorkflow.CanWorkOnTaskAsync(id, ct))
        {
            return Forbid();
        }

        var result = await Mediator.Send(new UpdateTaskProgressCommand(id, dto), ct);
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task != null) await _taskWorkflow.RecalculateTaskMilestoneAsync(task, ct);
        if (task != null) await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
        return Ok(result);
    }

    [HttpPatch("subtasks/{id:guid}/status")]
    public async Task<IActionResult> UpdateSubtaskStatus(Guid id, [FromBody] UpdateTaskStatusRequest req, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        if (task == null || task.ParentTaskId == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        await _taskWorkflow.ApplyStatusChangeAsync(task, req, ct);
        await _taskWorkflow.RecalculateTaskMilestoneAsync(task, ct);
        var refreshed = await _uow.Tasks.GetWithDetailsAsync(id, ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
        return Ok(TaskDto.FromEntity(refreshed ?? task));
    }

    [HttpPost("subtasks/{id:guid}/assign")]
    [Authorize(Policy = AuthorizationPolicies.SubtasksEdit)]
    public async Task<IActionResult> AssignSubtask(Guid id, [FromBody] AssignTaskRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.AssigneeId))
        {
            return BadRequest(new { message = "Assignee is required." });
        }

        if (!await _taskWorkflow.CanManageTaskAsync(id, ct))
        {
            return Forbid();
        }

        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null || !await _taskWorkflow.IsUserInProjectOrganizationAsync(req.AssigneeId, task.ProjectId, ct))
        {
            return BadRequest(new { message = "Assignee must belong to the selected project organization." });
        }

        var assignResult = await Mediator.Send(new AssignTaskCommand(id, req.AssigneeId, req.UseAIRecommendation), ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);
        return Ok(assignResult);
    }

    [HttpDelete("subtasks/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SubtasksDelete)]
    public async Task<IActionResult> DeleteSubtask(Guid id, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null || task.ParentTaskId == null)
            return NotFound();

        if (!await _scope.CanManageProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        var milestoneId = task.MilestoneId;
        var subtaskTitle = task.Title;
        var projectId = task.ProjectId;
        await _uow.Tasks.DeleteTaskGraphAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        if (milestoneId.HasValue)
        {
            var milestone = await _db.Milestones
                .Include(m => m.Tasks)
                .FirstOrDefaultAsync(m => m.Id == milestoneId.Value, ct);
            if (milestone != null)
            {
                milestone.RecalculateProgressFromTasks();
                milestone.RecalculateStatusFromTasks();
                milestone.SetModified(_currentUser.UserId ?? "system");
                await _uow.Milestones.UpdateAsync(milestone, ct);
                await _uow.SaveChangesAsync(ct);
            }
        }

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Subtask Deleted",
            Description: $"{_currentUser.FullName} deleted subtask \"{subtaskTitle}\" from project \"{await _taskWorkflow.ResolveProjectNameAsync(projectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["subtaskTitle"] = subtaskTitle,
                ["projectId"] = projectId
            },
            ProjectId: projectId
        );

        // Deleting a subtask recalculates its parent milestone and the project rollup.
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestoneId?.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, projectId.ToString(), projectId, ct);

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.TasksDelete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null) return NotFound();
        var milestoneId = task.MilestoneId;
        var taskTitle = task.Title;
        var projectId = task.ProjectId;
        if (!await _scope.CanModifyProjectChildAsync(projectId, await ResolveTaskDepartmentIdAsync(projectId, task.MilestoneId, ct), ct,
            PermissionCodes.TaskOwnDelete, PermissionCodes.TaskAllDelete,
            PermissionCodes.TaskOwnManage, PermissionCodes.TaskAllManage)) return Forbid();
        await _uow.Tasks.DeleteTaskGraphAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        if (milestoneId.HasValue)
        {
            var milestone = await _db.Milestones
                .Include(m => m.Tasks)
                .FirstOrDefaultAsync(m => m.Id == milestoneId.Value, ct);
            if (milestone != null)
            {
                milestone.RecalculateProgressFromTasks();
                milestone.RecalculateStatusFromTasks();
                milestone.SetModified(_currentUser.UserId ?? "system");
                await _uow.Milestones.UpdateAsync(milestone, ct);
                await _uow.SaveChangesAsync(ct);
            }
        }

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Deleted",
            Description: $"{_currentUser.FullName} deleted task \"{taskTitle}\" from project \"{await _taskWorkflow.ResolveProjectNameAsync(projectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["taskTitle"] = taskTitle,
                ["projectId"] = projectId
            },
            ProjectId: projectId
        );

        // Deleting a task removes it and its whole subtask subtree, and recalculates the
        // parent milestone, so tasks, milestones and the project rollup all change.
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Milestones, milestoneId?.ToString(), projectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Projects, projectId.ToString(), projectId, ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/dependencies")]
    public async Task<IActionResult> GetDependencies(Guid id, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null) return NotFound();
        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct)) return Forbid();
        var dependencies = (await _uow.Tasks.GetDependenciesForTaskAsync(id, ct))
            .Select(TaskDependencyDto.FromEntity)
            .ToList();
        return Ok(dependencies);
    }

    [HttpPost("{id:guid}/dependencies")]
    public async Task<IActionResult> CreateDependency(Guid id, [FromBody] CreateDependencyDto dto, CancellationToken ct)
    {
        var task = await _uow.Tasks.GetByIdAsync(id, ct);
        if (task == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(task.ProjectId, ct))
        {
            return Forbid();
        }

        var predecessor = await _uow.Tasks.GetByIdAsync(dto.PredecessorTaskId, ct);
        if (predecessor == null)
            return BadRequest(new { message = "Predecessor task not found." });

        var successor = await _uow.Tasks.GetByIdAsync(dto.SuccessorTaskId, ct);
        if (successor == null)
            return BadRequest(new { message = "Successor task not found." });

        if (!await _scope.CanManageProjectAsync(predecessor.ProjectId, ct) ||
            !await _scope.CanManageProjectAsync(successor.ProjectId, ct))
        {
            return Forbid();
        }

        var dependency = TaskDependency.Create(dto.PredecessorTaskId, dto.SuccessorTaskId, dto.Type, dto.LagDays);
        await _uow.TaskDependencies.AddAsync(dependency, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Dependency Added",
            Description: $"{_currentUser.FullName} added dependency: \"{predecessor.Title}\" must precede \"{successor.Title}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(task.ProjectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["dependencyId"] = dependency.Id,
                ["predecessorTaskId"] = predecessor.Id,
                ["predecessorTaskTitle"] = predecessor.Title,
                ["successorTaskId"] = successor.Id,
                ["successorTaskTitle"] = successor.Title,
                ["projectId"] = task.ProjectId
            },
            ProjectId: task.ProjectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), task.ProjectId, ct);

        return Ok(TaskDependencyDto.FromEntity(dependency));
    }

    [HttpPut("dependencies/{depId:guid}")]
    public async Task<IActionResult> UpdateDependency(Guid depId, [FromBody] UpdateDependencyDto dto, CancellationToken ct)
    {
        var dependency = await _uow.TaskDependencies.GetByIdAsync(depId, ct);
        if (dependency == null)
            return NotFound();

        if (!await _taskWorkflow.CanManageTaskAsync(dependency.PredecessorTaskId, ct) ||
            !await _taskWorkflow.CanManageTaskAsync(dependency.SuccessorTaskId, ct))
        {
            return Forbid();
        }

        dependency.UpdateType(dto.Type);
        dependency.UpdateLag(dto.LagDays);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, depId.ToString(), null, ct);
        return Ok(TaskDependencyDto.FromEntity(dependency));
    }

    [HttpDelete("dependencies/{depId:guid}")]
    public async Task<IActionResult> DeleteDependency(Guid depId, CancellationToken ct)
    {
        var dependency = await _uow.TaskDependencies.GetByIdAsync(depId, ct);
        if (dependency == null)
            return NotFound();

        if (!await _taskWorkflow.CanManageTaskAsync(dependency.PredecessorTaskId, ct) ||
            !await _taskWorkflow.CanManageTaskAsync(dependency.SuccessorTaskId, ct))
        {
            return Forbid();
        }

        var predTitle = await _db.Tasks
            .Where(t => t.Id == dependency.PredecessorTaskId)
            .Select(t => t.Title)
            .FirstOrDefaultAsync(ct) ?? "Unknown";
        var succTitle = await _db.Tasks
            .Where(t => t.Id == dependency.SuccessorTaskId)
            .Select(t => t.Title)
            .FirstOrDefaultAsync(ct) ?? "Unknown";
        var projectId = await _db.Tasks
            .Where(t => t.Id == dependency.PredecessorTaskId)
            .Select(t => t.ProjectId)
            .FirstOrDefaultAsync(ct);

        await _uow.TaskDependencies.DeleteAsync(depId, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Task Dependency Removed",
            Description: $"{_currentUser.FullName} removed dependency between \"{predTitle}\" and \"{succTitle}\" in project \"{await _taskWorkflow.ResolveProjectNameAsync(projectId, ct)}\"",
            Metadata: new Dictionary<string, object>
            {
                ["dependencyId"] = depId,
                ["predecessorTaskTitle"] = predTitle,
                ["successorTaskTitle"] = succTitle,
                ["projectId"] = projectId
            },
            ProjectId: projectId
        );

        await _changes.NotifyAsync(DataChangeScopes.Tasks, depId.ToString(), projectId, ct);

        return NoContent();
    }
    private async Task<Guid?> ResolveTaskDepartmentIdAsync(Guid projectId, Guid? milestoneId, CancellationToken ct)
    {
        if (milestoneId.HasValue)
        {
            return await _db.Milestones
                .Where(milestone => milestone.Id == milestoneId.Value && milestone.ProjectId == projectId)
                .Select(milestone => milestone.DepartmentId)
                .FirstOrDefaultAsync(ct);
        }

        return await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => (Guid?)project.DepartmentId)
            .FirstOrDefaultAsync(ct);
    }

}
