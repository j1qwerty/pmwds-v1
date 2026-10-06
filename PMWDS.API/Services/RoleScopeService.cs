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

        if (!await HasAnyPermissionAsync(
            ct,
            PermissionCodes.OrganizationView,
            PermissionCodes.OrganizationManage,
            PermissionCodes.OrganizationCreate,
            PermissionCodes.OrganizationEdit,
            PermissionCodes.OrganizationDelete))
        {
            return query.Where(_ => false);
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

        var hasAll = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentAllView,
            PermissionCodes.DepartmentAllManage,
            PermissionCodes.DepartmentAllCreate,
            PermissionCodes.DepartmentAllEdit,
            PermissionCodes.DepartmentAllDelete);

        if (hasAll)
        {
            var organizationIds = await GetOrganizationIdsAsync(ct);
            return query.Where(department =>
                department.OrganizationId.HasValue &&
                organizationIds.Contains(department.OrganizationId.Value));
        }

        var hasOwn = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentOwnView,
            PermissionCodes.DepartmentOwnManage,
            PermissionCodes.DepartmentOwnCreate,
            PermissionCodes.DepartmentOwnEdit,
            PermissionCodes.DepartmentOwnDelete);

        if (!hasOwn)
        {
            return query.Where(_ => false);
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        return query.Where(department => departmentIds.Contains(department.Id));
    }

    public async Task<IQueryable<Project>> ScopeProjectsAsync(IQueryable<Project> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        var hasAll = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.ProjectAllView,
            PermissionCodes.ProjectAllManage,
            PermissionCodes.ProjectAllEdit,
            PermissionCodes.ProjectAllDelete);

        if (hasAll)
        {
            return query.Where(project =>
                (project.Department != null &&
                 project.Department.OrganizationId.HasValue &&
                 organizationIds.Contains(project.Department.OrganizationId.Value)) ||
                project.ProjectDepartments.Any(assignment =>
                    assignment.Department != null &&
                    assignment.Department.OrganizationId.HasValue &&
                    organizationIds.Contains(assignment.Department.OrganizationId.Value)));
        }

        var hasOwn = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.ProjectOwnView,
            PermissionCodes.ProjectOwnManage,
            PermissionCodes.ProjectOwnEdit,
            PermissionCodes.ProjectOwnDelete,
            PermissionCodes.ProjectPrimaryDepartmentManage);

        if (!hasOwn)
        {
            return query.Where(_ => false);
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        return query.Where(project =>
            (departmentIds.Contains(project.DepartmentId) &&
             project.ProjectDepartments.Any(assignment =>
                 assignment.ProjectId == project.Id && assignment.IsPrimary)) ||
            project.ProjectDepartments.Any(assignment =>
                departmentIds.Contains(assignment.DepartmentId)) ||
            project.Milestones.Any(milestone =>
                milestone.DepartmentId.HasValue &&
                departmentIds.Contains(milestone.DepartmentId.Value)));
    }

    public async Task<IQueryable<ApplicationUser>> ScopeUsersAsync(IQueryable<ApplicationUser> query, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        var hasAll = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.UserAllView,
            PermissionCodes.UserAllManage,
            PermissionCodes.UserAllCreate,
            PermissionCodes.UserAllEdit,
            PermissionCodes.UserAllDelete);

        if (hasAll)
        {
            var organizationIds = await GetOrganizationIdsAsync(ct);
            return query.Where(user =>
                !user.Roles.Any(role => role.Permissions.Any(permission => permission.Code == PermissionCodes.SystemAdmin)) &&
                (
                    (user.OrganizationId.HasValue && organizationIds.Contains(user.OrganizationId.Value)) ||
                    user.DepartmentAssignments.Any(assignment =>
                        assignment.Department != null &&
                        assignment.Department.OrganizationId.HasValue &&
                        organizationIds.Contains(assignment.Department.OrganizationId.Value))
                ));
        }

        var hasOwn = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.UserOwnView,
            PermissionCodes.UserOwnManage,
            PermissionCodes.UserOwnCreate,
            PermissionCodes.UserOwnEdit,
            PermissionCodes.UserOwnDelete);

        if (!hasOwn)
        {
            return query.Where(_ => false);
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        return query.Where(user =>
            !user.Roles.Any(role => role.Permissions.Any(permission => permission.Code == PermissionCodes.SystemAdmin)) &&
            (
                (user.DepartmentId.HasValue && departmentIds.Contains(user.DepartmentId.Value)) ||
                user.DepartmentAssignments.Any(assignment => departmentIds.Contains(assignment.DepartmentId))
            ));
    }

    public async Task<bool> CanAccessOrganizationAsync(Guid organizationId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(
            ct,
            PermissionCodes.OrganizationView,
            PermissionCodes.OrganizationManage,
            PermissionCodes.OrganizationCreate,
            PermissionCodes.OrganizationEdit,
            PermissionCodes.OrganizationDelete))
        {
            return false;
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

        var department = await _db.Departments
            .Where(item => item.Id == departmentId)
            .Select(item => new { item.OrganizationId })
            .FirstOrDefaultAsync(ct);

        if (department == null)
        {
            return false;
        }

        if (await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentAllView,
            PermissionCodes.DepartmentAllManage,
            PermissionCodes.DepartmentAllCreate,
            PermissionCodes.DepartmentAllEdit,
            PermissionCodes.DepartmentAllDelete))
        {
            return department.OrganizationId.HasValue &&
                await CanAccessOrganizationScopeAsync(department.OrganizationId.Value, ct);
        }

        return await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentOwnView,
            PermissionCodes.DepartmentOwnManage,
            PermissionCodes.DepartmentOwnCreate,
            PermissionCodes.DepartmentOwnEdit,
            PermissionCodes.DepartmentOwnDelete) &&
            (await GetDepartmentIdsAsync(ct)).Contains(departmentId);
    }

    public async Task<bool> CanManageOrganizationAsync(Guid organizationId, CancellationToken ct)
        => IsSuperAdmin ||
           await HasAnyPermissionAsync(
               ct,
               PermissionCodes.OrganizationManage,
               PermissionCodes.OrganizationEdit,
               PermissionCodes.OrganizationDelete) &&
           await CanAccessOrganizationScopeAsync(organizationId, ct);

    public async Task<bool> CanManageDepartmentAsync(Guid departmentId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var all = await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentAllManage,
            PermissionCodes.DepartmentAllEdit,
            PermissionCodes.DepartmentAllDelete);
        if (all)
        {
            var organizationId = await _db.Departments
                .Where(item => item.Id == departmentId)
                .Select(item => item.OrganizationId)
                .FirstOrDefaultAsync(ct);
            return organizationId.HasValue && await CanAccessOrganizationScopeAsync(organizationId.Value, ct);
        }

        return await HasAnyPermissionAsync(
            ct,
            PermissionCodes.DepartmentOwnManage,
            PermissionCodes.DepartmentOwnEdit,
            PermissionCodes.DepartmentOwnDelete) &&
            (await GetDepartmentIdsAsync(ct)).Contains(departmentId);
    }

    private async Task<bool> CanAccessOrganizationScopeAsync(Guid organizationId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var organizationIds = await GetOrganizationIdsAsync(ct);
        return organizationIds.Contains(organizationId);
    }

    public async Task<bool> CanAccessProjectDocumentAsync(
        Guid projectId,
        Guid? milestoneId,
        Guid? taskId,
        CancellationToken ct,
        string ownViewPermission,
        string allViewPermission,
        string ownManagePermission,
        string allManagePermission)
    {
        if (!await CanAccessProjectAsync(projectId, ct))
        {
            return false;
        }

        if (await CanSeeFullProjectDetailsAsync(projectId, ct) ||
            await HasAnyPermissionAsync(ct, allViewPermission, allManagePermission))
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(ct, ownViewPermission, ownManagePermission))
        {
            return false;
        }

        var departmentId = await ResolveWorkItemDepartmentIdAsync(projectId, milestoneId, taskId, ct);
        return departmentId.HasValue &&
            (await GetDepartmentIdsAsync(ct)).Contains(departmentId.Value);
    }

    public async Task<bool> CanUploadProjectDocumentAsync(
        Guid projectId,
        Guid? milestoneId,
        Guid? taskId,
        CancellationToken ct,
        string ownUploadPermission,
        string allUploadPermission)
    {
        if (!await CanAccessProjectAsync(projectId, ct))
        {
            return false;
        }

        if (await HasAnyPermissionAsync(ct, allUploadPermission))
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(ct, ownUploadPermission))
        {
            return false;
        }

        var departmentId = await ResolveWorkItemDepartmentIdAsync(projectId, milestoneId, taskId, ct);
        return departmentId.HasValue &&
            (await GetDepartmentIdsAsync(ct)).Contains(departmentId.Value);
    }

    private async Task<Guid?> ResolveWorkItemDepartmentIdAsync(
        Guid projectId,
        Guid? milestoneId,
        Guid? taskId,
        CancellationToken ct)
    {
        if (taskId.HasValue)
        {
            return await _db.Tasks
                .Where(task => task.Id == taskId.Value && task.ProjectId == projectId)
                .Select(task => task.Milestone != null
                    ? task.Milestone.DepartmentId
                    : (Guid?)null)
                .FirstOrDefaultAsync(ct);
        }

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

    public async Task<bool> CanAccessKnowledgeAsync(Guid? projectId, CancellationToken ct)
    {
        if (IsSuperAdmin ||
            await HasAnyPermissionAsync(
                ct,
                PermissionCodes.KnowledgeAllView,
                PermissionCodes.KnowledgeAllManage,
                PermissionCodes.KnowledgeAllCreate,
                PermissionCodes.KnowledgeAllEdit,
                PermissionCodes.KnowledgeAllDelete))
        {
            return !projectId.HasValue || await CanAccessProjectAsync(projectId.Value, ct);
        }

        if (!projectId.HasValue)
        {
            return false;
        }

        return await CanAccessProjectDataAsync(
            projectId.Value,
            null,
            ct,
            PermissionCodes.KnowledgeOwnView,
            PermissionCodes.KnowledgeAllView,
            PermissionCodes.KnowledgeOwnManage,
            PermissionCodes.KnowledgeAllManage);
    }

    public async Task<bool> CanAccessProjectDataAsync(
        Guid projectId,
        Guid? departmentId,
        CancellationToken ct,
        string ownPermission,
        string allPermission,
        string ownManagePermission,
        string allManagePermission)
    {
        if (!await CanAccessProjectAsync(projectId, ct))
        {
            return false;
        }

        if (await HasAnyPermissionAsync(ct, allPermission, allManagePermission) ||
            await CanSeeFullProjectDetailsAsync(projectId, ct))
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(ct, ownPermission, ownManagePermission))
        {
            return false;
        }

        var effectiveDepartmentId = departmentId ?? await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => (Guid?)project.DepartmentId)
            .FirstOrDefaultAsync(ct);

        return effectiveDepartmentId.HasValue &&
            (await GetDepartmentIdsAsync(ct)).Contains(effectiveDepartmentId.Value);
    }

    public async Task<bool> CanCreateProjectChildAsync(
        Guid projectId,
        Guid? departmentId,
        CancellationToken ct,
        string ownPermission,
        string allPermission,
        string ownManagePermission,
        string allManagePermission)
    {
        if (!await CanAccessProjectAsync(projectId, ct))
        {
            return false;
        }

        if (await HasAnyPermissionAsync(ct, allPermission, allManagePermission))
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(ct, ownPermission, ownManagePermission))
        {
            return false;
        }

        var effectiveDepartmentId = departmentId ?? await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => (Guid?)project.DepartmentId)
            .FirstOrDefaultAsync(ct);

        return effectiveDepartmentId.HasValue &&
            (await GetDepartmentIdsAsync(ct)).Contains(effectiveDepartmentId.Value);
    }

    public async Task<bool> CanModifyProjectChildAsync(
        Guid projectId,
        Guid? departmentId,
        CancellationToken ct,
        string ownPermission,
        string allPermission,
        string ownManagePermission,
        string allManagePermission)
    {
        if (!await CanAccessProjectAsync(projectId, ct))
        {
            return false;
        }

        if (await HasAnyPermissionAsync(ct, allPermission, allManagePermission))
        {
            return true;
        }

        if (!await HasAnyPermissionAsync(ct, ownPermission, ownManagePermission))
        {
            return false;
        }

        var effectiveDepartmentId = departmentId ?? await _db.Projects
            .Where(project => project.Id == projectId)
            .Select(project => (Guid?)project.DepartmentId)
            .FirstOrDefaultAsync(ct);

        return effectiveDepartmentId.HasValue &&
            (await GetDepartmentIdsAsync(ct)).Contains(effectiveDepartmentId.Value);
    }

    public async Task<bool> CanCreateProjectAsync(Guid primaryDepartmentId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (await HasAnyPermissionAsync(ct, PermissionCodes.ProjectAllCreate, PermissionCodes.ProjectAllManage))
        {
            return await CanAccessDepartmentAsync(primaryDepartmentId, ct);
        }

        return await HasAnyPermissionAsync(ct, PermissionCodes.ProjectOwnCreate, PermissionCodes.ProjectOwnManage) &&
            (await GetDepartmentIdsAsync(ct)).Contains(primaryDepartmentId);
    }

    public async Task<bool> CanEditProjectAsync(Guid projectId, CancellationToken ct)
        => await CanModifyProjectAsync(
            projectId,
            ct,
            PermissionCodes.ProjectOwnEdit,
            PermissionCodes.ProjectAllEdit,
            PermissionCodes.ProjectOwnManage,
            PermissionCodes.ProjectAllManage);

    public async Task<bool> CanDeleteProjectAsync(Guid projectId, CancellationToken ct)
        => await CanModifyProjectAsync(
            projectId,
            ct,
            PermissionCodes.ProjectOwnDelete,
            PermissionCodes.ProjectAllDelete,
            PermissionCodes.ProjectOwnManage,
            PermissionCodes.ProjectAllManage);

    public async Task<bool> CanManageProjectAsync(Guid projectId, CancellationToken ct)
        => await CanModifyProjectAsync(
            projectId,
            ct,
            PermissionCodes.ProjectOwnEdit,
            PermissionCodes.ProjectAllEdit,
            PermissionCodes.ProjectOwnDelete,
            PermissionCodes.ProjectAllDelete,
            PermissionCodes.ProjectOwnManage,
            PermissionCodes.ProjectAllManage,
            PermissionCodes.ProjectPrimaryDepartmentManage);

    private async Task<bool> CanModifyProjectAsync(
        Guid projectId,
        CancellationToken ct,
        params string[] permissionCodes)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var project = await _db.Projects
            .Where(item => item.Id == projectId)
            .Select(item => new
            {
                item.DepartmentId,
                OrganizationId = item.Department != null ? item.Department.OrganizationId : null,
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

        var permissions = await GetPermissionSnapshotAsync(ct);
        var hasAll = permissionCodes
            .Where(code => code.Contains("_All", StringComparison.Ordinal))
            .Any(permissions.Contains);
        if (hasAll)
        {
            if (project.OrganizationId.HasValue && await CanAccessOrganizationAsync(project.OrganizationId.Value, ct))
            {
                return true;
            }

            foreach (var organizationId in project.AssignedOrganizationIds)
            {
                if (await CanAccessOrganizationAsync(organizationId, ct))
                {
                    return true;
                }
            }

            return false;
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        if (departmentIds.Contains(project.DepartmentId))
        {
            if (permissionCodes.Any(code => code.Contains("PrimaryDepartment", StringComparison.OrdinalIgnoreCase)) &&
                permissions.Contains(PermissionCodes.ProjectPrimaryDepartmentManage))
            {
                return true;
            }

            return permissionCodes
                .Where(code => code.Contains("_Own", StringComparison.Ordinal))
                .Any(permissions.Contains);
        }

        return false;
    }


    public async Task<bool> CanAccessProjectAsync(Guid projectId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        var project = await _db.Projects
            .Where(item => item.Id == projectId)
            .Select(item => new
            {
                item.DepartmentId,
                OrganizationId = item.Department != null ? item.Department.OrganizationId : null,
                AssignedDepartmentIds = item.ProjectDepartments.Select(assignment => assignment.DepartmentId).ToList(),
                MilestoneDepartmentIds = item.Milestones
                    .Where(milestone => milestone.DepartmentId.HasValue)
                    .Select(milestone => milestone.DepartmentId!.Value)
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

        if (await HasAnyPermissionAsync(
            ct,
            PermissionCodes.ProjectAllView,
            PermissionCodes.ProjectAllManage,
            PermissionCodes.ProjectAllEdit,
            PermissionCodes.ProjectAllDelete))
        {
            if (project.OrganizationId.HasValue && await CanAccessOrganizationAsync(project.OrganizationId.Value, ct))
            {
                return true;
            }

            foreach (var organizationId in project.AssignedOrganizationIds)
            {
                if (await CanAccessOrganizationAsync(organizationId, ct))
                {
                    return true;
                }
            }
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        if (await HasAnyPermissionAsync(
            ct,
            PermissionCodes.ProjectOwnView,
            PermissionCodes.ProjectOwnManage,
            PermissionCodes.ProjectOwnEdit,
            PermissionCodes.ProjectOwnDelete,
            PermissionCodes.ProjectPrimaryDepartmentManage))
        {
            return departmentIds.Contains(project.DepartmentId) ||
                project.AssignedDepartmentIds.Any(departmentIds.Contains) ||
                project.MilestoneDepartmentIds.Any(departmentIds.Contains);
        }

        return false;
    }

    public async Task<bool> CanAccessProjectAsPrimaryDepartmentAsync(Guid projectId, CancellationToken ct)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (await HasAnyPermissionAsync(
            ct,
            PermissionCodes.ProjectAllView,
            PermissionCodes.ProjectAllManage,
            PermissionCodes.ProjectAllEdit,
            PermissionCodes.ProjectAllDelete))
        {
            return await CanAccessProjectAsync(projectId, ct);
        }

        if (!await HasAnyPermissionAsync(ct, PermissionCodes.ProjectPrimaryDepartmentManage))
        {
            return false;
        }

        var departmentIds = await GetDepartmentIdsAsync(ct);
        return await _db.Projects.AnyAsync(
            project => project.Id == projectId && departmentIds.Contains(project.DepartmentId),
            ct);
    }

    public async Task<bool> CanSeeFullProjectDetailsAsync(Guid projectId, CancellationToken ct)
        => await CanAccessProjectAsPrimaryDepartmentAsync(projectId, ct) ||
           await HasAnyPermissionAsync(
               ct,
               PermissionCodes.ProjectAllView,
               PermissionCodes.ProjectAllManage,
               PermissionCodes.ProjectAllEdit,
               PermissionCodes.ProjectAllDelete);

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
