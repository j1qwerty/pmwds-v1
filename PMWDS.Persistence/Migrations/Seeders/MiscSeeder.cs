using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class MiscSeeder
{
    internal static async Task SeedAsync(
        ApplicationDbContext context,
        CancellationToken ct)
    {
        await SeedSkillsAsync(context, ct);
        await SeedCollaborationAsync(context, ct);
        await SeedAnalyticsAsync(context, ct);
        await SeedIntegrationsAsync(context, ct);
        await SeedKnowledgeAsync(context, ct);
        await SeedAiAsync(context, ct);
        await SeedAiProviderCredentialsAsync(context, ct);
        await SeedAiGlobalSettingsAsync(context, ct);
    }

    private static async Task SeedSkillsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new[]
        {
            ("C#", "Technical", "Backend development with C# and .NET"),
            (".NET", "Technical", "ASP.NET Core services and clean architecture"),
            ("React", "Technical", "Client-side application development"),
            ("SQL Server", "Technical", "Relational database design and tuning"),
            ("SQLite", "Technical", "Local development database support"),
            ("Azure", "Technical", "Cloud services and deployment"),
            ("Project Management", "Professional", "Delivery planning and stakeholder management"),
            ("Agile", "Professional", "Iterative delivery and ceremonies"),
            ("Testing", "Quality", "Automated and exploratory testing"),
            ("DevOps", "Technical", "CI/CD and operational practices"),
            ("Data Analysis", "Analytics", "Operational reporting and insight generation"),
            ("Security Review", "Security", "Risk, access, and secure delivery review")
        };

        foreach (var spec in specs)
        {
            if (await context.Skills.AnyAsync(s => s.Name == spec.Item1, ct))
                continue;

            var skill = Skill.Create(spec.Item1, spec.Item2, spec.Item3);
            skill.SetCreatedBy(SeedConstants.SeedUser);
            await context.Skills.AddAsync(skill, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedCollaborationAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var tasks = await context.Tasks.Where(t => t.ParentTaskId == null).Take(10).ToListAsync(ct);
        var users = await context.Users.Take(5).ToListAsync(ct);

        foreach (var task in tasks)
        {
            await SeedCommentsAsync(context, task, users, ct);
        }

        await SeedDependenciesAsync(context, tasks, ct);
        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedCommentsAsync(ApplicationDbContext context, ProjectTask task, List<ApplicationUser> users, CancellationToken ct)
    {
        if (await context.TaskComments.AnyAsync(c => c.TaskId == task.Id, ct))
            return;

        foreach (var user in users.Take(2))
        {
            var comment = TaskComment.Create(task.Id, user.Id, $"Seed update from {user.FullName}: progress is tracking against plan.");
            await context.TaskComments.AddAsync(comment, ct);
        }
    }

    private static async Task SeedDependenciesAsync(ApplicationDbContext context, List<ProjectTask> tasks, CancellationToken ct)
    {
        for (var i = 1; i < tasks.Count; i++)
        {
            var predecessor = tasks[i - 1];
            var successor = tasks[i];
            var exists = await context.TaskDependencies.AnyAsync(d => d.PredecessorTaskId == predecessor.Id && d.SuccessorTaskId == successor.Id, ct);
            if (exists)
                continue;

            await context.TaskDependencies.AddAsync(TaskDependency.Create(predecessor.Id, successor.Id, DependencyType.FinishToStart, 1), ct);
        }
    }

    private static async Task SeedAnalyticsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.Take(3).ToListAsync(ct);

        foreach (var user in users)
        {
            if (await context.Dashboards.AnyAsync(d => d.UserId == user.Id, ct))
                continue;

            var dashboard = Dashboard.Create(user.Id, $"{user.FirstName}'s Delivery Board", "three-column", true);
            dashboard.SetCreatedBy(SeedConstants.SeedUser);
            await context.Dashboards.AddAsync(dashboard, ct);
            await context.SaveChangesAsync(ct);
            await SeedDashboardWidgetsAsync(context, dashboard.Id, ct);
        }

        await SeedReportsAsync(context, users, ct);
    }

    private static async Task SeedDashboardWidgetsAsync(ApplicationDbContext context, Guid dashboardId, CancellationToken ct)
    {
        var widgets = new[]
        {
            DashboardWidget.Create(dashboardId, "ProjectHealth", "Project Health", new { scope = "assigned" }, 300, new[] { "PROJECTS.MANAGE" }, 1),
            DashboardWidget.Create(dashboardId, "TaskBacklog", "Task Backlog", new { groupBy = "status" }, 180, new[] { "TASKS.MANAGE" }, 2),
            DashboardWidget.Create(dashboardId, "RiskSignals", "Risk Signals", new { threshold = 0.7 }, 600, new[] { "REPORTS.MANAGE" }, 3)
        };

        foreach (var widget in widgets)
        {
            widget.SetCreatedBy(SeedConstants.SeedUser);
            await context.DashboardWidgets.AddAsync(widget, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Intentionally does not seed Reports.
    ///
    /// These were placeholder rows ("Weekly Delivery Health", "Capacity Forecast", "Risk Register
    /// Export") whose Data was the literal string "Seed report: &lt;name&gt;". They appeared in the
    /// Reports list as real entries with a 30-35 byte payload, which is indistinguishable from a
    /// genuine generated report until opened, and they carried weekly e-mail schedules pointing at
    /// a placeholder address.
    ///
    /// Reports are generated by the AI pipeline instead, so there is nothing to seed. If a sample
    /// report is ever wanted, create it through the API so it holds a real payload.
    /// </summary>
    private static Task SeedReportsAsync(ApplicationDbContext context, List<ApplicationUser> users, CancellationToken ct)
        => Task.CompletedTask;

    private static async Task SeedReportScheduleAsync(ApplicationDbContext context, Guid reportId, string email, CancellationToken ct)
    {
        if (await context.ReportSchedules.AnyAsync(s => s.ReportId == reportId, ct))
            return;

        var schedule = ReportSchedule.Create(reportId, "Weekly", DateTime.UtcNow.Date.AddDays(7).AddHours(9), new[] { email, "delivery-office@example.com" }, new { channel = "Email", format = "pdf" });
        schedule.SetCreatedBy(SeedConstants.SeedUser);
        await context.ReportSchedules.AddAsync(schedule, ct);
        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedIntegrationsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new SeedConstants.IntegrationSpec[]
        {
            new("Jira", "Jira Cloud Delivery Sync", new Dictionary<string, object> { ["projectKey"] = "PMWDS", ["mode"] = "pull" }, true),
            new("Slack", "Slack Delivery Alerts", new Dictionary<string, object> { ["channel"] = "#delivery-alerts" }, true),
            new("GitHub", "GitHub Repository Events", new Dictionary<string, object> { ["organization"] = "pmwds" }, false)
        };

        foreach (var spec in specs)
        {
            var integration = await context.Integrations.FirstOrDefaultAsync(i => i.Name == spec.Name, ct);
            if (integration == null)
            {
                integration = Integration.Create(spec.Type, spec.Name, spec.Configuration, spec.Enabled);
                integration.SetCreatedBy(SeedConstants.SeedUser);
                integration.MarkSynced(spec.Enabled ? "Healthy" : "Pending");
                await context.Integrations.AddAsync(integration, ct);
                await context.SaveChangesAsync(ct);
            }

            await SeedWebhooksAsync(context, integration.Id, ct);
        }
    }

    private static async Task SeedWebhooksAsync(ApplicationDbContext context, Guid integrationId, CancellationToken ct)
    {
        var seedSecret = Environment.GetEnvironmentVariable("PMWDS_SEED_WEBHOOK_SECRET");
        if (string.IsNullOrWhiteSpace(seedSecret))
        {
            // Never persist a hard-coded webhook signing secret in seed data.
            return;
        }

        var specs = new[]
        {
            ("task.created", "https://hooks.example.com/pmwds/task-created"),
            ("project.updated", "https://hooks.example.com/pmwds/project-updated")
        };

        foreach (var spec in specs)
        {
            var webhook = await context.Webhooks.FirstOrDefaultAsync(
                w => w.IntegrationId == integrationId && w.EventType == spec.Item1,
                ct);

            if (webhook == null)
            {
                webhook = Webhook.Create(
                    integrationId,
                    spec.Item1,
                    spec.Item2,
                    seedSecret,
                    new[] { "X-PMWDS-Source: seed" },
                    true);
                webhook.SetCreatedBy(SeedConstants.SeedUser);
                await context.Webhooks.AddAsync(webhook, ct);
                await context.SaveChangesAsync(ct);
            }

            await SeedWebhookDeliveryAsync(context, webhook.Id, ct);
        }
    }

    private static async Task SeedWebhookDeliveryAsync(ApplicationDbContext context, Guid webhookId, CancellationToken ct)
    {
        if (await context.WebhookDeliveries.AnyAsync(d => d.WebhookId == webhookId, ct))
            return;

        await context.WebhookDeliveries.AddAsync(WebhookDelivery.Create(webhookId, 200, "{\"ok\":true}", true, null), ct);
        await context.WebhookDeliveries.AddAsync(WebhookDelivery.Create(webhookId, 503, "{\"error\":\"temporary\"}", false, "Temporary upstream failure"), ct);
        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedKnowledgeAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var projects = await context.Projects.Take(4).ToListAsync(ct);
        var author = await context.Users.FirstAsync(ct);

        foreach (var project in projects)
        {
            if (!await context.KnowledgeArticles.AnyAsync(a => a.ProjectId == project.Id, ct))
            {
                var article = KnowledgeArticle.Create(project.Id, $"{project.Name} delivery playbook", "Seeded guidance for planning, delivery checkpoints, and support handoff.", "Delivery", new[] { "playbook", "delivery", project.Category }, author.Id, 0.82);
                article.SetCreatedBy(SeedConstants.SeedUser);
                article.IncrementViewCount();
                await context.KnowledgeArticles.AddAsync(article, ct);
            }

            if (!await context.LessonsLearned.AnyAsync(l => l.ProjectId == project.Id, ct))
            {
                var lesson = LessonLearned.Create(project.Id, $"{project.Name} dependency lesson", "Early dependency mapping reduced late-cycle rework.", "Planning", "Reduced schedule risk", new[] { "dependency", "planning", "risk" });
                lesson.SetCreatedBy(SeedConstants.SeedUser);
                await context.LessonsLearned.AddAsync(lesson, ct);
            }
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedAiAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var allocationModel = await EnsureAiModelAsync(context, "Default Task Allocation Model", "TaskAllocation", ct);
        var delayModel = await EnsureAiModelAsync(context, "Default Delay Prediction Model", "DelayPrediction", ct);
        var tasks = await context.Tasks.Where(t => t.ParentTaskId == null).Take(5).ToListAsync(ct);
        var users = await context.Users.Take(5).ToListAsync(ct);

        await SeedTrainingDataAsync(context, ct);
        foreach (var task in tasks)
        {
            var assignee = users.FirstOrDefault(u => u.Id == task.AssignedToUserId) ?? users.First();
            await SeedPredictionResultAsync(context, allocationModel.Id, delayModel.Id, task, ct);
            await SeedRecommendationAsync(context, allocationModel.Id, task.Id, assignee.Id, ct);
            await SeedDelayPredictionAsync(context, delayModel.Id, task.Id, task.DueDate, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedTrainingDataAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = new[]
        {
            ("TaskAllocation", new Dictionary<string, object?> { ["estimatedHours"] = 32, ["workload"] = 62 }, new Dictionary<string, object?> { ["accepted"] = true }, "Seed allocation history"),
            ("TaskAllocation", new Dictionary<string, object?> { ["estimatedHours"] = 18, ["workload"] = 44 }, new Dictionary<string, object?> { ["accepted"] = true }, "Seed assignment history"),
            ("DelayPrediction", new Dictionary<string, object?> { ["progress"] = 35, ["daysUntilDue"] = 8 }, new Dictionary<string, object?> { ["delayed"] = true }, "Seed delivery history"),
            ("DelayPrediction", new Dictionary<string, object?> { ["progress"] = 80, ["daysUntilDue"] = 14 }, new Dictionary<string, object?> { ["delayed"] = false }, "Seed completion history")
        };

        foreach (var spec in specs)
        {
            if (await context.TrainingDataPoints.AnyAsync(t => t.DataType == spec.Item1 && t.Source == spec.Item4, ct))
                continue;

            var data = TrainingDataPoint.Create(spec.Item1, spec.Item2, spec.Item3, spec.Item4);
            data.SetCreatedBy(SeedConstants.SeedUser);
            await context.TrainingDataPoints.AddAsync(data, ct);
        }
    }

    private static async Task SeedPredictionResultAsync(ApplicationDbContext context, Guid allocationModelId, Guid delayModelId, ProjectTask task, CancellationToken ct)
    {
        if (await context.PredictionResults.AnyAsync(p => p.TaskId == task.Id, ct))
            return;

        await context.PredictionResults.AddAsync(PredictionResult.Create(allocationModelId, task.Id, new Dictionary<string, object?> { ["task"] = task.Title, ["estimatedHours"] = task.EstimatedHours }, new Dictionary<string, object?> { ["matchScore"] = 0.81 }, 0.81, "Assign to the current seeded owner."), ct);
        await context.PredictionResults.AddAsync(PredictionResult.Create(delayModelId, task.Id, new Dictionary<string, object?> { ["progress"] = task.ProgressPercentage, ["dueDate"] = task.DueDate }, new Dictionary<string, object?> { ["delayProbability"] = task.AIDelayProbability }, 0.74, "Monitor dependency and workload signals."), ct);
    }

    private static async Task SeedRecommendationAsync(ApplicationDbContext context, Guid modelId, Guid taskId, Guid userId, CancellationToken ct)
    {
        if (await context.AllocationRecommendations.AnyAsync(r => r.TaskId == taskId, ct))
            return;

        var recommendation = AllocationRecommendation.Create(taskId, modelId, userId, 0.84, new[] { "Relevant seeded skills", "Available capacity", "Prior project context" }, new Dictionary<string, double> { ["skill"] = 0.87, ["capacity"] = 0.78, ["performance"] = 0.82 }, new[] { new { userId, score = 0.73, reason = "Backup candidate" } });
        recommendation.SetCreatedBy(SeedConstants.SeedUser);
        await context.AllocationRecommendations.AddAsync(recommendation, ct);
    }

    private static async Task SeedDelayPredictionAsync(ApplicationDbContext context, Guid modelId, Guid taskId, DateTime dueDate, CancellationToken ct)
    {
        if (await context.DelayPredictions.AnyAsync(p => p.TaskId == taskId, ct))
            return;

        var prediction = DelayPrediction.Create(taskId, modelId, 0.42, 3, dueDate.AddDays(3), new[] { "Dependency wait", "Reviewer capacity" }, new Dictionary<string, double> { ["dependency"] = 0.45, ["capacity"] = 0.31 });
        prediction.SetCreatedBy(SeedConstants.SeedUser);
        await context.DelayPredictions.AddAsync(prediction, ct);
    }

    private static async Task<AIModel> EnsureAiModelAsync(ApplicationDbContext context, string name, string type, CancellationToken ct)
    {
        var model = await context.AIModels.FirstOrDefaultAsync(m => m.Name == name && m.ModelType == type, ct);
        if (model != null)
            return model;

        model = type == "TaskAllocation"
            ? TaskAllocationModel.Create(name, "1.0.0", "Models/task-allocation.zip", new Dictionary<string, double> { ["riskThreshold"] = 0.7 }, new[] { "Availability", "Performance", "Workload", "BurnoutRisk" })
            : DelayPredictionModel.Create(name, "1.0.0", "Models/delay-prediction.zip", new Dictionary<string, double> { ["riskThreshold"] = 0.7 }, new[] { "EstimatedHours", "ActualHours", "ProgressPercentage", "DaysUntilDue" });
        model.SetCreatedBy(SeedConstants.SeedUser);
        model.UpdateMetrics(type == "TaskAllocation" ? 0.79 : 0.74, type == "TaskAllocation" ? 0.76 : 0.71, type == "TaskAllocation" ? 0.73 : 0.69);
        await context.AIModels.AddAsync(model, ct);
        await context.SaveChangesAsync(ct);
        return model;
    }

    private static async Task SeedAiProviderCredentialsAsync(
        ApplicationDbContext context,
        CancellationToken ct)
    {
        var specs = new[]
        {
            new SeedConstants.AIProviderCredentialSpec("OpenAI", "OpenAI", true, "https://api.openai.com/v1", "gpt-4o"),
            new SeedConstants.AIProviderCredentialSpec("OpenRouter", "OpenRouter", true, "https://openrouter.ai/api/v1", "nvidia/nemotron-3-ultra-550b-a55b:free")
        };

        foreach (var spec in specs)
        {
            var existing = await context.AIProviderCredentials.FirstOrDefaultAsync(p => p.Provider == spec.Provider, ct);
            if (existing != null)
            {
                // Older databases were seeded with OpenRouter disabled, which made it
                // Older databases may have a disabled provider. Keep the seeded provider settings aligned with the current configuration.
                var shouldEnable = spec.Enabled;
                if (shouldEnable && !existing.Enabled)
                {
                    existing.Update(
                        existing.Provider,
                        existing.DisplayName,
                        enabled: true,
                        existing.UseEnvironmentDefault,
                        existing.BaseUrl,
                        existing.DefaultModel);
                    existing.SetModified(SeedConstants.SeedUser);
                }

                continue;
            }

            var credential = AIProviderCredential.Create(
                spec.Provider,
                spec.DisplayName,
                spec.Enabled,
                useEnvironmentDefault: true,
                spec.BaseUrl,
                spec.DefaultModel);
            credential.SetCreatedBy(SeedConstants.SeedUser);
            await context.AIProviderCredentials.AddAsync(credential, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedAiGlobalSettingsAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var global = await context.AIGlobalSettings.FirstOrDefaultAsync(ct);

        if (global == null)
        {
            global = new AIGlobalSetting
            {
                DefaultProvider = SeedConstants.DefaultAiProvider,
                DefaultModel = string.Empty
            };
            global.SetCreatedBy(SeedConstants.SeedUser);
            await context.AIGlobalSettings.AddAsync(global, ct);
            await context.SaveChangesAsync(ct);
            return;
        }

        // The stored default provider overrides appsettings. Migrate a legacy
        // OpenAI default once OpenRouter is usable so the app stops defaulting
        // to a provider that has no API key configured.
        if (global.DefaultProvider.Equals("OpenAI", StringComparison.OrdinalIgnoreCase))
        {
            var openRouter = await context.AIProviderCredentials
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Provider == "OpenRouter", ct);
            // Only switch the stored default away from OpenAI once OpenRouter is
            // actually usable, otherwise reports would keep falling back.
            var openRouterConfigured = openRouter?.Enabled == true;

            if (openRouterConfigured)
            {
                global.DefaultProvider = SeedConstants.DefaultAiProvider;
                // Only replace an OpenAI model id; a namespaced model already belongs to OpenRouter.
                if (string.IsNullOrWhiteSpace(global.DefaultModel) ||
                    !global.DefaultModel.Contains('/', StringComparison.Ordinal))
                {
                    global.DefaultModel = string.Empty;
                }

                global.SetModified(SeedConstants.SeedUser);
                await context.SaveChangesAsync(ct);
            }
        }
    }
}
