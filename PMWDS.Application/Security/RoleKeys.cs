namespace PMWDS.Application.Security;

public static class RoleKeys
{
    public const string RoleClaimType = "role_key";

    public const string SuperAdmin = "superadmin";
    public const string Director = "director";
    public const string ProjectManager = "project-manager";
    public const string DepartmentHead = "department-head";
    public const string TeamMember = "team-member";
    public const string Viewer = "viewer";

    public static string Normalize(string key)
        => key.Trim().ToLowerInvariant();
}
