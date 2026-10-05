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

        foreach (var user in users)
        {
            if (await context.Notifications.AnyAsync(n => n.UserId == user.Id.ToString(), ct))
                continue;

            await context.Notifications.AddAsync(Notification.Create(user.Id.ToString(), "Task assigned", "A seeded delivery task is ready for review.", NotificationType.TaskAssigned, NotificationPriority.Normal, "/tasks"), ct);
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
