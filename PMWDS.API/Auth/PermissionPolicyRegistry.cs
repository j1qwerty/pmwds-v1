using Microsoft.AspNetCore.Authorization;
using PMWDS.Application.Security;

namespace PMWDS.API.Auth;

public static class PermissionPolicyRegistry
{
    public static void AddPolicies(AuthorizationOptions options)
    {
        options.AddPolicy(AuthorizationPolicies.Authenticated, policy => policy.RequireAuthenticatedUser());
        options.AddPolicy(AuthorizationPolicies.SuperAdmin, policy => RequireAny(policy, PermissionCodes.SystemAdmin));
        options.AddPolicy(AuthorizationPolicies.Director, policy => RequireAny(
            policy,
            PermissionCodes.SystemAdmin,
            PermissionCodes.OrganizationManage,
            PermissionCodes.OrganizationView,
            PermissionCodes.OrganizationEdit,
            PermissionCodes.ActivityLogManage,
            PermissionCodes.ActivityLogView));
        options.AddPolicy(AuthorizationPolicies.Manager, policy => RequireAny(
            policy,
            PermissionCodes.SystemAdmin,
            PermissionCodes.ProjectManage,
            PermissionCodes.ProjectPrimaryDepartmentManage,
            PermissionCodes.ProjectCreate,
            PermissionCodes.ProjectEdit,
            PermissionCodes.TaskManage,
            PermissionCodes.TaskCreate,
            PermissionCodes.TaskEdit,
            PermissionCodes.MilestoneManage,
            PermissionCodes.SubtaskManage));
        options.AddPolicy(AuthorizationPolicies.TaskEditor, policy => RequireAny(
            policy,
            PermissionCodes.SystemAdmin,
            PermissionCodes.TaskManage,
            PermissionCodes.TaskCreate,
            PermissionCodes.TaskEdit,
            PermissionCodes.TaskAssign,
            PermissionCodes.SubtaskManage,
            PermissionCodes.SubtaskCreate,
            PermissionCodes.SubtaskEdit));

        AddCrud(options, "Organizations", PermissionCodes.OrganizationManage, PermissionCodes.OrganizationView, PermissionCodes.OrganizationCreate, PermissionCodes.OrganizationEdit, PermissionCodes.OrganizationDelete);

        AddScopedCrud(options, "Departments",
            PermissionCodes.DepartmentOwnManage, PermissionCodes.DepartmentOwnView, PermissionCodes.DepartmentOwnCreate, PermissionCodes.DepartmentOwnEdit, PermissionCodes.DepartmentOwnDelete,
            PermissionCodes.DepartmentAllManage, PermissionCodes.DepartmentAllView, PermissionCodes.DepartmentAllCreate, PermissionCodes.DepartmentAllEdit, PermissionCodes.DepartmentAllDelete);

        AddScopedCrud(options, "Projects",
            PermissionCodes.ProjectOwnManage, PermissionCodes.ProjectOwnView, PermissionCodes.ProjectOwnCreate, PermissionCodes.ProjectOwnEdit, PermissionCodes.ProjectOwnDelete,
            PermissionCodes.ProjectAllManage, PermissionCodes.ProjectAllView, PermissionCodes.ProjectAllCreate, PermissionCodes.ProjectAllEdit, PermissionCodes.ProjectAllDelete);

        AddScopedCrud(options, "Milestones",
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneOwnView, PermissionCodes.MilestoneOwnCreate, PermissionCodes.MilestoneOwnEdit, PermissionCodes.MilestoneOwnDelete,
            PermissionCodes.MilestoneAllManage, PermissionCodes.MilestoneAllView, PermissionCodes.MilestoneAllCreate, PermissionCodes.MilestoneAllEdit, PermissionCodes.MilestoneAllDelete);

        AddScopedCrud(options, "Tasks",
            PermissionCodes.TaskOwnManage, PermissionCodes.TaskOwnView, PermissionCodes.TaskOwnCreate, PermissionCodes.TaskOwnEdit, PermissionCodes.TaskOwnDelete,
            PermissionCodes.TaskAllManage, PermissionCodes.TaskAllView, PermissionCodes.TaskAllCreate, PermissionCodes.TaskAllEdit, PermissionCodes.TaskAllDelete);
        options.AddPolicy("Tasks.Assign", policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.TaskOwnAssign, PermissionCodes.TaskAllAssign));
        options.AddPolicy("Tasks.Comments", policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.TaskOwnCommentCreate, PermissionCodes.TaskAllCommentCreate));
        options.AddPolicy("Tasks.Attachments", policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.TaskOwnAttachmentCreate, PermissionCodes.TaskAllAttachmentCreate));

        AddScopedCrud(options, "Subtasks",
            PermissionCodes.SubtaskOwnManage, PermissionCodes.SubtaskOwnView, PermissionCodes.SubtaskOwnCreate, PermissionCodes.SubtaskOwnEdit, PermissionCodes.SubtaskOwnDelete,
            PermissionCodes.SubtaskAllManage, PermissionCodes.SubtaskAllView, PermissionCodes.SubtaskAllCreate, PermissionCodes.SubtaskAllEdit, PermissionCodes.SubtaskAllDelete);

        AddScopedCrud(options, "Users",
            PermissionCodes.UserOwnManage, PermissionCodes.UserOwnView, PermissionCodes.UserOwnCreate, PermissionCodes.UserOwnEdit, PermissionCodes.UserOwnDelete,
            PermissionCodes.UserAllManage, PermissionCodes.UserAllView, PermissionCodes.UserAllCreate, PermissionCodes.UserAllEdit, PermissionCodes.UserAllDelete);

        AddScopedCrud(options, "Notifications",
            PermissionCodes.NotificationOwnManage, PermissionCodes.NotificationOwnView, PermissionCodes.NotificationOwnCreate, PermissionCodes.NotificationOwnEdit, PermissionCodes.NotificationOwnDelete,
            PermissionCodes.NotificationAllManage, PermissionCodes.NotificationAllView, PermissionCodes.NotificationAllCreate, PermissionCodes.NotificationAllEdit, PermissionCodes.NotificationAllDelete);

        AddScopedCrud(options, "Reports",
            PermissionCodes.ReportOwnManage, PermissionCodes.ReportOwnView, PermissionCodes.ReportOwnCreate, PermissionCodes.ReportOwnEdit, PermissionCodes.ReportOwnDelete,
            PermissionCodes.ReportAllManage, PermissionCodes.ReportAllView, PermissionCodes.ReportAllCreate, PermissionCodes.ReportAllEdit, PermissionCodes.ReportAllDelete);

        AddScopedCrud(options, "Knowledge",
            PermissionCodes.KnowledgeOwnManage, PermissionCodes.KnowledgeOwnView, PermissionCodes.KnowledgeOwnCreate, PermissionCodes.KnowledgeOwnEdit, PermissionCodes.KnowledgeOwnDelete,
            PermissionCodes.KnowledgeAllManage, PermissionCodes.KnowledgeAllView, PermissionCodes.KnowledgeAllCreate, PermissionCodes.KnowledgeAllEdit, PermissionCodes.KnowledgeAllDelete);

        AddScopedCrud(options, "Documents",
            PermissionCodes.DocumentOwnManage, PermissionCodes.DocumentOwnView, PermissionCodes.DocumentOwnCreate, PermissionCodes.DocumentOwnEdit, PermissionCodes.DocumentOwnDelete,
            PermissionCodes.DocumentAllManage, PermissionCodes.DocumentAllView, PermissionCodes.DocumentAllCreate, PermissionCodes.DocumentAllEdit, PermissionCodes.DocumentAllDelete);

        options.AddPolicy("Documents.Upload", policy => RequireAny(
            policy,
            PermissionCodes.SystemAdmin,
            PermissionCodes.DocumentOwnProjectUpload,
            PermissionCodes.DocumentOwnMilestoneUpload,
            PermissionCodes.DocumentOwnTaskUpload,
            PermissionCodes.DocumentAllProjectUpload,
            PermissionCodes.DocumentAllMilestoneUpload,
            PermissionCodes.DocumentAllTaskUpload));

        options.AddPolicy("UtilizationCertificates.Upload", policy => RequireAny(
            policy,
            PermissionCodes.SystemAdmin,
            PermissionCodes.UtilizationCertificateOwnProjectUpload,
            PermissionCodes.UtilizationCertificateOwnMilestoneUpload,
            PermissionCodes.UtilizationCertificateOwnTaskUpload,
            PermissionCodes.UtilizationCertificateAllProjectUpload,
            PermissionCodes.UtilizationCertificateAllMilestoneUpload,
            PermissionCodes.UtilizationCertificateAllTaskUpload));

        AddScopedCrud(options, "UtilizationCertificates",
            PermissionCodes.UtilizationCertificateOwnManage, PermissionCodes.UtilizationCertificateOwnView, PermissionCodes.UtilizationCertificateOwnCreate, PermissionCodes.UtilizationCertificateOwnEdit, PermissionCodes.UtilizationCertificateOwnDelete,
            PermissionCodes.UtilizationCertificateAllManage, PermissionCodes.UtilizationCertificateAllView, PermissionCodes.UtilizationCertificateAllCreate, PermissionCodes.UtilizationCertificateAllEdit, PermissionCodes.UtilizationCertificateAllDelete);

        options.AddPolicy(AuthorizationPolicies.ActivityLogsView, policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.ActivityLogManage, PermissionCodes.ActivityLogView));
        options.AddPolicy(AuthorizationPolicies.ActivityLogsCreate, policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.ActivityLogManage, PermissionCodes.ActivityLogCreate));
        options.AddPolicy(AuthorizationPolicies.ActivityLogsManage, policy => RequireAny(policy, PermissionCodes.SystemAdmin, PermissionCodes.ActivityLogManage));
    }

    private static void AddCrud(
        AuthorizationOptions options,
        string prefix,
        string manage,
        string view,
        string create,
        string edit,
        string delete)
    {
        options.AddPolicy($"{prefix}.View", policy => RequireAny(policy, PermissionCodes.SystemAdmin, manage, view));
        options.AddPolicy($"{prefix}.Create", policy => RequireAny(policy, PermissionCodes.SystemAdmin, manage, create));
        options.AddPolicy($"{prefix}.Edit", policy => RequireAny(policy, PermissionCodes.SystemAdmin, manage, edit));
        options.AddPolicy($"{prefix}.Delete", policy => RequireAny(policy, PermissionCodes.SystemAdmin, manage, delete));
        options.AddPolicy($"{prefix}.Manage", policy => RequireAny(policy, PermissionCodes.SystemAdmin, manage));
    }

    private static void AddScopedCrud(
        AuthorizationOptions options,
        string prefix,
        string ownManage, string ownView, string ownCreate, string ownEdit, string ownDelete,
        string allManage, string allView, string allCreate, string allEdit, string allDelete)
    {
        options.AddPolicy($"{prefix}.View", policy => RequireAny(policy, PermissionCodes.SystemAdmin, ownManage, ownView, allManage, allView));
        options.AddPolicy($"{prefix}.Create", policy => RequireAny(policy, PermissionCodes.SystemAdmin, ownManage, ownCreate, allManage, allCreate));
        options.AddPolicy($"{prefix}.Edit", policy => RequireAny(policy, PermissionCodes.SystemAdmin, ownManage, ownEdit, allManage, allEdit));
        options.AddPolicy($"{prefix}.Delete", policy => RequireAny(policy, PermissionCodes.SystemAdmin, ownManage, ownDelete, allManage, allDelete));
        options.AddPolicy($"{prefix}.Manage", policy => RequireAny(policy, PermissionCodes.SystemAdmin, ownManage, allManage));
    }

    private static void RequireAny(AuthorizationPolicyBuilder policy, params string[] permissionCodes)
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new PermissionAuthorizationRequirement(permissionCodes));
    }
}
