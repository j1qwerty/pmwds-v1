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
        "Utilization Certificates",
        "Documents",
        "Knowledge",
        "Integrations"
    };

    public static readonly IReadOnlySet<string> AdminOnlyModules = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Authentication",
        "Authorization",
        "System"
    };

    public static IEnumerable<string> GetScopedAliases(string permission)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            permission,
            @"^(DEPARTMENT|PROJECT|MILESTONE|TASK|SUBTASK|USER|NOTIFICATION|REPORT|ACTIVITY_LOG|DOCUMENT|UTILIZATION_CERTIFICATE|KNOWLEDGE)_(VIEW|CREATE|EDIT|DELETE|MANAGE|REVIEW|ASSIGN|COMMENT_CREATE|ATTACHMENT_CREATE)$",
            System.Text.RegularExpressions.RegexOptions.CultureInvariant);

        if (match.Success)
        {
            var module = match.Groups[1].Value;
            var action = match.Groups[2].Value;
            yield return $"{module}_ALL_{action}";
        }
    }


    public static readonly IReadOnlyDictionary<string, string[]> ManagePermissionCoverage =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            [PermissionCodes.DepartmentOwnManage] = new[] { PermissionCodes.DepartmentOwnView, PermissionCodes.DepartmentOwnCreate, PermissionCodes.DepartmentOwnEdit, PermissionCodes.DepartmentOwnDelete },
            [PermissionCodes.DepartmentAllManage] = new[] { PermissionCodes.DepartmentAllView, PermissionCodes.DepartmentAllCreate, PermissionCodes.DepartmentAllEdit, PermissionCodes.DepartmentAllDelete },
            [PermissionCodes.ProjectOwnManage] = new[] { PermissionCodes.ProjectOwnView, PermissionCodes.ProjectOwnCreate, PermissionCodes.ProjectOwnEdit, PermissionCodes.ProjectOwnDelete },
            [PermissionCodes.ProjectAllManage] = new[] { PermissionCodes.ProjectAllView, PermissionCodes.ProjectAllCreate, PermissionCodes.ProjectAllEdit, PermissionCodes.ProjectAllDelete },
            [PermissionCodes.MilestoneOwnManage] = new[] { PermissionCodes.MilestoneOwnView, PermissionCodes.MilestoneOwnCreate, PermissionCodes.MilestoneOwnEdit, PermissionCodes.MilestoneOwnDelete },
            [PermissionCodes.MilestoneAllManage] = new[] { PermissionCodes.MilestoneAllView, PermissionCodes.MilestoneAllCreate, PermissionCodes.MilestoneAllEdit, PermissionCodes.MilestoneAllDelete },
            [PermissionCodes.TaskOwnManage] = new[] { PermissionCodes.TaskOwnView, PermissionCodes.TaskOwnCreate, PermissionCodes.TaskOwnEdit, PermissionCodes.TaskOwnDelete },
            [PermissionCodes.TaskAllManage] = new[] { PermissionCodes.TaskAllView, PermissionCodes.TaskAllCreate, PermissionCodes.TaskAllEdit, PermissionCodes.TaskAllDelete },
            [PermissionCodes.SubtaskOwnManage] = new[] { PermissionCodes.SubtaskOwnView, PermissionCodes.SubtaskOwnCreate, PermissionCodes.SubtaskOwnEdit, PermissionCodes.SubtaskOwnDelete },
            [PermissionCodes.SubtaskAllManage] = new[] { PermissionCodes.SubtaskAllView, PermissionCodes.SubtaskAllCreate, PermissionCodes.SubtaskAllEdit, PermissionCodes.SubtaskAllDelete },
            [PermissionCodes.UserOwnManage] = new[] { PermissionCodes.UserOwnView, PermissionCodes.UserOwnCreate, PermissionCodes.UserOwnEdit, PermissionCodes.UserOwnDelete },
            [PermissionCodes.UserAllManage] = new[] { PermissionCodes.UserAllView, PermissionCodes.UserAllCreate, PermissionCodes.UserAllEdit, PermissionCodes.UserAllDelete },
            [PermissionCodes.NotificationOwnManage] = new[] { PermissionCodes.NotificationOwnView, PermissionCodes.NotificationOwnCreate, PermissionCodes.NotificationOwnEdit, PermissionCodes.NotificationOwnDelete },
            [PermissionCodes.NotificationAllManage] = new[] { PermissionCodes.NotificationAllView, PermissionCodes.NotificationAllCreate, PermissionCodes.NotificationAllEdit, PermissionCodes.NotificationAllDelete },
            [PermissionCodes.ReportOwnManage] = new[] { PermissionCodes.ReportOwnView, PermissionCodes.ReportOwnCreate, PermissionCodes.ReportOwnEdit, PermissionCodes.ReportOwnDelete },
            [PermissionCodes.ReportAllManage] = new[] { PermissionCodes.ReportAllView, PermissionCodes.ReportAllCreate, PermissionCodes.ReportAllEdit, PermissionCodes.ReportAllDelete },
            [PermissionCodes.KnowledgeOwnManage] = new[] { PermissionCodes.KnowledgeOwnView, PermissionCodes.KnowledgeOwnCreate, PermissionCodes.KnowledgeOwnEdit, PermissionCodes.KnowledgeOwnDelete },
            [PermissionCodes.KnowledgeAllManage] = new[] { PermissionCodes.KnowledgeAllView, PermissionCodes.KnowledgeAllCreate, PermissionCodes.KnowledgeAllEdit, PermissionCodes.KnowledgeAllDelete },
            [PermissionCodes.ActivityLogOwnManage] = new[] { PermissionCodes.ActivityLogOwnView, PermissionCodes.ActivityLogOwnCreate },
            [PermissionCodes.ActivityLogAllManage] = new[] { PermissionCodes.ActivityLogAllView, PermissionCodes.ActivityLogAllCreate },
            [PermissionCodes.DocumentOwnManage] = new[] { PermissionCodes.DocumentOwnView, PermissionCodes.DocumentOwnCreate, PermissionCodes.DocumentOwnEdit, PermissionCodes.DocumentOwnDelete },
            [PermissionCodes.DocumentAllManage] = new[] { PermissionCodes.DocumentAllView, PermissionCodes.DocumentAllCreate, PermissionCodes.DocumentAllEdit, PermissionCodes.DocumentAllDelete },
            [PermissionCodes.UtilizationCertificateOwnManage] = new[] { PermissionCodes.UtilizationCertificateOwnView, PermissionCodes.UtilizationCertificateOwnCreate, PermissionCodes.UtilizationCertificateOwnEdit, PermissionCodes.UtilizationCertificateOwnDelete },
            [PermissionCodes.UtilizationCertificateAllManage] = new[] { PermissionCodes.UtilizationCertificateAllView, PermissionCodes.UtilizationCertificateAllCreate, PermissionCodes.UtilizationCertificateAllEdit, PermissionCodes.UtilizationCertificateAllDelete },

            [PermissionCodes.OrganizationManage] = new[] { PermissionCodes.OrganizationView, PermissionCodes.OrganizationCreate, PermissionCodes.OrganizationEdit, PermissionCodes.OrganizationDelete },
            [PermissionCodes.DepartmentManage] = new[] { PermissionCodes.DepartmentView, PermissionCodes.DepartmentCreate, PermissionCodes.DepartmentEdit, PermissionCodes.DepartmentDelete },
            [PermissionCodes.ProjectManage] = new[] { PermissionCodes.ProjectView, PermissionCodes.ProjectCreate, PermissionCodes.ProjectEdit, PermissionCodes.ProjectDelete, PermissionCodes.ProjectPrimaryDepartmentManage },
            [PermissionCodes.MilestoneManage] = new[] { PermissionCodes.MilestoneView, PermissionCodes.MilestoneCreate, PermissionCodes.MilestoneEdit, PermissionCodes.MilestoneDelete },
            [PermissionCodes.TaskManage] = new[] { PermissionCodes.TaskView, PermissionCodes.TaskCreate, PermissionCodes.TaskEdit, PermissionCodes.TaskDelete, PermissionCodes.TaskAssign, PermissionCodes.TaskCommentCreate, PermissionCodes.TaskAttachmentCreate },
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
