using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Security;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Auth;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionAuthorizationRequirement>
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PermissionAuthorizationHandler(ApplicationDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionAuthorizationRequirement requirement)
    {
        if (requirement.PermissionCodes.Count == 0)
        {
            context.Succeed(requirement);
            return;
        }

        var permissions = await GetPermissionsForCurrentUserAsync(context.User);
        if (permissions.Overlaps(requirement.PermissionCodes))
        {
            context.Succeed(requirement);
        }
    }

    private async Task<HashSet<string>> GetPermissionsForCurrentUserAsync(ClaimsPrincipal principal)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        const string cacheKey = "__pmwds_permissions";

        if (httpContext?.Items[cacheKey] is HashSet<string> cached)
        {
            return cached;
        }

        var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        var permissions = await _db.Users
            .Where(user => user.Id == userId && user.IsActive)
            .SelectMany(user => user.Roles)
            .SelectMany(role => role.Permissions)
            .Select(permission => permission.Code)
            .Distinct()
            .ToListAsync();

        var result = permissions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var permission in permissions)
        {
            if (PermissionCatalog.ManagePermissionCoverage.TryGetValue(permission, out var covered))
            {
                foreach (var coveredPermission in covered)
                {
                    result.Add(coveredPermission);
                }
            }

            if (permission.Contains("_ALL_", StringComparison.Ordinal))
            {
                result.Add(permission.Replace("_ALL_", "_OWN_", StringComparison.Ordinal));
            }

            foreach (var legacyAlias in PermissionCatalog.GetScopedAliases(permission))
            {
                result.Add(legacyAlias);
            }
        }

        if (httpContext != null)
        {
            httpContext.Items[cacheKey] = result;
        }

        return result;
    }
}
