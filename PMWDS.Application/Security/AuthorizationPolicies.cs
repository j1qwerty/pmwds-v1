namespace PMWDS.Application.Security;

public static class AuthorizationPolicies
{
    public const string Authenticated = "Authenticated";
    public const string SuperAdmin = "SuperAdmin";
    public const string Director = "Director";
    public const string Manager = "Manager";
    public const string TaskEditor = "TaskEditor";

    public const string ActivityLogsView = "ActivityLogs.View";
    public const string ActivityLogsCreate = "ActivityLogs.Create";
    public const string ActivityLogsManage = "ActivityLogs.Manage";

    public const string NotificationsBroadcast = "Notifications.Create";

    public const string RolesCreate = "Roles.Create";
    public const string RolesEdit = "Roles.Edit";
    public const string RolesDelete = "Roles.Delete";

    public const string PermissionsCreate = "Permissions.Create";
    public const string PermissionsEdit = "Permissions.Edit";
    public const string PermissionsDelete = "Permissions.Delete";

    public const string UtilizationCertificateView = "UtilizationCertificates.View";
    public const string UtilizationCertificateCreate = "UtilizationCertificates.Create";
    public const string UtilizationCertificateEdit = "UtilizationCertificates.Edit";
    public const string UtilizationCertificateDelete = "UtilizationCertificates.Delete";
    public const string UtilizationCertificateReview = "UtilizationCertificates.Review";
}
