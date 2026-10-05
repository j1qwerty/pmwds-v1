using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class NotificationsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.Take(5).ToListAsync(ct);
        await SeedNotificationTemplatesAsync(context, ct);
        await SeedAlertRulesAsync(context, ct);

        // Seeded notifications must point somewhere real. "/tasks" is not a route - the client
        // serves tasks under their project - so a click landed on the "no access" page.
        var sampleProject = await context.Projects
            .OrderBy(project => project.CreatedDate)
            .FirstOrDefaultAsync(ct);
        var sampleTask = sampleProject == null
            ? null
            : await context.Tasks
                .Where(task => task.ProjectId == sampleProject.Id)
                .OrderBy(task => task.CreatedDate)
                .FirstOrDefaultAsync(ct);

        foreach (var user in users)
        {
            if (await context.Notifications.AnyAsync(n => n.UserId == user.Id.ToString(), ct))
                continue;

            if (sampleTask != null)
            {
                await context.Notifications.AddAsync(Notification.Create(
                    user.Id.ToString(),
                    "Task assigned",
                    $"Task '{sampleTask.Title}' is ready for review.",
                    NotificationType.TaskAssigned,
                    NotificationPriority.Normal,
                    $"/projects/{sampleTask.ProjectId}/tasks?taskId={sampleTask.Id}",
                    sampleTask.Id.ToString(),
                    "Task"), ct);
            }

            // The AI page is a real route, so this one is safe to link directly.
            await context.Notifications.AddAsync(Notification.Create(user.Id.ToString(), "AI insight available", "Project risk signals have been refreshed.", NotificationType.AIInsight, NotificationPriority.High, "/ai", null, null, true), ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedNotificationTemplatesAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new[]
        {
            ("TaskAssigned", "Task {{title}} assigned", "Hello {{user}}, task {{title}} is ready.", new[] { "user", "title" }, new[] { "Email", "InApp" }),
            ("MilestoneRisk", "Milestone {{name}} at risk", "Milestone {{name}} needs attention by {{dueDate}}.", new[] { "name", "dueDate" }, new[] { "Email", "InApp" }),
            ("ReportReady", "Report {{reportName}} ready", "Your scheduled report is available.", new[] { "reportName" }, new[] { "Email" })
        };

        foreach (var spec in specs)
        {
            if (await context.NotificationTemplates.AnyAsync(t => t.TemplateType == spec.Item1, ct))
                continue;

            var template = NotificationTemplate.Create(spec.Item1, spec.Item2, spec.Item3, spec.Item4, spec.Item5);
            template.SetCreatedBy(SeedConstants.SeedUser);
            await context.NotificationTemplates.AddAsync(template, ct);
        }
    }

    private static async Task SeedAlertRulesAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new SeedConstants.AlertRuleSpec[]
        {
            new("High delay probability", "TaskRisk", "delayProbability >= 0.70", "NotifyManager", new Dictionary<string, object> { ["priority"] = "High", ["template"] = "MilestoneRisk" }),
            new("Budget nearing threshold", "ProjectBudget", "actualCost / plannedBudget >= 0.85", "CreateNotification", new Dictionary<string, object> { ["priority"] = "High" }),
            new("Unassigned task backlog", "TaskQueue", "unassignedCount > 3", "NotifyDepartmentHead", new Dictionary<string, object> { ["priority"] = "Normal" })
        };

        foreach (var spec in specs)
        {
            if (await context.AlertRules.AnyAsync(r => r.Name == spec.Name, ct))
                continue;

            var rule = AlertRule.Create(spec.Name, spec.ConditionType, spec.Expression, spec.ActionType, spec.Parameters);
            rule.SetCreatedBy(SeedConstants.SeedUser);
            await context.AlertRules.AddAsync(rule, ct);
        }
    }
}
