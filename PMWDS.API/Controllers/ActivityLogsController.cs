using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class ActivityLogsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly RoleScopeService _scope;
    private readonly ApplicationDbContext _db;

    public ActivityLogsController(
        IMediator mediator,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        RoleScopeService scope,
        ApplicationDbContext db) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _scope = scope;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetMine(
        [FromQuery] int count = 50,
        [FromQuery] PaginationQuery? pagination = null,
        CancellationToken ct = default)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
        {
            return Unauthorized();
        }

        return Ok(await BuildPageAsync(
            _db.ActivityLogs.Where(a => a.UserId == userId),
            ResolvePagination(count, pagination),
            ct));
    }

    [HttpGet("user/{userId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> GetByUser(
        Guid userId,
        [FromQuery] int count = 50,
        [FromQuery] PaginationQuery? pagination = null,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessUserAsync(userId, ct))
        {
            return Forbid();
        }

        return Ok(await BuildPageAsync(
            _db.ActivityLogs.Where(a => a.UserId == userId),
            ResolvePagination(count, pagination),
            ct));
    }

    [HttpGet("team")]
    public async Task<IActionResult> GetTeam(
        [FromQuery] int count = 50,
        [FromQuery] PaginationQuery? pagination = null,
        CancellationToken ct = default)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var currentUserId))
        {
            return Unauthorized();
        }

        var scopedUsers = await _scope.ScopeUsersAsync(_db.Users.AsQueryable(), ct);
        var teamUserIds = await scopedUsers.Select(u => u.Id).ToListAsync(ct);

        return Ok(await BuildPageAsync(
            _db.ActivityLogs.Where(a => teamUserIds.Contains(a.UserId)),
            ResolvePagination(count, pagination),
            ct));
    }

    [HttpGet("all")]
    [Authorize(Policy = AuthorizationPolicies.Director)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int count = 50,
        [FromQuery] PaginationQuery? pagination = null,
        CancellationToken ct = default)
    {
        if (_scope.IsSuperAdmin)
        {
            return Ok(await BuildPageAsync(
                _db.ActivityLogs.AsQueryable(),
                ResolvePagination(count, pagination),
                ct));
        }

        if (!_scope.IsDirector)
        {
            return Forbid();
        }

        var scopedUsers = await _scope.ScopeUsersAsync(_db.Users.AsQueryable(), ct);
        var scopedUserIds = await scopedUsers.Select(u => u.Id).ToListAsync(ct);
        return Ok(await BuildPageAsync(
            _db.ActivityLogs.Where(a => scopedUserIds.Contains(a.UserId)),
            ResolvePagination(count, pagination),
            ct));
    }

    [HttpGet("project/{projectId:guid}")]
    public async Task<IActionResult> GetByProject(
        Guid projectId,
        [FromQuery] int count = 50,
        [FromQuery] PaginationQuery? pagination = null,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
        {
            return Forbid();
        }

        return Ok(await BuildPageAsync(
            _db.ActivityLogs.Where(a => a.ProjectId == projectId),
            ResolvePagination(count, pagination),
            ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateActivityLogRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
        {
            return Unauthorized();
        }

        var log = ActivityLog.Create(userId, req.ActivityType, req.Description, req.Metadata, req.ProjectId);
        log.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.ActivityLogs.AddAsync(log, ct);
        await _uow.SaveChangesAsync(ct);
        var enriched = await EnrichAsync(new List<ActivityLog> { log }, ct);
        return CreatedAtAction(nameof(GetMine), new { id = log.Id }, enriched.First());
    }

    private async Task<PaginatedResponse<ActivityLogResponse>> BuildPageAsync(
        IQueryable<ActivityLog> query,
        PaginationQuery pagination,
        CancellationToken ct)
    {
        var totalCount = await query.CountAsync(ct);
        var logs = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .ToListAsync(ct);

        return PaginatedResponse<ActivityLogResponse>.Create(
            await EnrichAsync(logs, ct),
            pagination,
            totalCount);
    }

    private async Task<List<ActivityLogResponse>> EnrichAsync(List<ActivityLog> logs, CancellationToken ct)
    {
        var ids = logs
            .SelectMany(log => new[] { log.UserId }.Concat(log.ProjectId.HasValue ? new[] { log.ProjectId.Value } : Array.Empty<Guid>()))
            .Distinct()
            .ToList();

        var users = await _db.Users
            .Where(user => ids.Contains(user.Id))
            .Select(user => new EntitySummary(user.Id, "user", user.FullName))
            .ToDictionaryAsync(item => item.Id, ct);
        var organizations = await _db.Organizations
            .Where(organization => ids.Contains(organization.Id))
            .Select(organization => new EntitySummary(organization.Id, "organization", organization.Name))
            .ToDictionaryAsync(item => item.Id, ct);
        var departments = await _db.Departments
            .Where(department => ids.Contains(department.Id))
            .Select(department => new EntitySummary(department.Id, "department", department.Name))
            .ToDictionaryAsync(item => item.Id, ct);
        var projects = await _db.Projects
            .Where(project => ids.Contains(project.Id))
            .Select(project => new EntitySummary(project.Id, "project", project.Name))
            .ToDictionaryAsync(item => item.Id, ct);
        var milestones = await _db.Milestones
            .Where(milestone => ids.Contains(milestone.Id))
            .Select(milestone => new EntitySummary(milestone.Id, "milestone", milestone.Name))
            .ToDictionaryAsync(item => item.Id, ct);
        var tasks = await _db.Tasks
            .Where(task => ids.Contains(task.Id))
            .Select(task => new EntitySummary(task.Id, task.ParentTaskId.HasValue ? "subtask" : "task", task.Title))
            .ToDictionaryAsync(item => item.Id, ct);

        var resolved = users
            .Concat(organizations)
            .Concat(departments)
            .Concat(projects)
            .Concat(milestones)
            .Concat(tasks)
            .GroupBy(item => item.Key)
            .ToDictionary(group => group.Key, group => group.First().Value);

        return logs.Select(log => MapLog(log, resolved)).ToList();
    }

    private static ActivityLogResponse MapLog(ActivityLog log, IReadOnlyDictionary<Guid, EntitySummary> resolved)
    {
        var metadata = DeserializeMetadata(log.MetadataJson);
        var ids = new[] { log.UserId }
            .Concat(log.ProjectId.HasValue ? new[] { log.ProjectId.Value } : Array.Empty<Guid>());

        metadata["resolvedEntities"] = ids
            .Distinct()
            .Where(resolved.ContainsKey)
            .Select(id => resolved[id])
            .Select(entity => new Dictionary<string, object>
            {
                ["id"] = entity.Id,
                ["type"] = entity.Type,
                ["name"] = entity.Name
            })
            .ToList();

        var userName = resolved.GetValueOrDefault(log.UserId)?.Name;
        var projectName = log.ProjectId.HasValue
            ? resolved.GetValueOrDefault(log.ProjectId.Value)?.Name
            : null;

        return new ActivityLogResponse(
            log.Id,
            log.UserId,
            userName,
            log.ProjectId,
            projectName,
            log.ActivityType,
            log.Description,
            log.Timestamp,
            metadata);
    }

    private static PaginationQuery ResolvePagination(int count, PaginationQuery? pagination)
        => pagination is { PageSize: > 0 }
            ? pagination
            : new PaginationQuery(1, count <= 0 ? 10 : count);

    private static Dictionary<string, object> DeserializeMetadata(string metadataJson)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object>>(metadataJson) ?? new Dictionary<string, object>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, object>();
        }
    }

    private sealed record EntitySummary(Guid Id, string Type, string Name);
}
