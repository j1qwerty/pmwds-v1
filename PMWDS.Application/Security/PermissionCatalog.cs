namespace PMWDS.Application.Security;

public static class PermissionCatalog
{
    public static readonly IReadOnlySet<string> VisibleModules = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Authentication",
        "Authorization",
        "System",
        "Organization",
        "Departments",
        "Projects",
        "Milestones",
        "Tasks",
        "Subtasks",
        "Users",
        "Notifications",
        "Audit",
        "Reports",
        "AI",
        "Utilization Certificates"
    };

    public static readonly IReadOnlySet<string> AdminOnlyModules = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Authentication",
        "Authorization",
        "System"
    };

    public static readonly IReadOnlyDictionary<string, string[]> ManagePermissionCoverage =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [PermissionCodes.OrganizationManage] = new[] { PermissionCodes.OrganizationView, PermissionCodes.OrganizationCreate, PermissionCodes.OrganizationEdit, PermissionCodes.OrganizationDelete },
            [PermissionCodes.DepartmentManage] = new[] { PermissionCodes.DepartmentView, PermissionCodes.DepartmentCreate, PermissionCodes.DepartmentEdit, PermissionCodes.DepartmentDelete },
            [PermissionCodes.ProjectManage] = new[] { PermissionCodes.ProjectView, PermissionCodes.ProjectCreate, PermissionCodes.ProjectEdit, PermissionCodes.ProjectDelete, PermissionCodes.ProjectPrimaryDepartmentManage },
            [PermissionCodes.MilestoneManage] = new[] { PermissionCodes.MilestoneView, PermissionCodes.MilestoneCreate, PermissionCodes.MilestoneEdit, PermissionCodes.MilestoneDelete },
            [PermissionCodes.TaskManage] = new[] { PermissionCodes.TaskView, PermissionCodes.TaskCreate, PermissionCodes.TaskEdit, PermissionCodes.TaskDelete, PermissionCodes.TaskAssign, PermissionCodes.TaskCommentCreate, PermissionCodes.TaskAttachmentCreate, PermissionCodes.TaskTimeTrack },
            [PermissionCodes.SubtaskManage] = new[] { PermissionCodes.SubtaskView, PermissionCodes.SubtaskCreate, PermissionCodes.SubtaskEdit, PermissionCodes.SubtaskDelete },
            [PermissionCodes.UserManage] = new[] { PermissionCodes.UserView, PermissionCodes.UserCreate, PermissionCodes.UserEdit, PermissionCodes.UserDelete, PermissionCodes.UserDepartmentManage, PermissionCodes.UserProfilePictureManage },
            [PermissionCodes.RoleManage] = new[] { PermissionCodes.RoleView, PermissionCodes.RoleCreate, PermissionCodes.RoleEdit, PermissionCodes.RoleDelete },
            [PermissionCodes.PermissionManage] = new[] { PermissionCodes.PermissionView, PermissionCodes.PermissionCreate, PermissionCodes.PermissionEdit, PermissionCodes.PermissionDelete },
            [PermissionCodes.NotificationManage] = new[] { PermissionCodes.NotificationView, PermissionCodes.NotificationBroadcast, PermissionCodes.NotificationTemplateManage, PermissionCodes.NotificationRuleManage },
            [PermissionCodes.ActivityLogManage] = new[] { PermissionCodes.ActivityLogView, PermissionCodes.ActivityLogCreate },
            [PermissionCodes.ReportManage] = new[] { PermissionCodes.ReportView, PermissionCodes.ReportCreate, PermissionCodes.ReportEdit, PermissionCodes.ReportDelete },
            [PermissionCodes.AiManage] = new[] { PermissionCodes.AiView },
            [PermissionCodes.UtilizationCertificateManage] = new[]
            {
                PermissionCodes.UtilizationCertificateView,
                PermissionCodes.UtilizationCertificateCreate,
                PermissionCodes.UtilizationCertificateEdit,
                PermissionCodes.UtilizationCertificateDelete,
                PermissionCodes.UtilizationCertificateReview
            }
        };
}
