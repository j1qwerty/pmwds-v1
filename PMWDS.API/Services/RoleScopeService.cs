using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Services;

public class RoleScopeService
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IMemoryCache _cache;
    private ScopeSnapshot? _scopeSnapshot;
    private HashSet<string>? _permissionSnapshot;

    public RoleScopeService(ApplicationDbContext db, ICurrentUserService currentUser, IMemoryCache cache)
    {
        _db = db;
        _currentUser = currentUser;
        _cache = cache;
    }

    public bool IsSuperAdmin => _currentUser.IsInRole(RoleKeys.SuperAdmin);
    public bool IsDirector => _currentUser.IsInRole(RoleKeys.Director);
    public bool IsDepartmentHead => _currentUser.IsInRole(RoleKeys.DepartmentHead);
    public bool IsProjectManager => _currentUser.IsInRole(RoleKeys.ProjectManager);
    public bool IsTeamMember => _currentUser.IsInRole(RoleKeys.TeamMember);

    public Guid? CurrentUserId =>
        Guid.TryParse(_currentUser.UserId, out var userId) ? userId : null;

    public async Task<List<Guid>> GetOrganizationIdsAsync(CancellationToken ct)
        => (await GetScopeSnapshotAsync(ct)).OrganizationIds.ToList();

    public async Task<List<Guid>> GetDepartmentIdsAsync(CancellationToken ct)
        => (await GetScopeSnapshotAsync(ct)).DepartmentIds.ToList();

    public async Task<IQueryable<Organization>> ScopeOrganizationsAsync(IQueryable<Organization> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        return query.Where(organization => organizationIds.Contains(organization.Id));
    }

    public async Task<IQueryable<Department>> ScopeDepartmentsAsync(IQueryable<Department> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        return query.Where(department => department.OrganizationId.HasValue && organizationIds.Contains(department.OrganizationId.Value));
    }

    public async Task<IQueryable<Project>> ScopeProjectsAsync(IQueryable<Project> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        if (IsDepartmentHead && !IsDirector)
        {
            var departmentIds = await GetDepartmentIdsAsync(ct);
            var canAccessPrimaryDepartmentProjects = await HasPermissionAsync(PermissionCodes.ProjectPrimaryDepartmentManage, ct);
            return query.Where(project =>
                (canAccessPrimaryDepartmentProjects && departmentIds.Contains(project.DepartmentId)) ||
                project.ProjectDepartments.Any(pd =>
                    departmentIds.Contains(pd.DepartmentId)) ||
                project.Milestones.Any(m =>
                    m.DepartmentId.HasValue &&
                    departmentIds.Contains(m.DepartmentId.Value)));
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        return query.Where(project =>
            (project.Department != null &&
                project.Department.OrganizationId.HasValue &&
                organizationIds.Contains(project.Department.OrganizationId.Value)) ||
            project.ProjectDepartments.Any(assignment =>
                assignment.Department != null &&
                assignment.Department.OrganizationId.HasValue &&
                organizationIds.Contains(assignment.Department.OrganizationId.Value)));
    }

    public async Task<IQueryable<ApplicationUser>> ScopeUsersAsync(IQueryable<ApplicationUser> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);

        if (IsDepartmentHead && !IsDirector)
        {
            var departmentIds = await GetDepartmentIdsAsync(ct);
            return query.Where(user =>
                !user.Roles.Any(role => role.Key == RoleKeys.SuperAdmin) &&
                (
                    (user.OrganizationId.HasValue && organizationIds.Contains(user.OrganizationId.Value)) ||
                    user.DepartmentAssignments.Any(assignment => departmentIds.Contains(assignment.DepartmentId)) ||
                    (user.DepartmentId.HasValue && departmentIds.Contains(user.DepartmentId.Value)) ||
                    user.Roles.Any(role => (role.Key == RoleKeys.Director || role.Key == RoleKeys.DepartmentHead) &&
                        user.DepartmentAssignments.Any(assignment =>
                            assignment.Department != null &&
                            assignment.Department.OrganizationId.HasValue &&
                            organizationIds.Contains(assignment.Department.OrganizationId.Value)))
                ));
        }

        return query.Where(user =>
            !user.Roles.Any(role => role.Key == RoleKeys.SuperAdmin) &&
            (
                (user.OrganizationId.HasValue && organizationIds.Contains(user.OrganizationId.Value)) ||
                user.DepartmentAssignments.Any(assignment =>
                    assignment.Department != null &&
                    assignment.Department.OrganizationId.HasValue &&
                    organizationIds.Contains(assignment.Department.OrganizationId.Value)) ||
                (user.Department != null &&
                    user.Department.OrganizationId.HasValue &&
                    organizationIds.Contains(user.Department.OrganizationId.Value))
            ));
    }

    public async Task<bool> CanAccessOrganizationAsync(Guid organizationId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        return organizationIds.Contains(organizationId);
    }

    public async Task<bool> CanAccessDepartmentAsync(Guid departmentId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (IsDepartmentHead && CurrentUserId is not null)
        {
            var deptHeadUserId = await _db.Departments
                .Where(d => d.Id == departmentId)
                .Select(d => d.DepartmentHeadUserId)
                .FirstOrDefaultAsync(ct);
            if (deptHeadUserId == CurrentUserId.ToString()) return true;
        }

        var department = await _db.Departments
            .Where(item => item.Id == departmentId)
            .Select(item => new { item.OrganizationId })
            .FirstOrDefaultAsync(ct);

        return department?.OrganizationId is { } organizationId &&
            await CanAccessOrganizationAsync(organizationId, ct);
    }

    public async Task<bool> CanManageOrganizationAsync(Guid organizationId, CancellationToken ct)
        => IsSuperAdmin || (IsDirector && await CanAccessOrganizationAsync(organizationId, ct));

    public async Task<bool> CanManageDepartmentAsync(Guid departmentId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var department = await _db.Departments
            .Where(item => item.Id == departmentId)
            .Select(item => new { item.OrganizationId, item.DepartmentHeadUserId })
            .FirstOrDefaultAsync(ct);

        if (department == null)
        {
            return false;
        }

        if (IsDirector && department.OrganizationId.HasValue &&
            await CanAccessOrganizationAsync(department.OrganizationId.Value, ct))
        {
            return true;
        }

        return IsDepartmentHead &&
            CurrentUserId?.ToString() == department.DepartmentHeadUserId;
    }

    public async Task<bool> CanManageProjectAsync(Guid projectId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var project = await _db.Projects
            .Where(item => item.Id == projectId)
            .Select(item => new
            {
                item.ProjectManagerId,
                item.DepartmentId,
                OrganizationId = item.Department != null ? item.Department.OrganizationId : null,
                AssignedDepartmentIds = item.ProjectDepartments
                    .Select(assignment => assignment.DepartmentId)
                    .ToList(),
                AssignedOrganizationIds = item.ProjectDepartments
                    .Where(assignment => assignment.Department != null && assignment.Department.OrganizationId.HasValue)
                    .Select(assignment => assignment.Department!.OrganizationId!.Value)
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (project == null)
        {
            return false;
        }

        if (IsProjectManager && CurrentUserId == project.ProjectManagerId)
        {
            return true;
        }

        if (IsDepartmentHead && !IsDirector)
        {
            var departmentIds = await GetDepartmentIdsAsync(ct);
            return departmentIds.Contains(project.DepartmentId) &&
                await HasPermissionAsync(PermissionCodes.ProjectPrimaryDepartmentManage, ct);
        }

        if (IsDirector && project.OrganizationId.HasValue &&
            await CanAccessOrganizationAsync(project.OrganizationId.Value, ct))
        {
            return true;
        }

        if (IsDirector)
        {
            foreach (var organizationId in project.AssignedOrganizationIds)
            {
                if (await CanAccessOrganizationAsync(organizationId, ct))
                {
                    return true;
                }
            }
        }

        return false;
    }

    public async Task<bool> CanAccessProjectAsync(Guid projectId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var projectOrganizations = await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => new
            {
                PrimaryOrganizationId = project.Department != null ? project.Department.OrganizationId : null,
                project.DepartmentId,
                AssignedDepartmentIds = project.ProjectDepartments
                    .Select(assignment => assignment.DepartmentId)
                    .ToList(),
                MilestoneDepartmentIds = project.Milestones
                    .Where(milestone => milestone.DepartmentId.HasValue)
                    .Select(milestone => milestone.DepartmentId!.Value)
                    .ToList(),
                AssignedOrganizationIds = project.ProjectDepartments
                    .Where(assignment => assignment.Department != null && assignment.Department.OrganizationId.HasValue)
                    .Select(assignment => assignment.Department!.OrganizationId!.Value)
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (projectOrganizations == null)
        {
            return false;
        }

        if (IsDepartmentHead && !IsDirector)
        {
            var departmentIds = await GetDepartmentIdsAsync(ct);
            if (departmentIds.Contains(projectOrganizations.DepartmentId) &&
                await HasPermissionAsync(PermissionCodes.ProjectPrimaryDepartmentManage, ct))
            {
                return true;
            }

            return projectOrganizations.AssignedDepartmentIds.Any(departmentIds.Contains) ||
                projectOrganizations.MilestoneDepartmentIds.Any(departmentIds.Contains);
        }

        if (projectOrganizations.PrimaryOrganizationId.HasValue &&
            await CanAccessOrganizationAsync(projectOrganizations.PrimaryOrganizationId.Value, ct))
        {
            return true;
        }

        foreach (var organizationId in projectOrganizations.AssignedOrganizationIds)
        {
            if (await CanAccessOrganizationAsync(organizationId, ct))
            {
                return true;
            }
        }

        return false;
    }

    public async Task<bool> CanAccessProjectAsPrimaryDepartmentAsync(Guid projectId, CancellationToken ct)
    {
        if (IsSuperAdmin || IsDirector)
        {
            return true;
        }

        if (!IsDepartmentHead || !await HasPermissionAsync(PermissionCodes.ProjectPrimaryDepartmentManage, ct))
        {
            return false;
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        return await _db.Projects
            .AnyAsync(project => project.Id == projectId && departmentIds.Contains(project.DepartmentId), ct);
    }

    public async Task<bool> CanAccessUserAsync(Guid userId, CancellationToken ct)
    {
        if (IsSuperAdmin || CurrentUserId == userId)
        {
            return true;
        }

        var isSuperAdminUser = await _db.Users
            .Where(user => user.Id == userId)
            .Select(user => user.Roles.Any(role => role.Key == RoleKeys.SuperAdmin))
            .FirstOrDefaultAsync(ct);
        if (isSuperAdminUser)
        {
            return false;
        }

        var scopedUserIds = await (await ScopeUsersAsync(_db.Users.AsQueryable(), ct))
            .Where(user => user.Id == userId)
            .Select(user => user.Id)
            .ToListAsync(ct);
        return scopedUserIds.Count > 0;
    }

    public async Task<bool> CanManageUserAsync(Guid userId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        return IsDirector && await CanAccessUserAsync(userId, ct);
    }

    private async Task<ScopeSnapshot> GetScopeSnapshotAsync(CancellationToken ct)
    {
        if (_scopeSnapshot != null)
        {
            return _scopeSnapshot;
        }

        if (CurrentUserId is not { } userId)
        {
            _scopeSnapshot = ScopeSnapshot.Empty;
            return _scopeSnapshot;
        }

        var cacheKey = $"pmwds:user-scope:{userId:N}";
        if (!_cache.TryGetValue(cacheKey, out ScopeSnapshot? cachedScope))
        {
            var userScope = await _db.Users
                .AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => new
                {
                    user.OrganizationId,
                    user.DepartmentId,
                    PrimaryDepartmentOrganizationId = user.Department != null
                        ? user.Department.OrganizationId
                        : null,
                    Assignments = user.DepartmentAssignments
                        .Select(assignment => new
                        {
                            assignment.DepartmentId,
                            OrganizationId = assignment.Department != null
                                ? assignment.Department.OrganizationId
                                : null
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync(ct);

            if (userScope == null)
            {
                cachedScope = ScopeSnapshot.Empty;
            }
            else
            {
                var organizationIds = new HashSet<Guid>();
                var departmentIds = new HashSet<Guid>();

                if (userScope.OrganizationId.HasValue)
                {
                    organizationIds.Add(userScope.OrganizationId.Value);
                }

                if (userScope.PrimaryDepartmentOrganizationId.HasValue)
                {
                    organizationIds.Add(userScope.PrimaryDepartmentOrganizationId.Value);
                }

                if (userScope.DepartmentId.HasValue)
                {
                    departmentIds.Add(userScope.DepartmentId.Value);
                }

                foreach (var assignment in userScope.Assignments)
                {
                    departmentIds.Add(assignment.DepartmentId);
                    if (assignment.OrganizationId.HasValue)
                    {
                        organizationIds.Add(assignment.OrganizationId.Value);
                    }
                }

                cachedScope = new ScopeSnapshot(organizationIds, departmentIds);
            }

            _cache.Set(cacheKey, cachedScope, TimeSpan.FromSeconds(5));
        }

        _scopeSnapshot = cachedScope ?? ScopeSnapshot.Empty;
        return _scopeSnapshot;
    }

    private async Task<bool> HasPermissionAsync(string permissionCode, CancellationToken ct)
    {
        var permissions = await GetPermissionSnapshotAsync(ct);
        if (permissions.Contains(PermissionCodes.SystemAdmin) || permissions.Contains(permissionCode))
        {
            return true;
        }

        return permissionCode == PermissionCodes.ProjectPrimaryDepartmentManage &&
            permissions.Contains(PermissionCodes.ProjectManage);
    }

    /// <summary>
    /// Checks any of <paramref name="permissionCodes"/>, expanding the
    /// <c>*_MANAGE</c> umbrella permissions the same way the authorization handler does.
    /// Use this when the client needs a capability flag that must agree with what
    /// the API will actually allow.
    /// </summary>
    public async Task<bool> HasAnyPermissionAsync(CancellationToken ct, params string[] permissionCodes)
    {
        var permissions = await GetPermissionSnapshotAsync(ct);
        if (permissions.Contains(PermissionCodes.SystemAdmin))
        {
            return true;
        }

        var effective = new HashSet<string>(permissions, StringComparer.OrdinalIgnoreCase);
        foreach (var permission in permissions)
        {
            if (!PermissionCatalog.ManagePermissionCoverage.TryGetValue(permission, out var covered))
            {
                continue;
            }

            foreach (var coveredPermission in covered)
            {
                effective.Add(coveredPermission);
            }
        }

        return permissionCodes.Any(code => !string.IsNullOrWhiteSpace(code) && effective.Contains(code));
    }

    private async Task<HashSet<string>> GetPermissionSnapshotAsync(CancellationToken ct)
    {
        if (_permissionSnapshot != null)
        {
            return _permissionSnapshot;
        }

        if (CurrentUserId is not { } userId)
        {
            _permissionSnapshot = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            return _permissionSnapshot;
        }

        var cacheKey = $"pmwds:user-permissions:{userId:N}";
        if (!_cache.TryGetValue(cacheKey, out HashSet<string>? cachedPermissions))
        {
            var permissions = await _db.Users
                .AsNoTracking()
                .Where(user => user.Id == userId && user.IsActive)
                .SelectMany(user => user.Roles)
                .SelectMany(role => role.Permissions)
                .Select(permission => permission.Code)
                .Distinct()
                .ToListAsync(ct);

            cachedPermissions = permissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
            _cache.Set(cacheKey, cachedPermissions, TimeSpan.FromSeconds(5));
        }

        _permissionSnapshot = new HashSet<string>(
            cachedPermissions ?? Enumerable.Empty<string>(),
            StringComparer.OrdinalIgnoreCase);
        return _permissionSnapshot;
    }

    private sealed record ScopeSnapshot(HashSet<Guid> OrganizationIds, HashSet<Guid> DepartmentIds)
    {
        public static ScopeSnapshot Empty { get; } = new(new HashSet<Guid>(), new HashSet<Guid>());
    }
}
