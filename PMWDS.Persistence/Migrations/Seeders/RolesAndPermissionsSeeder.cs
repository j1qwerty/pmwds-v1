using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class RolesAndPermissionsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        await SeedPermissionsAsync(context, ct);
        await SeedRolesAsync(context, ct);
    }

    private static async Task SeedPermissionsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new[]
        {
            (PermissionCodes.AuthManage, "Manage Authentication", "Manage authentication and access policies.", "Authentication", true),
            (PermissionCodes.SystemAdmin, "System Administration", "Full system administration access.", "System", true),
            (PermissionCodes.SystemDatabaseView, "View Database Status", "View active database provider and fallback status.", "System", true),
            (PermissionCodes.OrganizationManage, "Manage Organizations", "Manage all organization permissions.", "Organization", true),
            (PermissionCodes.OrganizationView, "View Organizations", "View organization records.", "Organization", true),
            (PermissionCodes.OrganizationCreate, "Create Organizations", "Create organization records.", "Organization", true),
            (PermissionCodes.OrganizationEdit, "Edit Organizations", "Update organization records.", "Organization", true),
            (PermissionCodes.OrganizationDelete, "Delete Organizations", "Delete organization records.", "Organization", true),
            (PermissionCodes.DepartmentManage, "Manage Departments", "Manage all department permissions.", "Departments", false),
            (PermissionCodes.DepartmentView, "View Departments", "View department records.", "Departments", false),
            (PermissionCodes.DepartmentCreate, "Create Departments", "Create department records.", "Departments", false),
            (PermissionCodes.DepartmentEdit, "Edit Departments", "Update department records.", "Departments", false),
            (PermissionCodes.DepartmentDelete, "Delete Departments", "Delete department records.", "Departments", false),
            (PermissionCodes.ProjectManage, "Manage Projects", "Manage all project permissions.", "Projects", false),
            (PermissionCodes.ProjectView, "View Projects", "View project records.", "Projects", false),
            (PermissionCodes.ProjectCreate, "Create Projects", "Create project records.", "Projects", false),
            (PermissionCodes.ProjectEdit, "Edit Projects", "Update project records.", "Projects", false),
            (PermissionCodes.ProjectDelete, "Delete Projects", "Delete project records.", "Projects", false),
            (PermissionCodes.ProjectPrimaryDepartmentManage, "Manage Primary Department Projects", "Keep visibility and control of projects created by the primary department.", "Projects", false),
            (PermissionCodes.MilestoneManage, "Manage Milestones", "Manage all milestone permissions.", "Milestones", false),
            (PermissionCodes.MilestoneView, "View Milestones", "View milestone records.", "Milestones", false),
            (PermissionCodes.MilestoneCreate, "Create Milestones", "Create milestone records.", "Milestones", false),
            (PermissionCodes.MilestoneEdit, "Edit Milestones", "Update milestone records.", "Milestones", false),
            (PermissionCodes.MilestoneDelete, "Delete Milestones", "Delete milestone records.", "Milestones", false),
            (PermissionCodes.TaskManage, "Manage Tasks", "Manage all task permissions.", "Tasks", false),
            (PermissionCodes.TaskView, "View Tasks", "View task records.", "Tasks", false),
            (PermissionCodes.TaskCreate, "Create Tasks", "Create task records.", "Tasks", false),
            (PermissionCodes.TaskEdit, "Edit Tasks", "Update task records.", "Tasks", false),
            (PermissionCodes.TaskDelete, "Delete Tasks", "Delete task records.", "Tasks", false),
            (PermissionCodes.TaskAssign, "Assign Tasks", "Assign task ownership.", "Tasks", false),
            (PermissionCodes.TaskCommentCreate, "Create Task Comments", "Add comments to tasks.", "Tasks", false),
            (PermissionCodes.TaskAttachmentCreate, "Create Task Attachments", "Upload task attachments.", "Tasks", false),
            (PermissionCodes.SubtaskManage, "Manage Subtasks", "Manage all subtask permissions.", "Subtasks", false),
            (PermissionCodes.SubtaskView, "View Subtasks", "View subtask records.", "Subtasks", false),
            (PermissionCodes.SubtaskCreate, "Create Subtasks", "Create subtask records.", "Subtasks", false),
            (PermissionCodes.SubtaskEdit, "Edit Subtasks", "Update subtask records.", "Subtasks", false),
            (PermissionCodes.SubtaskDelete, "Delete Subtasks", "Delete subtask records.", "Subtasks", false),
            (PermissionCodes.UserManage, "Manage Users", "Manage all user permissions.", "Users", false),
            (PermissionCodes.UserView, "View Users", "View user records.", "Users", false),
            (PermissionCodes.UserCreate, "Create Users", "Create user records.", "Users", false),
            (PermissionCodes.UserEdit, "Edit Users", "Update user records.", "Users", false),
            (PermissionCodes.UserDelete, "Delete Users", "Deactivate or delete users.", "Users", false),
            (PermissionCodes.UserDepartmentManage, "Manage User Departments", "Assign users to departments and organizations.", "Users", false),
            (PermissionCodes.UserProfilePictureManage, "Manage Profile Pictures", "Upload and update user profile pictures.", "Users", false),
            (PermissionCodes.RoleManage, "Manage Roles", "Manage all role permissions.", "Authorization", true),
            (PermissionCodes.RoleView, "View Roles", "View role records.", "Authorization", true),
            (PermissionCodes.RoleCreate, "Create Roles", "Create role records.", "Authorization", true),
            (PermissionCodes.RoleEdit, "Edit Roles", "Update role records.", "Authorization", true),
            (PermissionCodes.RoleDelete, "Delete Roles", "Delete role records.", "Authorization", true),
            (PermissionCodes.PermissionManage, "Manage Permissions", "Manage all permission records.", "Authorization", true),
            (PermissionCodes.PermissionView, "View Permissions", "View permission records.", "Authorization", true),
            (PermissionCodes.PermissionCreate, "Create Permissions", "Create permission records.", "Authorization", true),
            (PermissionCodes.PermissionEdit, "Edit Permissions", "Update permission records.", "Authorization", true),
            (PermissionCodes.PermissionDelete, "Delete Permissions", "Delete permission records.", "Authorization", true),
            (PermissionCodes.NotificationManage, "Manage Notifications", "Manage all notification permissions.", "Notifications", false),
            (PermissionCodes.NotificationView, "View Notifications", "View notifications.", "Notifications", false),
            (PermissionCodes.NotificationBroadcast, "Broadcast Notifications", "Broadcast notifications to users or groups.", "Notifications", false),
            (PermissionCodes.NotificationTemplateManage, "Manage Notification Templates", "Create and update notification templates.", "Notifications", true),
            (PermissionCodes.NotificationRuleManage, "Manage Alert Rules", "Create and update alert rules.", "Notifications", true),
            (PermissionCodes.ActivityLogManage, "Manage Activity Logs", "Manage all activity log permissions.", "Audit", true),
            (PermissionCodes.ActivityLogView, "View Activity Logs", "View activity logs.", "Audit", true),
            (PermissionCodes.ActivityLogCreate, "Create Activity Logs", "Create activity log entries.", "Audit", false),
            (PermissionCodes.ReportManage, "Manage Reports", "Manage all report permissions.", "Reports", false),
            (PermissionCodes.ReportView, "View Reports", "View reports.", "Reports", false),
            (PermissionCodes.ReportCreate, "Create Reports", "Create reports.", "Reports", false),
            (PermissionCodes.ReportEdit, "Edit Reports", "Update reports.", "Reports", false),
            (PermissionCodes.ReportDelete, "Delete Reports", "Delete reports.", "Reports", false),
            (PermissionCodes.KnowledgeView, "View Knowledge", "View knowledge articles and lessons.", "Knowledge", false),
            (PermissionCodes.KnowledgeCreate, "Create Knowledge", "Create knowledge articles and lessons.", "Knowledge", false),
            (PermissionCodes.KnowledgeEdit, "Edit Knowledge", "Update knowledge articles and lessons.", "Knowledge", false),
            (PermissionCodes.KnowledgeDelete, "Delete Knowledge", "Delete knowledge articles and lessons.", "Knowledge", false),
            (PermissionCodes.IntegrationView, "View Integrations", "View integrations and webhooks.", "Integrations", true),
            (PermissionCodes.IntegrationCreate, "Create Integrations", "Create integrations and webhooks.", "Integrations", true),
            (PermissionCodes.IntegrationEdit, "Edit Integrations", "Update integrations and webhooks.", "Integrations", true),
            (PermissionCodes.IntegrationDelete, "Delete Integrations", "Delete integrations and webhooks.", "Integrations", true),
            (PermissionCodes.AiView, "View AI", "View AI insights and predictions.", "AI", false),
            (PermissionCodes.AiManage, "Manage AI", "Manage AI providers, models, and training data.", "AI", true),
            (PermissionCodes.UtilizationCertificateView, "View Utilization Certificates", "View utilization certificates proving funds were spent as intended.", "Utilization Certificates", false),
            (PermissionCodes.UtilizationCertificateCreate, "Submit Utilization Certificates", "Upload and submit a utilization certificate against a project milestone or task.", "Utilization Certificates", false),
            (PermissionCodes.UtilizationCertificateEdit, "Edit Utilization Certificates", "Edit a draft or rejected utilization certificate you own.", "Utilization Certificates", false),
            (PermissionCodes.UtilizationCertificateReview, "Review Utilization Certificates", "Approve or reject submitted utilization certificates as the finance sign-off authority.", "Utilization Certificates", false),
            (PermissionCodes.UtilizationCertificateDelete, "Delete Utilization Certificates", "Delete draft or rejected utilization certificates.", "Utilization Certificates", false),
            (PermissionCodes.UtilizationCertificateManage, "Manage Utilization Certificates", "Full control over utilization certificates, including review and deletion.", "Utilization Certificates", true)
        };

        foreach (var spec in specs)
        {
            if (await context.Permissions.AnyAsync(p => p.Code == spec.Item1, ct))
                continue;

            var permission = Permission.Create(spec.Item1, spec.Item2, spec.Item3, spec.Item4, spec.Item5);
            permission.SetCreatedBy(SeedConstants.SeedUser);
            await context.Permissions.AddAsync(permission, ct);
        }

        await CleanupLegacyPermissionsAsync(context, ct);
        await context.SaveChangesAsync(ct);
    }

    private static async Task CleanupLegacyPermissionsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var replacements = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["AUTH.MANAGE"] = PermissionCodes.AuthManage,
            ["USERS.MANAGE"] = PermissionCodes.UserManage,
            ["ROLES.MANAGE"] = PermissionCodes.RoleManage,
            ["ORGS.MANAGE"] = PermissionCodes.OrganizationManage,
            ["PROJECTS.MANAGE"] = PermissionCodes.ProjectManage,
            ["TASKS.MANAGE"] = PermissionCodes.TaskManage,
            ["SYSTEM.ADMIN"] = PermissionCodes.SystemAdmin,
            ["SYSTEM.DATABASE.VIEW"] = PermissionCodes.SystemDatabaseView,
            ["USERS.PROFILE_PICTURE.MANAGE"] = PermissionCodes.UserProfilePictureManage,
            ["USERS.DEPARTMENTS.MANAGE"] = PermissionCodes.UserDepartmentManage,
            ["ACTIVITY_LOGS.VIEW"] = PermissionCodes.ActivityLogView
        };

        // Retired codes. Nothing grants these any more, so the rows and any role
        // grants are removed rather than left orphaned in the Permissions table.
        var retiredCodes = new[] { "TASK_TIME_TRACK" };

        var legacyCodes = replacements.Keys.ToList();
        var targetCodes = replacements.Values.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var permissions = await context.Permissions
            .Where(permission => legacyCodes.Contains(permission.Code) || targetCodes.Contains(permission.Code))
            .ToListAsync(ct);
        var byCode = permissions.ToDictionary(permission => permission.Code, StringComparer.OrdinalIgnoreCase);
        var roles = await context.Roles
            .Include(role => role.Permissions)
            .Where(role => role.Permissions.Any(permission => legacyCodes.Contains(permission.Code)))
            .ToListAsync(ct);

        foreach (var role in roles)
        {
            foreach (var (legacyCode, targetCode) in replacements)
            {
                if (!byCode.TryGetValue(legacyCode, out var legacyPermission) ||
                    !role.Permissions.Any(permission => permission.Id == legacyPermission.Id))
                    continue;

                if (byCode.TryGetValue(targetCode, out var targetPermission))
                    role.AddPermission(targetPermission);

                role.RemovePermission(legacyPermission.Id);
            }
        }

        context.Permissions.RemoveRange(permissions.Where(permission => legacyCodes.Contains(permission.Code)));

        await RemoveRetiredPermissionsAsync(context, retiredCodes, ct);
    }

    /// <summary>
    /// Deletes permission rows for features that no longer exist, together with any role grants
    /// pointing at them. Seeded roles are rebuilt from the catalog on every run, so removing the
    /// grant here is enough; this only exists to clean up databases seeded before the removal.
    /// </summary>
    private static async Task RemoveRetiredPermissionsAsync(
        ApplicationDbContext context,
        string[] retiredCodes,
        CancellationToken ct)
    {
        var retired = await context.Permissions
            .Where(permission => retiredCodes.Contains(permission.Code))
            .ToListAsync(ct);

        if (retired.Count == 0)
        {
            return;
        }

        var retiredIds = retired.Select(permission => permission.Id).ToList();
        var roles = await context.Roles
            .Include(role => role.Permissions)
            .Where(role => role.Permissions.Any(permission => retiredIds.Contains(permission.Id)))
            .ToListAsync(ct);

        foreach (var role in roles)
        {
            foreach (var permissionId in role.Permissions
                         .Where(permission => retiredIds.Contains(permission.Id))
                         .Select(permission => permission.Id)
                         .ToList())
            {
                role.RemovePermission(permissionId);
            }
        }

        context.Permissions.RemoveRange(retired);
    }

    private static async Task SeedRolesAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var permissions = await context.Permissions.ToDictionaryAsync(p => p.Code, ct);
        var allPermissionCodes = permissions.Keys.ToArray();
        var directorPermissionCodes = new[]
        {
            PermissionCodes.DepartmentManage,
            PermissionCodes.ProjectManage,
            PermissionCodes.ProjectPrimaryDepartmentManage,
            PermissionCodes.MilestoneManage,
            PermissionCodes.TaskManage,
            PermissionCodes.SubtaskManage,
            PermissionCodes.UserManage,
            PermissionCodes.NotificationManage,
            PermissionCodes.ActivityLogManage,
            PermissionCodes.ReportManage,
            PermissionCodes.RoleManage,
            PermissionCodes.PermissionManage,
            PermissionCodes.AiView,
            PermissionCodes.AiManage,
            PermissionCodes.UtilizationCertificateManage
        };
        var projectManagerPermissionCodes = new[]
        {
            PermissionCodes.DepartmentView,
            PermissionCodes.ProjectManage,
            PermissionCodes.ProjectPrimaryDepartmentManage,
            PermissionCodes.MilestoneManage,
            PermissionCodes.TaskManage,
            PermissionCodes.SubtaskManage,
            PermissionCodes.UserView,
            PermissionCodes.NotificationView,
            PermissionCodes.ActivityLogCreate,
            PermissionCodes.UtilizationCertificateView,
            PermissionCodes.UtilizationCertificateCreate,
            PermissionCodes.UtilizationCertificateEdit
        };
        var departmentHeadPermissionCodes = new[]
        {
            PermissionCodes.DepartmentManage,
            PermissionCodes.ProjectManage,
            PermissionCodes.ProjectPrimaryDepartmentManage,
            PermissionCodes.MilestoneManage,
            PermissionCodes.TaskManage,
            PermissionCodes.SubtaskManage,
            PermissionCodes.UserManage,
            PermissionCodes.NotificationView,
            PermissionCodes.ActivityLogView,
            PermissionCodes.ActivityLogCreate,
            PermissionCodes.UtilizationCertificateView,
            PermissionCodes.UtilizationCertificateCreate,
            PermissionCodes.UtilizationCertificateEdit,
            // A department head owns their department's projects (they are the
            // primary department), so they carry the same finance sign-off
            // authority as a Director for those projects.
            PermissionCodes.UtilizationCertificateReview,
            PermissionCodes.UtilizationCertificateDelete
        };
        var teamMemberPermissionCodes = new[]
        {
            PermissionCodes.ProjectView,
            PermissionCodes.MilestoneView,
            PermissionCodes.TaskView, PermissionCodes.TaskEdit, PermissionCodes.TaskCommentCreate, PermissionCodes.TaskAttachmentCreate,
            PermissionCodes.SubtaskView, PermissionCodes.SubtaskCreate, PermissionCodes.SubtaskEdit,
            PermissionCodes.NotificationView,
            PermissionCodes.ActivityLogCreate,
            PermissionCodes.UtilizationCertificateView,
            PermissionCodes.UtilizationCertificateCreate,
            PermissionCodes.UtilizationCertificateEdit
        };
        var viewerPermissionCodes = new[]
        {
            PermissionCodes.OrganizationView,
            PermissionCodes.DepartmentView,
            PermissionCodes.ProjectView,
            PermissionCodes.MilestoneView,
            PermissionCodes.TaskView,
            PermissionCodes.SubtaskView,
            PermissionCodes.NotificationView,
            PermissionCodes.ActivityLogView,
            PermissionCodes.UtilizationCertificateView
        };
        var specs = new[]
        {
            new SeedConstants.RoleSpec(RoleKeys.SuperAdmin, "SuperAdmin", "Full administrative access.", 100, allPermissionCodes),
            new SeedConstants.RoleSpec(RoleKeys.Director, "Director", "Organization administrator with full access inside one organization.", 90, directorPermissionCodes),
            new SeedConstants.RoleSpec(RoleKeys.ProjectManager, "ProjectManager", "Manages assigned projects and project teams.", 80, projectManagerPermissionCodes),
            new SeedConstants.RoleSpec(RoleKeys.DepartmentHead, "DepartmentHead", "Manages department capacity and planning.", 70, departmentHeadPermissionCodes),
            new SeedConstants.RoleSpec(RoleKeys.TeamMember, "TeamMember", "Contributes to project execution.", 40, teamMemberPermissionCodes),
            new SeedConstants.RoleSpec(RoleKeys.Viewer, "Viewer", "Read-only access.", 10, viewerPermissionCodes)
        };

        foreach (var spec in specs)
        {
            var role = await context.Roles
                .Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.Key == spec.Key || r.Name == spec.Name, ct);
            if (role == null)
            {
                role = Role.Create(spec.Key, spec.Name, spec.Description, spec.Level);
                role.SetCreatedBy(SeedConstants.SeedUser);
                await context.Roles.AddAsync(role, ct);
            }
            else
            {
                role.EnsureKey(spec.Key);
            }

            role.UpdatePaginationPageSize(spec.Key == RoleKeys.SuperAdmin ? 50 : 10);

            role.Permissions.Clear();
            foreach (var code in spec.PermissionCodes)
            {
                if (permissions.TryGetValue(code, out var permission) && role.Permissions.All(p => p.Id != permission.Id))
                    role.AddPermission(permission);
            }
        }

        await context.SaveChangesAsync(ct);
    }
}
