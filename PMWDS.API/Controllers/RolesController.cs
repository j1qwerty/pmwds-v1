using PMWDS.Application.DTOs.Controllers;
using MediatR;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class RolesController : BaseApiController
{
    private static readonly HashSet<string> ProtectedRoleKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        RoleKeys.SuperAdmin
    };

    private readonly IUnitOfWork _uow;
    private readonly ApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly IDataChangeNotifier _changes;

    public RolesController(IMediator mediator, IUnitOfWork uow, ApplicationDbContext context, ICurrentUserService currentUser, IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _context = context;
        _currentUser = currentUser;
        _changes = changes;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles(CancellationToken ct)
    {
        var userMaxLevel = await GetCurrentUserMaxLevelAsync(ct);

        var roles = await _context.Roles
            .Include(r => r.Permissions)
            .OrderBy(r => r.PermissionLevel)
            .ToListAsync(ct);

        var filtered = User.IsInRole(RoleKeys.SuperAdmin)
            ? roles
            : roles.Where(r => r.PermissionLevel < userMaxLevel).ToList();

        return Ok(filtered.Select(r => new RoleResponse(
            r.Id,
            r.Key,
            r.Name,
            r.Description,
            r.PermissionLevel,
            r.PaginationPageSize,
            VisiblePermissions(r.Permissions).Select(MapPermission).ToList())));
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions(CancellationToken ct)
        => Ok((await VisiblePermissionQuery().OrderBy(p => p.Module).ThenBy(p => p.Name).ToListAsync(ct)).Select(MapPermission));

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.RolesCreate)]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleRequest req, CancellationToken ct)
    {
        if (await _context.Roles.AnyAsync(r => r.Name == req.Name, ct))
        {
            return Conflict(new { message = $"Role '{req.Name}' already exists." });
        }

        if (!User.IsInRole(RoleKeys.SuperAdmin))
        {
            var userMaxLevel = await GetCurrentUserMaxLevelAsync(ct);
            if (req.PermissionLevel >= userMaxLevel)
            {
                return Forbid();
            }
        }

        var role = Role.Create(req.Name, req.Description, req.PermissionLevel);
        role.UpdatePaginationPageSize(req.PaginationPageSize ?? 10);
        role.SetCreatedBy("system");

        var permissions = await LoadAssignablePermissionsAsync(req.PermissionIds, ct);
        foreach (var permission in permissions)
        {
            role.AddPermission(permission);
        }

        await _uow.Roles.AddAsync(role, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Role Created",
            Description: $"{_currentUser.FullName} created role \"{role.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["roleId"] = role.Id,
                ["roleName"] = role.Name
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return CreatedAtAction(nameof(GetRoles), new { id = role.Id }, new RoleResponse(
            role.Id,
            role.Key,
            role.Name,
            role.Description,
            role.PermissionLevel,
            role.PaginationPageSize,
            permissions.Select(MapPermission).ToList()));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RolesEdit)]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest req, CancellationToken ct)
    {
        var role = await _context.Roles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role == null)
        {
            return NotFound();
        }

        if (!User.IsInRole(RoleKeys.SuperAdmin))
        {
            var userMaxLevel = await GetCurrentUserMaxLevelAsync(ct);
            if (role.PermissionLevel >= userMaxLevel)
            {
                return Forbid();
            }
        }

        role.Update(req.Name, req.Description, req.PermissionLevel);
        role.UpdatePaginationPageSize(req.PaginationPageSize ?? role.PaginationPageSize);

        var permissions = await LoadAssignablePermissionsAsync(req.PermissionIds, ct);
        var selectedCodes = permissions.Select(permission => permission.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (role.Key == RoleKeys.SuperAdmin && !selectedCodes.Contains(PermissionCodes.SystemAdmin))
        {
            return BadRequest(new { message = "The SuperAdmin role must keep the SYSTEM_ADMIN permission." });
        }

        if (await WouldRemoveOwnSystemAdminAsync(role.Id, selectedCodes, ct))
        {
            return BadRequest(new { message = "You cannot remove your own SYSTEM_ADMIN permission." });
        }

        role.Permissions.Clear();
        foreach (var permission in permissions)
        {
            role.AddPermission(permission);
        }

        await _uow.Roles.UpdateAsync(role, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Role Updated",
            Description: $"{_currentUser.FullName} updated role \"{role.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["roleId"] = role.Id,
                ["roleName"] = role.Name
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return Ok(new RoleResponse(role.Id, role.Key, role.Name, role.Description, role.PermissionLevel, role.PaginationPageSize, permissions.Select(MapPermission).ToList()));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.RolesDelete)]
    public async Task<IActionResult> DeleteRole(Guid id, CancellationToken ct)
    {
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role == null) return NotFound();

        if (ProtectedRoleKeys.Contains(role.Key))
        {
            return BadRequest(new { message = $"The built-in role '{role.Key}' cannot be deleted." });
        }

        if (!User.IsInRole(RoleKeys.SuperAdmin))
        {
            var userMaxLevel = await GetCurrentUserMaxLevelAsync(ct);
            if (role.PermissionLevel >= userMaxLevel)
            {
                return Forbid();
            }
        }

        var roleName = role.Name;

        await _uow.Roles.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Role Deleted",
            Description: $"{_currentUser.FullName} deleted role \"{roleName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["roleName"] = roleName
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return NoContent();
    }

    [HttpPost("permissions")]
    [Authorize(Policy = AuthorizationPolicies.PermissionsCreate)]
    public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequest req, CancellationToken ct)
    {
        if (await _context.Permissions.AnyAsync(p => p.Code == req.Code.ToUpper(), ct))
        {
            return Conflict(new { message = $"Permission code '{req.Code}' already exists." });
        }

        var permission = Permission.Create(req.Code, req.Name, req.Description, req.Module, req.IsGlobal);
        permission.SetCreatedBy("system");
        await _uow.Permissions.AddAsync(permission, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Permission Created",
            Description: $"{_currentUser.FullName} created permission \"{permission.Name}\" ({permission.Code})",
            Metadata: new Dictionary<string, object>
            {
                ["permissionId"] = permission.Id,
                ["permissionName"] = permission.Name,
                ["permissionCode"] = permission.Code
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return CreatedAtAction(nameof(GetPermissions), new { id = permission.Id }, MapPermission(permission));
    }

    [HttpPut("permissions/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.PermissionsEdit)]
    public async Task<IActionResult> UpdatePermission(Guid id, [FromBody] UpdatePermissionRequest req, CancellationToken ct)
    {
        var permission = await _uow.Permissions.GetByIdAsync(id, ct);
        if (permission == null)
        {
            return NotFound();
        }

        permission.Update(req.Name, req.Description, req.Module, req.IsGlobal);
        await _uow.Permissions.UpdateAsync(permission, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Permission Updated",
            Description: $"{_currentUser.FullName} updated permission \"{permission.Name}\" ({permission.Code})",
            Metadata: new Dictionary<string, object>
            {
                ["permissionId"] = permission.Id,
                ["permissionName"] = permission.Name,
                ["permissionCode"] = permission.Code
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return Ok(MapPermission(permission));
    }

    [HttpDelete("permissions/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.PermissionsDelete)]
    public async Task<IActionResult> DeletePermission(Guid id, CancellationToken ct)
    {
        var permission = await _uow.Permissions.GetByIdAsync(id, ct);
        var permName = permission?.Name ?? "Unknown";
        var permCode = permission?.Code ?? "";
        if (permCode.Equals(PermissionCodes.SystemAdmin, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "The SYSTEM_ADMIN permission cannot be deleted." });
        }

        await _uow.Permissions.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Permission Deleted",
            Description: $"{_currentUser.FullName} deleted permission \"{permName}\" ({permCode})",
            Metadata: new Dictionary<string, object>
            {
                ["permissionName"] = permName,
                ["permissionCode"] = permCode
            }
        );

        await _changes.NotifyAsync(DataChangeScopes.Roles, null, null, ct);
        return NoContent();
    }

    private static PermissionResponse MapPermission(Permission permission)
        => new(permission.Id, permission.Code, permission.Name, permission.Description, permission.Module, permission.IsGlobal);

    private IQueryable<Permission> VisiblePermissionQuery()
    {
        var visibleModules = PermissionCatalog.VisibleModules.ToArray();
        return _context.Permissions.Where(permission => visibleModules.Contains(permission.Module));
    }

    private static IEnumerable<Permission> VisiblePermissions(IEnumerable<Permission> permissions)
        => permissions.Where(permission => PermissionCatalog.VisibleModules.Contains(permission.Module));

    private async Task<int> GetCurrentUserMaxLevelAsync(CancellationToken ct)
    {
        var userId = _currentUser.UserId;
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var parsedId))
            return 0;

        var user = await _context.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == parsedId, ct);

        return user?.Roles.Max(r => r.PermissionLevel) ?? 0;
    }

    private async Task<HashSet<string>> GetCurrentUserPermissionCodesAsync(CancellationToken ct)
    {
        if (User.IsInRole(RoleKeys.SuperAdmin))
        {
            var all = await _context.Permissions.Select(p => p.Code).ToListAsync(ct);
            return new HashSet<string>(all, StringComparer.OrdinalIgnoreCase);
        }

        var userId = _currentUser.UserId;
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var parsedId))
            return new HashSet<string>();

        // Roles and permissions are two many-to-many hops. Flattening them with a nested
        // collection-correlated SelectMany made EF emit SQL Server's APPLY, which SQLite cannot
        // generate. Crossing each hop separately keeps every clause translatable: the Users.Any
        // filter is a correlated EXISTS, and the collection in the projection compiles to an
        // aggregating subquery on both providers.
        var codesByRole = await _context.Roles
            .AsNoTracking()
            .Where(role => role.Users.Any(user => user.Id == parsedId))
            .Select(role => role.Permissions.Select(permission => permission.Code).ToList())
            .ToListAsync(ct);

        var codes = codesByRole
            .SelectMany(roleCodes => roleCodes)
            .Distinct()
            .ToList();

        var expanded = new HashSet<string>(codes, StringComparer.OrdinalIgnoreCase);
        foreach (var grantedCode in codes)
        {
            if (PermissionCatalog.ManagePermissionCoverage.TryGetValue(grantedCode, out var covered))
            {
                foreach (var coveredCode in covered) expanded.Add(coveredCode);
            }

            foreach (var alias in PermissionCatalog.GetScopedAliases(grantedCode))
            {
                expanded.Add(alias);
            }

            if (grantedCode.Contains("_ALL_", StringComparison.Ordinal))
            {
                expanded.Add(grantedCode.Replace("_ALL_", "_OWN_", StringComparison.Ordinal));
            }
        }

        return expanded;
    }

    private async Task<List<Permission>> LoadAssignablePermissionsAsync(IReadOnlyCollection<Guid> permissionIds, CancellationToken ct)
    {
        var userPermissions = await GetCurrentUserPermissionCodesAsync(ct);

        var selected = await VisiblePermissionQuery()
            .Where(permission => permissionIds.Contains(permission.Id))
            .ToListAsync(ct);

        var assignable = selected
            .Where(p => userPermissions.Contains(p.Code))
            .Where(p => User.IsInRole(RoleKeys.SuperAdmin) || !PermissionCatalog.AdminOnlyModules.Contains(p.Module))
            .ToList();

        var selectedCodes = assignable.Select(p => p.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var coveredCodes = PermissionCatalog.ManagePermissionCoverage
            .Where(pair => selectedCodes.Contains(pair.Key))
            .SelectMany(pair => pair.Value)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return assignable
            .Where(p => !coveredCodes.Contains(p.Code))
            .ToList();
    }

    private async Task<bool> WouldRemoveOwnSystemAdminAsync(
        Guid editedRoleId,
        HashSet<string> replacementPermissionCodes,
        CancellationToken ct)
    {
        var userId = _currentUser.UserId;
        if (string.IsNullOrWhiteSpace(userId) || !Guid.TryParse(userId, out var parsedUserId))
        {
            return false;
        }

        var currentUser = await _context.Users
            .Include(user => user.Roles)
            .ThenInclude(role => role.Permissions)
            .FirstOrDefaultAsync(user => user.Id == parsedUserId, ct);
        if (currentUser == null || currentUser.Roles.All(role => role.Id != editedRoleId))
        {
            return false;
        }

        var remainingCodes = currentUser.Roles
            .Where(role => role.Id != editedRoleId)
            .SelectMany(role => role.Permissions)
            .Select(permission => permission.Code)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        remainingCodes.UnionWith(replacementPermissionCodes);
        return !remainingCodes.Contains(PermissionCodes.SystemAdmin);
    }
}
