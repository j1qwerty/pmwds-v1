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

    public const string OrganizationsView = "Organizations.View";
    public const string OrganizationsCreate = "Organizations.Create";
    public const string OrganizationsEdit = "Organizations.Edit";
    public const string OrganizationsDelete = "Organizations.Delete";

    public const string DepartmentsView = "Departments.View";
    public const string DepartmentsCreate = "Departments.Create";
    public const string DepartmentsEdit = "Departments.Edit";
    public const string DepartmentsDelete = "Departments.Delete";
    public const string ProjectsView = "Projects.View";
    public const string ProjectsCreate = "Projects.Create";
    public const string ProjectsEdit = "Projects.Edit";
    public const string ProjectsDelete = "Projects.Delete";
    public const string MilestonesView = "Milestones.View";
    public const string MilestonesCreate = "Milestones.Create";
    public const string MilestonesEdit = "Milestones.Edit";
    public const string MilestonesDelete = "Milestones.Delete";
    public const string TasksView = "Tasks.View";
    public const string TasksCreate = "Tasks.Create";
    public const string TasksEdit = "Tasks.Edit";
    public const string TasksDelete = "Tasks.Delete";
    public const string SubtasksView = "Subtasks.View";
    public const string SubtasksCreate = "Subtasks.Create";
    public const string SubtasksEdit = "Subtasks.Edit";
    public const string SubtasksDelete = "Subtasks.Delete";
    public const string UsersView = "Users.View";
    public const string UsersCreate = "Users.Create";
    public const string UsersEdit = "Users.Edit";
    public const string UsersDelete = "Users.Delete";
    public const string DocumentsView = "Documents.View";
    public const string DocumentsCreate = "Documents.Create";
    public const string DocumentsEdit = "Documents.Edit";
    public const string DocumentsDelete = "Documents.Delete";
    public const string UtilizationCertificateView = "UtilizationCertificates.View";
    public const string UtilizationCertificateCreate = "UtilizationCertificates.Create";
    public const string UtilizationCertificateEdit = "UtilizationCertificates.Edit";
    public const string UtilizationCertificateDelete = "UtilizationCertificates.Delete";
    public const string UtilizationCertificateReview = "UtilizationCertificates.Review";
}
