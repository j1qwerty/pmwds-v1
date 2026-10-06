using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Users;
using PMWDS.Application.DTOs.Workspace;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class WorkspaceController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;
    private readonly ICurrentUserService _currentUser;

    public WorkspaceController(
        IMediator mediator,
        ApplicationDbContext db,
        RoleScopeService scope,
        ICurrentUserService currentUser) : base(mediator)
    {
        _db = db;
        _scope = scope;
        _currentUser = currentUser;
    }

    [HttpGet("snapshot")]
    [ProducesResponseType(typeof(WorkspaceSnapshotDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSnapshot(CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var currentUserId))
        {
            return Unauthorized(new { message = "Authenticated user id is missing." });
        }

        var currentUser = await _db.Users
            .AsNoTracking()
            .AsSplitQuery()
            .Include(user => user.Department)
            .Include(user => user.DepartmentAssignments)
                .ThenInclude(assignment => assignment.Department)
                .ThenInclude(department => department!.Organization)
            .Include(user => user.Profile)
            .Include(user => user.Roles)
            .FirstOrDefaultAsync(user => user.Id == currentUserId, ct);

        if (currentUser == null)
        {
            return Unauthorized(new { message = "Authenticated user was not found." });
        }

        var roleNames = currentUser.Roles.Select(role => role.Name).ToList();
        // Cross the user -> roles -> permissions hops separately. Flattening them with nested
        // collection-correlated SelectMany calls made EF emit SQL Server's APPLY, which SQLite
        // cannot generate, so the bootstrap payload 500'd on the SQLite fallback. The Users.Any
        // filter is a correlated EXISTS and the projected collection compiles to an aggregating
        // subquery, both of which every provider translates.
        var permissionsByRole = await _db.Roles
            .AsNoTracking()
            .Where(role => role.Users.Any(user => user.Id == currentUserId && user.IsActive))
            .Select(role => role.Permissions.Select(permission => permission.Code).ToList())
            .ToListAsync(ct);

        var permissions = permissionsByRole
            .SelectMany(roleCodes => roleCodes)
            .Distinct()
            .OrderBy(code => code)
            .ToList();

        var userPageSize = ResolveUserPageSize(currentUser);

        var organizationsQuery = await _scope.ScopeOrganizationsAsync(
            _db.Organizations.AsNoTracking().OrderBy(organization => organization.Name),
            ct);
        var organizations = await organizationsQuery
            .Take(500)
            .Select(organization => new WorkspaceOrganizationDto(
                organization.Id,
                organization.Name,
                organization.TaxId,
                organization.Address,
                organization.ContactEmail,
                organization.ContactPhone,
                organization.FoundedDate,
                organization.Departments.Count))
            .ToListAsync(ct);

        var departmentsQuery = await _scope.ScopeDepartmentsAsync(
            _db.Departments.AsNoTracking().OrderBy(department => department.Name),
            ct);
        var departments = await departmentsQuery
            .Take(500)
            .Select(department => new WorkspaceDepartmentDto(
                department.Id,
                department.Name,
                department.Code,
                department.Description,
                department.OrganizationId,
                department.ParentDepartmentId,
                department.DepartmentHeadUserId,
                department.MaxCapacity,
                // Mirrors Department.CalculateCapacityUtilization(), expressed so EF
                // can translate it into the SQL projection.
                department.MaxCapacity == 0
                    ? 0
                    : (double)department.Members.Count() / department.MaxCapacity * 100))
            .ToListAsync(ct);

        var usersQuery = await _scope.ScopeUsersAsync(
            _db.Users.AsNoTracking().OrderBy(user => user.FirstName).ThenBy(user => user.LastName),
            ct);
        var users = await usersQuery
            .Take(500)
            .Select(user => new WorkspaceUserDto(
                user.Id.ToString(),
                user.FirstName,
                user.LastName,
                user.FirstName + " " + user.LastName,
                user.Email,
                user.ProfilePictureUrl,
                user.Profile != null ? (user.Profile.JobTitle ?? user.JobTitle) : user.JobTitle,
                user.OrganizationId ?? (user.Department != null ? user.Department.OrganizationId : null),
                user.Department != null ? user.Department.Name : null,
                user.DepartmentId,
                user.AvailabilityPercentage,
                user.AIWorkloadScore,
                user.AIBurnoutRiskScore,
                user.AIPerformanceScore,
                user.TaskAssignments.Count(assignment => assignment.Task != null &&
                    assignment.Task.Status == PMWDS.Domain.Enums.TaskStatus.InProgress),
                user.IsActive,
                user.Roles.Select(role => role.Name).ToList(),
                user.Roles.Select(role => role.Key).Where(key => !string.IsNullOrWhiteSpace(key)).ToList()))
            .ToListAsync(ct);

        var projectsQuery = await _scope.ScopeProjectsAsync(_db.Projects.AsNoTracking(), ct);
        var projectRows = await projectsQuery
            .OrderByDescending(project => project.CreatedDate)
            .Take(Math.Clamp(userPageSize * 2, 10, 100))
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.Priority,
                project.DepartmentId,
                project.ProgressPercentage,
                project.AIDelayRiskScore,
                TotalTasks = project.Tasks.Count,
                project.CreatedDate
            })
            .ToListAsync(ct);

        var projectIds = projectRows.Select(project => project.Id).ToList();
        var projectDepartmentRows = await _db.ProjectDepartments
            .AsNoTracking()
            .Where(assignment => projectIds.Contains(assignment.ProjectId))
            .Select(assignment => new { assignment.ProjectId, assignment.DepartmentId })
            .ToListAsync(ct);

        var departmentIdsByProjectId = projectDepartmentRows
            .GroupBy(assignment => assignment.ProjectId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(assignment => assignment.DepartmentId).Distinct().ToList());

        var projects = projectRows
            .Select(project => new ProjectNavigationDto(
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status.ToString(),
                project.Priority.ToString(),
                project.DepartmentId,
                departmentIdsByProjectId.TryGetValue(project.Id, out var departmentIds) && departmentIds.Count > 0
                    ? departmentIds
                    : new List<Guid> { project.DepartmentId },
                project.ProgressPercentage,
                (double)project.AIDelayRiskScore,
                project.TotalTasks,
                project.TotalTasks == 0,
                project.CreatedDate))
            .ToList();

        var unreadNotificationCount = await _db.Notifications
            .AsNoTracking()
            .CountAsync(notification =>
                notification.UserId == currentUserId.ToString() &&
                !notification.IsRead,
                ct);

        return Ok(new WorkspaceSnapshotDto(
            DateTime.UtcNow,
            UserDto.FromEntity(currentUser, roleNames),
            permissions,
            projects,
            organizations,
            departments,
            users,
            unreadNotificationCount,
            userPageSize));
    }

    [HttpGet("bootstrap")]
    [ProducesResponseType(typeof(WorkspaceBootstrapDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBootstrap(CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var currentUserId))
        {
            return Unauthorized(new { message = "Authenticated user id is missing." });
        }

        var currentUser = await _db.Users
            .AsNoTracking()
            .Include(user => user.Department)
            .Include(user => user.DepartmentAssignments)
                .ThenInclude(assignment => assignment.Department)
                .ThenInclude(department => department!.Organization)
            .Include(user => user.Profile)
            .Include(user => user.Roles)
                .ThenInclude(role => role.Permissions)
            .FirstOrDefaultAsync(user => user.Id == currentUserId, ct);

        if (currentUser == null)
        {
            return Unauthorized(new { message = "Authenticated user was not found." });
        }

        var roleNames = currentUser.Roles.Select(role => role.Name).ToList();
        var permissions = currentUser.Roles
            .SelectMany(role => role.Permissions)
            .Select(permission => permission.Code)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(code => code)
            .ToList();
        var userPageSize = ResolveUserPageSize(currentUser);

        var projectsQuery = await _scope.ScopeProjectsAsync(_db.Projects.AsNoTracking(), ct);
        var projectRows = await projectsQuery
            .OrderByDescending(project => project.CreatedDate)
            .Take(Math.Clamp(userPageSize * 2, 10, 100))
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.Priority,
                project.DepartmentId,
                project.ProgressPercentage,
                project.AIDelayRiskScore,
                TotalTasks = project.Tasks.Count,
                project.CreatedDate
            })
            .ToListAsync(ct);
        var projectIds = projectRows.Select(project => project.Id).ToList();
        var projectDepartmentRows = await _db.ProjectDepartments
            .AsNoTracking()
            .Where(assignment => projectIds.Contains(assignment.ProjectId))
            .Select(assignment => new { assignment.ProjectId, assignment.DepartmentId })
            .ToListAsync(ct);
        var departmentIdsByProjectId = projectDepartmentRows
            .GroupBy(assignment => assignment.ProjectId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(assignment => assignment.DepartmentId).Distinct().ToList());
        var projects = projectRows
            .Select(project => new ProjectNavigationDto(
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status.ToString(),
                project.Priority.ToString(),
                project.DepartmentId,
                departmentIdsByProjectId.TryGetValue(project.Id, out var departmentIds) && departmentIds.Count > 0
                    ? departmentIds
                    : new List<Guid> { project.DepartmentId },
                project.ProgressPercentage,
                (double)project.AIDelayRiskScore,
                project.TotalTasks,
                project.TotalTasks == 0,
                project.CreatedDate))
            .ToList();

        var unreadNotificationCount = await _db.Notifications
            .AsNoTracking()
            .CountAsync(notification =>
                notification.UserId == currentUserId.ToString() &&
                !notification.IsRead,
                ct);

        return Ok(new WorkspaceBootstrapDto(
            GeneratedAt: DateTime.UtcNow,
            CurrentUser: UserDto.FromEntity(currentUser, roleNames),
            Permissions: permissions,
            Projects: projects,
            UnreadNotificationCount: unreadNotificationCount,
            UserPageSize: userPageSize));
    }

    private static int ResolveUserPageSize(Domain.Entities.ApplicationUser user)
    {
        var rolePageSize = user.Roles
            .Select(role => role.PaginationPageSize)
            .Where(size => size > 0)
            .DefaultIfEmpty(10)
            .Max();

        return Math.Clamp(rolePageSize, 1, 500);
    }
}
