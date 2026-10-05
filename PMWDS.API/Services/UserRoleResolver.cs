using PMWDS.Domain.Entities;

namespace PMWDS.API.Services;

public static class UserRoleResolver
{
    public static IList<string> Resolve(ApplicationUser user)
        => ResolveNames(user);

    public static IList<string> ResolveNames(ApplicationUser user)
    {
        var roles = user.Roles
            .OrderByDescending(r => r.PermissionLevel)
            .Select(r => r.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (roles.Count > 0)
        {
            return roles;
        }

        return new List<string> { "Viewer" };
    }

    public static IList<string> ResolveKeys(ApplicationUser user)
    {
        var roles = user.Roles
            .OrderByDescending(r => r.PermissionLevel)
            .Select(r => r.Key)
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (roles.Count > 0)
        {
            return roles;
        }

        return new List<string> { PMWDS.Application.Security.RoleKeys.Viewer };
    }
}
