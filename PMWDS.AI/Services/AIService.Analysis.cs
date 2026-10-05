using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Exceptions;
using PMWDS.Domain.Entities;

namespace PMWDS.AI.Services;

public partial class AIService
{
    public async Task<ProjectHealthDto> AnalyzeProjectHealthAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(projectId, ct)
            ?? throw new NotFoundException("Project", projectId);
        var tasks = project.Tasks.ToList();
        var totalTasks = tasks.Count;
        var completed = tasks.Count(t => t.Status == Domain.Enums.TaskStatus.Completed);
        var overdue = tasks.Count(t => t.IsOverdue());
        var highRisk = tasks.Count(t => t.AIDelayProbability >= _settings.RiskThreshold);
        var health = totalTasks == 0
            ? 1.0
            : Math.Max(0, Math.Min(1, (100 - (overdue * 10) - (highRisk * 5) - (project.GetDelayDays() * 2) - (project.IsOverBudget() ? 15 : 0)) / 100.0));
        var delayRisk = totalTasks == 0 ? 0 : (double)overdue / totalTasks;
        var budgetRisk = project.PlannedBudget == 0 ? 0 : Math.Min(1, (double)project.ActualCost / (double)project.PlannedBudget);
        var insights = await GenerateProjectInsightsAsync(projectId, ct);

        var strengths = new List<string>();
        var weaknesses = new List<string>();
        if (completed > 0)
        {
            strengths.Add($"{completed} task(s) completed.");
        }
        if (overdue > 0)
        {
            weaknesses.Add($"{overdue} overdue task(s).");
        }
        if (highRisk > 0)
        {
            weaknesses.Add($"{highRisk} high-risk task(s).");
        }

        project.UpdateAIAnalysis(
            Math.Round(health * 100, 2),
            Math.Round(delayRisk, 4),
            Math.Round(Math.Min(1, budgetRisk), 4),
            string.Join(" ", insights));
        await _uow.Projects.UpdateAsync(project, ct);
        await _uow.SaveChangesAsync(ct);

        return new ProjectHealthDto(
            projectId,
            project.Name,
            health,
            Math.Max(0, 1 - delayRisk),
            Math.Max(0, 1 - budgetRisk),
            Math.Max(0, 1 - (highRisk * 0.1)),
            totalTasks == 0 ? 1.0 : completed / (double)totalTasks,
            health >= 0.75 ? "Healthy" : health >= 0.5 ? "At Risk" : "Critical",
            strengths,
            weaknesses.Concat(insights).ToList(),
            GetRecommendations(health * 100, delayRisk, budgetRisk),
            BuildRiskFactors(project, overdue, highRisk),
            DateTime.UtcNow);
    }

    public async Task<List<string>> GenerateProjectInsightsAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(projectId, ct);
        if (project == null)
        {
            return new List<string>();
        }

        var insights = new List<string>();
        var tasks = project.Tasks.ToList();
        if (tasks.Any(t => t.IsOverdue()))
        {
            insights.Add($"{tasks.Count(t => t.IsOverdue())} task(s) are overdue and need attention.");
        }
        if (project.IsOverBudget())
        {
            insights.Add($"Budget exceeded by {project.ActualCost - project.PlannedBudget:C}.");
        }
        if (project.GetDelayDays() > 0)
        {
            insights.Add($"Project is {project.GetDelayDays()} day(s) behind schedule.");
        }

        var highBurnout = await _uow.Users.FindAsync(
            u => u.AIBurnoutRiskScore > 0.8 && u.DepartmentId != null && u.DepartmentId == project.DepartmentId,
            ct);
        if (highBurnout.Any())
        {
            insights.Add($"{highBurnout.Count()} team member(s) show high burnout risk.");
        }

        if (await _chat.IsConfiguredAsync(ct: ct))
        {
            try
            {
                var summary = await _chat.GenerateSummaryAsync(
                    $"Summarize project health: Name={project.Name}, Progress={project.ProgressPercentage}%, Delays={project.GetDelayDays()} days, Budget variance={project.GetBudgetVariance():C}",
                    ct: ct);
                insights.Add($"AI Summary: {summary}");
            }
            catch
            {
                // AI summary unavailable, skip gracefully
            }
        }

        return insights;
    }

    public async Task<ResourceOptimizationDto> OptimizeResourceAllocationAsync(Guid projectId, CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(projectId, ct)
            ?? throw new NotFoundException("Project", projectId);
        var unassigned = project.Tasks
            .Where(t => t.AssignedToUserId == null && t.Status != Domain.Enums.TaskStatus.Completed)
            .ToList();
        var available = await _uow.Users.GetAvailableUsersAsync(ct);
        var actionPlan = new List<string>();
        var suggestions = new List<ReallocationSuggestion>();

        foreach (var user in available)
        {
            var workload = await _uow.Users.GetUserWorkloadScoreAsync(user.Id.ToString(), ct);
            if (workload > 80)
            {
                actionPlan.Add($"Reduce workload for {user.FullName}.");
            }
        }

        foreach (var task in unassigned)
        {
            var recommendation = await GetOptimalAssigneeAsync(task.Id, ct);
            suggestions.Add(new ReallocationSuggestion(
                task.Id,
                task.Title,
                task.AssignedToUserId?.ToString() ?? string.Empty,
                string.Empty,
                recommendation.RecommendedUserId,
                recommendation.RecommendedUserName,
                recommendation.Rationale.FirstOrDefault() ?? "AI-based allocation recommendation.",
                recommendation.ConfidenceScore));
        }

        if (unassigned.Any())
        {
            actionPlan.Add($"Assign {unassigned.Count} unassigned task(s) using AI recommendations.");
        }

        return new ResourceOptimizationDto(projectId, suggestions, suggestions.Any() ? 20 : 5, unassigned.Count, actionPlan, DateTime.UtcNow);
    }

    public Task<string> GenerateNaturalLanguageSummaryAsync(string context, CancellationToken ct = default)
        => _chat.GenerateSummaryAsync(context, ct: ct);

    public Task<IReadOnlyList<AIProviderInfoDto>> GetProvidersAsync(CancellationToken ct = default)
        => _chat.GetProvidersAsync(ct);

    public Task<IReadOnlyList<AIModelInfoDto>> SearchModelsAsync(string provider, string? search = null, int limit = 25, CancellationToken ct = default)
        => _chat.SearchModelsAsync(provider, search, limit, ct);

    public Task<AIProviderTestResultDto> TestProviderAsync(string provider, string? model = null, string? prompt = null, CancellationToken ct = default)
        => _chat.TestProviderAsync(provider, model, prompt, ct);

    public Task<ChatResponseDto> ProcessChatMessageAsync(string userId, string message, string? provider = null, string? model = null, CancellationToken ct = default)
        => _chat.ProcessAsync(userId, message, provider, model, ct);

    public async Task<string> GenerateStructuredReportAsync(
        string systemPrompt,
        string userContext,
        CancellationToken ct = default)
    {
        if (!await _chat.IsConfiguredAsync(ct: ct))
        {
            throw new InvalidOperationException(
                "AI provider is not configured. Please configure AI settings first.");
        }

        return await _chat.GenerateStructuredReportAsync(systemPrompt, userContext, ct);
    }
}
