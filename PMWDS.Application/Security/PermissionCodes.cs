namespace PMWDS.Application.Security;

public static class PermissionCodes
{
    public const string PermissionClaimType = "permission";
    // Department-scoped permissions. OWN applies to the caller's assigned departments;
    // ALL applies to every department inside the organizations the caller can access.
    public const string DepartmentOwnManage = "DEPARTMENT_OWN_MANAGE";
    public const string DepartmentOwnView = "DEPARTMENT_OWN_VIEW";
    public const string DepartmentOwnCreate = "DEPARTMENT_OWN_CREATE";
    public const string DepartmentOwnEdit = "DEPARTMENT_OWN_EDIT";
    public const string DepartmentOwnDelete = "DEPARTMENT_OWN_DELETE";
    public const string DepartmentAllManage = "DEPARTMENT_ALL_MANAGE";
    public const string DepartmentAllView = "DEPARTMENT_ALL_VIEW";
    public const string DepartmentAllCreate = "DEPARTMENT_ALL_CREATE";
    public const string DepartmentAllEdit = "DEPARTMENT_ALL_EDIT";
    public const string DepartmentAllDelete = "DEPARTMENT_ALL_DELETE";

    public const string ProjectOwnManage = "PROJECT_OWN_MANAGE";
    public const string ProjectOwnView = "PROJECT_OWN_VIEW";
    public const string ProjectOwnCreate = "PROJECT_OWN_CREATE";
    public const string ProjectOwnEdit = "PROJECT_OWN_EDIT";
    public const string ProjectOwnDelete = "PROJECT_OWN_DELETE";
    public const string ProjectAllManage = "PROJECT_ALL_MANAGE";
    public const string ProjectAllView = "PROJECT_ALL_VIEW";
    public const string ProjectAllCreate = "PROJECT_ALL_CREATE";
    public const string ProjectAllEdit = "PROJECT_ALL_EDIT";
    public const string ProjectAllDelete = "PROJECT_ALL_DELETE";

    public const string MilestoneOwnManage = "MILESTONE_OWN_MANAGE";
    public const string MilestoneOwnView = "MILESTONE_OWN_VIEW";
    public const string MilestoneOwnCreate = "MILESTONE_OWN_CREATE";
    public const string MilestoneOwnEdit = "MILESTONE_OWN_EDIT";
    public const string MilestoneOwnDelete = "MILESTONE_OWN_DELETE";
    public const string MilestoneAllManage = "MILESTONE_ALL_MANAGE";
    public const string MilestoneAllView = "MILESTONE_ALL_VIEW";
    public const string MilestoneAllCreate = "MILESTONE_ALL_CREATE";
    public const string MilestoneAllEdit = "MILESTONE_ALL_EDIT";
    public const string MilestoneAllDelete = "MILESTONE_ALL_DELETE";

    public const string TaskOwnManage = "TASK_OWN_MANAGE";
    public const string TaskOwnView = "TASK_OWN_VIEW";
    public const string TaskOwnCreate = "TASK_OWN_CREATE";
    public const string TaskOwnEdit = "TASK_OWN_EDIT";
    public const string TaskOwnDelete = "TASK_OWN_DELETE";
    public const string TaskAllManage = "TASK_ALL_MANAGE";
    public const string TaskAllView = "TASK_ALL_VIEW";
    public const string TaskAllCreate = "TASK_ALL_CREATE";
    public const string TaskAllEdit = "TASK_ALL_EDIT";
    public const string TaskAllDelete = "TASK_ALL_DELETE";
    public const string TaskOwnAssign = "TASK_OWN_ASSIGN";
    public const string TaskAllAssign = "TASK_ALL_ASSIGN";
    public const string TaskOwnCommentCreate = "TASK_OWN_COMMENT_CREATE";
    public const string TaskAllCommentCreate = "TASK_ALL_COMMENT_CREATE";
    public const string TaskOwnAttachmentCreate = "TASK_OWN_ATTACHMENT_CREATE";
    public const string TaskAllAttachmentCreate = "TASK_ALL_ATTACHMENT_CREATE";

    public const string SubtaskOwnManage = "SUBTASK_OWN_MANAGE";
    public const string SubtaskOwnView = "SUBTASK_OWN_VIEW";
    public const string SubtaskOwnCreate = "SUBTASK_OWN_CREATE";
    public const string SubtaskOwnEdit = "SUBTASK_OWN_EDIT";
    public const string SubtaskOwnDelete = "SUBTASK_OWN_DELETE";
    public const string SubtaskAllManage = "SUBTASK_ALL_MANAGE";
    public const string SubtaskAllView = "SUBTASK_ALL_VIEW";
    public const string SubtaskAllCreate = "SUBTASK_ALL_CREATE";
    public const string SubtaskAllEdit = "SUBTASK_ALL_EDIT";
    public const string SubtaskAllDelete = "SUBTASK_ALL_DELETE";

    public const string UserOwnManage = "USER_OWN_MANAGE";
    public const string UserOwnView = "USER_OWN_VIEW";
    public const string UserOwnCreate = "USER_OWN_CREATE";
    public const string UserOwnEdit = "USER_OWN_EDIT";
    public const string UserOwnDelete = "USER_OWN_DELETE";
    public const string UserAllManage = "USER_ALL_MANAGE";
    public const string UserAllView = "USER_ALL_VIEW";
    public const string UserAllCreate = "USER_ALL_CREATE";
    public const string UserAllEdit = "USER_ALL_EDIT";
    public const string UserAllDelete = "USER_ALL_DELETE";

    public const string NotificationOwnManage = "NOTIFICATION_OWN_MANAGE";
    public const string NotificationOwnView = "NOTIFICATION_OWN_VIEW";
    public const string NotificationOwnCreate = "NOTIFICATION_OWN_CREATE";
    public const string NotificationOwnEdit = "NOTIFICATION_OWN_EDIT";
    public const string NotificationOwnDelete = "NOTIFICATION_OWN_DELETE";
    public const string NotificationAllManage = "NOTIFICATION_ALL_MANAGE";
    public const string NotificationAllView = "NOTIFICATION_ALL_VIEW";
    public const string NotificationAllCreate = "NOTIFICATION_ALL_CREATE";
    public const string NotificationAllEdit = "NOTIFICATION_ALL_EDIT";
    public const string NotificationAllDelete = "NOTIFICATION_ALL_DELETE";

    public const string ReportOwnManage = "REPORT_OWN_MANAGE";
    public const string ReportOwnView = "REPORT_OWN_VIEW";
    public const string ReportOwnCreate = "REPORT_OWN_CREATE";
    public const string ReportOwnEdit = "REPORT_OWN_EDIT";
    public const string ReportOwnDelete = "REPORT_OWN_DELETE";
    public const string ReportAllManage = "REPORT_ALL_MANAGE";
    public const string ReportAllView = "REPORT_ALL_VIEW";
    public const string ReportAllCreate = "REPORT_ALL_CREATE";
    public const string ReportAllEdit = "REPORT_ALL_EDIT";
    public const string ReportAllDelete = "REPORT_ALL_DELETE";

    public const string ActivityLogOwnManage = "ACTIVITY_LOG_OWN_MANAGE";
    public const string ActivityLogOwnView = "ACTIVITY_LOG_OWN_VIEW";
    public const string ActivityLogOwnCreate = "ACTIVITY_LOG_OWN_CREATE";
    public const string ActivityLogAllManage = "ACTIVITY_LOG_ALL_MANAGE";
    public const string ActivityLogAllView = "ACTIVITY_LOG_ALL_VIEW";
    public const string ActivityLogAllCreate = "ACTIVITY_LOG_ALL_CREATE";

    public const string DocumentOwnManage = "DOCUMENT_OWN_MANAGE";
    public const string DocumentOwnView = "DOCUMENT_OWN_VIEW";
    public const string DocumentOwnCreate = "DOCUMENT_OWN_CREATE";
    public const string DocumentOwnEdit = "DOCUMENT_OWN_EDIT";
    public const string DocumentOwnDelete = "DOCUMENT_OWN_DELETE";
    public const string DocumentAllManage = "DOCUMENT_ALL_MANAGE";
    public const string DocumentAllView = "DOCUMENT_ALL_VIEW";
    public const string DocumentAllCreate = "DOCUMENT_ALL_CREATE";
    public const string DocumentAllEdit = "DOCUMENT_ALL_EDIT";
    public const string DocumentAllDelete = "DOCUMENT_ALL_DELETE";
    public const string DocumentOwnProjectUpload = "DOCUMENT_OWN_PROJECT_UPLOAD";
    public const string DocumentOwnMilestoneUpload = "DOCUMENT_OWN_MILESTONE_UPLOAD";
    public const string DocumentOwnTaskUpload = "DOCUMENT_OWN_TASK_UPLOAD";
    public const string DocumentAllProjectUpload = "DOCUMENT_ALL_PROJECT_UPLOAD";
    public const string DocumentAllMilestoneUpload = "DOCUMENT_ALL_MILESTONE_UPLOAD";
    public const string DocumentAllTaskUpload = "DOCUMENT_ALL_TASK_UPLOAD";

    public const string UtilizationCertificateOwnManage = "UTILIZATION_CERTIFICATE_OWN_MANAGE";
    public const string UtilizationCertificateOwnView = "UTILIZATION_CERTIFICATE_OWN_VIEW";
    public const string UtilizationCertificateOwnCreate = "UTILIZATION_CERTIFICATE_OWN_CREATE";
    public const string UtilizationCertificateOwnEdit = "UTILIZATION_CERTIFICATE_OWN_EDIT";
    public const string UtilizationCertificateOwnDelete = "UTILIZATION_CERTIFICATE_OWN_DELETE";
    public const string UtilizationCertificateOwnReview = "UTILIZATION_CERTIFICATE_OWN_REVIEW";
    public const string UtilizationCertificateAllManage = "UTILIZATION_CERTIFICATE_ALL_MANAGE";
    public const string UtilizationCertificateAllView = "UTILIZATION_CERTIFICATE_ALL_VIEW";
    public const string UtilizationCertificateAllCreate = "UTILIZATION_CERTIFICATE_ALL_CREATE";
    public const string UtilizationCertificateAllEdit = "UTILIZATION_CERTIFICATE_ALL_EDIT";
    public const string UtilizationCertificateAllDelete = "UTILIZATION_CERTIFICATE_ALL_DELETE";
    public const string UtilizationCertificateAllReview = "UTILIZATION_CERTIFICATE_ALL_REVIEW";
    public const string UtilizationCertificateOwnProjectUpload = "UTILIZATION_CERTIFICATE_OWN_PROJECT_UPLOAD";
    public const string UtilizationCertificateOwnMilestoneUpload = "UTILIZATION_CERTIFICATE_OWN_MILESTONE_UPLOAD";
    public const string UtilizationCertificateOwnTaskUpload = "UTILIZATION_CERTIFICATE_OWN_TASK_UPLOAD";
    public const string UtilizationCertificateAllProjectUpload = "UTILIZATION_CERTIFICATE_ALL_PROJECT_UPLOAD";
    public const string UtilizationCertificateAllMilestoneUpload = "UTILIZATION_CERTIFICATE_ALL_MILESTONE_UPLOAD";
    public const string UtilizationCertificateAllTaskUpload = "UTILIZATION_CERTIFICATE_ALL_TASK_UPLOAD";


    public const string SystemAdmin = "SYSTEM_ADMIN";
    public const string SystemDatabaseView = "SYSTEM_DATABASE_VIEW";
    public const string AuthManage = "AUTH_MANAGE";

    public const string OrganizationManage = "ORGANIZATION_MANAGE";
    public const string OrganizationView = "ORGANIZATION_VIEW";
    public const string OrganizationCreate = "ORGANIZATION_CREATE";
    public const string OrganizationEdit = "ORGANIZATION_EDIT";
    public const string OrganizationDelete = "ORGANIZATION_DELETE";

    public const string DepartmentManage = "DEPARTMENT_MANAGE";
    public const string DepartmentView = "DEPARTMENT_VIEW";
    public const string DepartmentCreate = "DEPARTMENT_CREATE";
    public const string DepartmentEdit = "DEPARTMENT_EDIT";
    public const string DepartmentDelete = "DEPARTMENT_DELETE";

    public const string ProjectManage = "PROJECT_MANAGE";
    public const string ProjectView = "PROJECT_VIEW";
    public const string ProjectCreate = "PROJECT_CREATE";
    public const string ProjectEdit = "PROJECT_EDIT";
    public const string ProjectDelete = "PROJECT_DELETE";
    public const string ProjectPrimaryDepartmentManage = "PROJECT_PRIMARY_DEPARTMENT_MANAGE";

    public const string MilestoneManage = "MILESTONE_MANAGE";
    public const string MilestoneView = "MILESTONE_VIEW";
    public const string MilestoneCreate = "MILESTONE_CREATE";
    public const string MilestoneEdit = "MILESTONE_EDIT";
    public const string MilestoneDelete = "MILESTONE_DELETE";

    public const string TaskManage = "TASK_MANAGE";
    public const string TaskView = "TASK_VIEW";
    public const string TaskCreate = "TASK_CREATE";
    public const string TaskEdit = "TASK_EDIT";
    public const string TaskDelete = "TASK_DELETE";
    public const string TaskAssign = "TASK_ASSIGN";
    public const string TaskCommentCreate = "TASK_COMMENT_CREATE";
    public const string TaskAttachmentCreate = "TASK_ATTACHMENT_CREATE";

    public const string SubtaskManage = "SUBTASK_MANAGE";
    public const string SubtaskView = "SUBTASK_VIEW";
    public const string SubtaskCreate = "SUBTASK_CREATE";
    public const string SubtaskEdit = "SUBTASK_EDIT";
    public const string SubtaskDelete = "SUBTASK_DELETE";

    public const string UserManage = "USER_MANAGE";
    public const string UserView = "USER_VIEW";
    public const string UserCreate = "USER_CREATE";
    public const string UserEdit = "USER_EDIT";
    public const string UserDelete = "USER_DELETE";
    public const string UserDepartmentManage = "USER_DEPARTMENT_MANAGE";
    public const string UserProfilePictureManage = "USER_PROFILE_PICTURE_MANAGE";

    public const string RoleManage = "ROLE_MANAGE";
    public const string RoleView = "ROLE_VIEW";
    public const string RoleCreate = "ROLE_CREATE";
    public const string RoleEdit = "ROLE_EDIT";
    public const string RoleDelete = "ROLE_DELETE";
    public const string PermissionManage = "PERMISSION_MANAGE";
    public const string PermissionView = "PERMISSION_VIEW";
    public const string PermissionCreate = "PERMISSION_CREATE";
    public const string PermissionEdit = "PERMISSION_EDIT";
    public const string PermissionDelete = "PERMISSION_DELETE";

    public const string NotificationManage = "NOTIFICATION_MANAGE";
    public const string NotificationView = "NOTIFICATION_VIEW";
    public const string NotificationBroadcast = "NOTIFICATION_BROADCAST";
    public const string NotificationTemplateManage = "NOTIFICATION_TEMPLATE_MANAGE";
    public const string NotificationRuleManage = "NOTIFICATION_RULE_MANAGE";

    public const string ActivityLogManage = "ACTIVITY_LOG_MANAGE";
    public const string ActivityLogView = "ACTIVITY_LOG_VIEW";
    public const string ActivityLogCreate = "ACTIVITY_LOG_CREATE";

    public const string ReportManage = "REPORT_MANAGE";
    public const string ReportView = "REPORT_VIEW";
    public const string ReportCreate = "REPORT_CREATE";
    public const string ReportEdit = "REPORT_EDIT";
    public const string ReportDelete = "REPORT_DELETE";

    public const string KnowledgeView = "KNOWLEDGE_VIEW";
    public const string KnowledgeCreate = "KNOWLEDGE_CREATE";
    public const string KnowledgeEdit = "KNOWLEDGE_EDIT";
    public const string KnowledgeDelete = "KNOWLEDGE_DELETE";

    public const string IntegrationView = "INTEGRATION_VIEW";
    public const string IntegrationCreate = "INTEGRATION_CREATE";
    public const string IntegrationEdit = "INTEGRATION_EDIT";
    public const string IntegrationDelete = "INTEGRATION_DELETE";

    public const string AiView = "AI_VIEW";
    public const string AiManage = "AI_MANAGE";

    // Utilization Certificates — formal proof that grant, government or corporate
    // funds were spent strictly for their intended purpose.
    public const string UtilizationCertificateManage = "UTILIZATION_CERTIFICATE_MANAGE";
    public const string UtilizationCertificateView = "UTILIZATION_CERTIFICATE_VIEW";
    public const string UtilizationCertificateCreate = "UTILIZATION_CERTIFICATE_CREATE";
    public const string UtilizationCertificateEdit = "UTILIZATION_CERTIFICATE_EDIT";
    public const string UtilizationCertificateDelete = "UTILIZATION_CERTIFICATE_DELETE";

    // Reviewing (approving / rejecting) a UC is a separate authority from submitting
    // one, so a contributor can never sign off their own certificate.
    public const string UtilizationCertificateReview = "UTILIZATION_CERTIFICATE_REVIEW";
}
