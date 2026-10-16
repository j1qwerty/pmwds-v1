namespace PMWDS.Application.Security;

/// <summary>
/// The permissions each built-in role is seeded with. One list, two readers: the seeder
/// rebuilds the built-in roles from it, and the role editor's "Restore defaults" asks the
/// API for the same list, so the two can never drift apart.
/// SuperAdmin is not listed here because it always holds every permission.
/// </summary>
public static class RoleDefaults
{
    public static readonly IReadOnlyList<string> Director = new[]
    {
        PermissionCodes.DepartmentAllManage,
        PermissionCodes.ProjectAllManage,
        PermissionCodes.ProjectPrimaryDepartmentManage,
        PermissionCodes.MilestoneAllManage,
        PermissionCodes.TaskAllManage,
        PermissionCodes.SubtaskAllManage,
        PermissionCodes.UserAllManage,
        PermissionCodes.NotificationAllManage,
        PermissionCodes.ActivityLogAllManage,
        PermissionCodes.ReportAllManage,
        PermissionCodes.DocumentAllManage,
        PermissionCodes.KnowledgeAllManage,
        PermissionCodes.DocumentAllProjectUpload,
        PermissionCodes.DocumentAllMilestoneUpload,
        PermissionCodes.DocumentAllTaskUpload,
        PermissionCodes.UtilizationCertificateAllManage,
        PermissionCodes.UtilizationCertificateAllProjectUpload,
        PermissionCodes.UtilizationCertificateAllMilestoneUpload,
        PermissionCodes.UtilizationCertificateAllTaskUpload,
        PermissionCodes.RoleManage,
        PermissionCodes.PermissionManage,
        PermissionCodes.AiView,
        PermissionCodes.AiProjectView,
        PermissionCodes.AiManage
    };

    public static readonly IReadOnlyList<string> ProjectManager = new[]
    {
        PermissionCodes.DepartmentOwnView,
        // All-department read so a project manager can pick the departments a
        // project spans. Without it RoleScopeService.ScopeDepartmentsAsync falls
        // back to DepartmentOwn* and offers only the manager's own department,
        // which makes a cross-department project impossible to create.
        PermissionCodes.DepartmentAllView,
        PermissionCodes.ProjectAllManage,
        PermissionCodes.ProjectPrimaryDepartmentManage,
        PermissionCodes.MilestoneAllManage,
        PermissionCodes.TaskAllManage,
        PermissionCodes.SubtaskAllManage,
        PermissionCodes.UserAllView,
        PermissionCodes.NotificationOwnView,
        PermissionCodes.ActivityLogOwnCreate,
        PermissionCodes.DocumentAllManage,
        PermissionCodes.DocumentAllProjectUpload,
        PermissionCodes.DocumentAllMilestoneUpload,
        PermissionCodes.DocumentAllTaskUpload,
        PermissionCodes.UtilizationCertificateAllManage,
        PermissionCodes.UtilizationCertificateAllProjectUpload,
        PermissionCodes.UtilizationCertificateAllMilestoneUpload,
        PermissionCodes.UtilizationCertificateAllTaskUpload,
        // Project AI tab only. The portfolio AI page (AI_VIEW) stays off by default.
        PermissionCodes.AiProjectView
    };

    public static readonly IReadOnlyList<string> DepartmentHead = new[]
    {
        PermissionCodes.DepartmentOwnManage,
        PermissionCodes.ProjectOwnManage,
        PermissionCodes.ProjectOwnCreate,
        PermissionCodes.ProjectPrimaryDepartmentManage,
        PermissionCodes.MilestoneOwnManage,
        PermissionCodes.TaskOwnManage,
        PermissionCodes.SubtaskOwnManage,
        PermissionCodes.UserOwnManage,
        PermissionCodes.NotificationOwnView,
        PermissionCodes.ActivityLogOwnView,
        PermissionCodes.ActivityLogOwnCreate,
        PermissionCodes.DocumentOwnView,
        PermissionCodes.KnowledgeOwnView,
        PermissionCodes.KnowledgeOwnCreate,
        PermissionCodes.KnowledgeOwnEdit,
        PermissionCodes.DocumentOwnCreate,
        PermissionCodes.DocumentOwnEdit,
        PermissionCodes.DocumentOwnDelete,
        PermissionCodes.DocumentOwnMilestoneUpload,
        PermissionCodes.DocumentOwnTaskUpload,
        PermissionCodes.UtilizationCertificateOwnView,
        PermissionCodes.UtilizationCertificateOwnCreate,
        PermissionCodes.UtilizationCertificateOwnEdit,
        PermissionCodes.UtilizationCertificateOwnReview,
        PermissionCodes.UtilizationCertificateOwnMilestoneUpload,
        PermissionCodes.UtilizationCertificateOwnTaskUpload,
        // Project AI tab only. The portfolio AI page (AI_VIEW) stays off by default.
        PermissionCodes.AiProjectView
    };

    public static readonly IReadOnlyList<string> TeamMember = new[]
    {
        PermissionCodes.ProjectOwnView,
        PermissionCodes.MilestoneOwnView,
        PermissionCodes.TaskOwnView,
        PermissionCodes.TaskOwnEdit,
        PermissionCodes.TaskOwnCommentCreate,
        PermissionCodes.TaskOwnAttachmentCreate,
        PermissionCodes.SubtaskOwnView,
        PermissionCodes.SubtaskOwnCreate,
        PermissionCodes.SubtaskOwnEdit,
        PermissionCodes.NotificationOwnView,
        PermissionCodes.ActivityLogOwnCreate,
        PermissionCodes.DocumentOwnView,
        PermissionCodes.KnowledgeOwnView,
        PermissionCodes.DocumentOwnTaskUpload,
        PermissionCodes.UtilizationCertificateOwnView,
        PermissionCodes.UtilizationCertificateOwnCreate,
        PermissionCodes.UtilizationCertificateOwnEdit,
        PermissionCodes.UtilizationCertificateOwnTaskUpload
    };

    public static readonly IReadOnlyList<string> Viewer = new[]
    {
        PermissionCodes.OrganizationView,
        PermissionCodes.DepartmentOwnView,
        PermissionCodes.ProjectOwnView,
        PermissionCodes.MilestoneOwnView,
        PermissionCodes.TaskOwnView,
        PermissionCodes.SubtaskOwnView,
        PermissionCodes.NotificationOwnView,
        PermissionCodes.ActivityLogOwnView,
        PermissionCodes.DocumentOwnView,
        PermissionCodes.UtilizationCertificateOwnView
    };

    /// <summary>
    /// The seeded permission codes for a built-in role, or null when the key is not a
    /// built-in role (a custom role has no defaults) or is SuperAdmin (every permission).
    /// </summary>
    public static IReadOnlyList<string>? ForRole(string roleKey)
        => RoleKeys.Normalize(roleKey) switch
        {
            RoleKeys.Director => Director,
            RoleKeys.ProjectManager => ProjectManager,
            RoleKeys.DepartmentHead => DepartmentHead,
            RoleKeys.TeamMember => TeamMember,
            RoleKeys.Viewer => Viewer,
            _ => null
        };

    public static bool HasDefaults(string roleKey)
    {
        var key = RoleKeys.Normalize(roleKey);
        return key == RoleKeys.SuperAdmin || ForRole(key) is not null;
    }
}
