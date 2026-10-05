using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Exceptions;
using PMWDS.Domain.Entities;
using System.Text.Json;

namespace PMWDS.AI.Services;

public partial class AIService
{
    public async Task<AssigneeRecommendationDto> GetOptimalAssigneeAsync(Guid taskId, CancellationToken ct = default)
    {
        try
        {
            return ToAssigneeRecommendationDto(await GenerateRecommendationAsync(taskId, ct));
        }
        catch
        {
            return new AssigneeRecommendationDto(taskId, string.Empty, string.Empty, 0, new List<string>(), new List<AlternativeAssignee>(), new Dictionary<string, double>(), DateTime.UtcNow);
        }
    }

    public async Task<AllocationRecommendationRecordDto> GenerateRecommendationAsync(Guid taskId, CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(taskId, ct)
            ?? throw new NotFoundException("Task", taskId);
        var candidates = (await _uow.Users.GetAvailableUsersAsync(ct)).ToList();
        if (!candidates.Any())
        {
            throw new InvalidOperationException("No available users were found for recommendation.");
        }

        var model = await EnsureAllocationModelAsync(ct);
        var recommendation = await _allocation.RecommendAsync(task, candidates, ct);
        var recommendedUserId = Guid.Parse(recommendation.RecommendedUserId);

        var entity = AllocationRecommendation.Create(
            taskId,
            model.Id,
            recommendedUserId,
            NormalizeScore(recommendation.ConfidenceScore),
            recommendation.Rationale,
            recommendation.FeatureScores,
            recommendation.Alternatives.Select(a => new { a.UserId, a.UserName, a.Score, a.Reason }));
        entity.SetCreatedBy("system");
        await _uow.AllocationRecommendations.AddAsync(entity, ct);

        var predictionResult = PredictionResult.Create(
            model.Id,
            taskId,
            BuildRecommendationInput(task, candidates.Count),
            new Dictionary<string, object?>
            {
                ["recommendedUserId"] = recommendation.RecommendedUserId,
                ["recommendedUserName"] = recommendation.RecommendedUserName,
                ["confidenceScore"] = recommendation.ConfidenceScore,
                ["featureScores"] = recommendation.FeatureScores,
                ["alternatives"] = recommendation.Alternatives
            },
            NormalizeScore(recommendation.ConfidenceScore),
            recommendation.Rationale.FirstOrDefault() ?? "AI-generated assignee recommendation.");
        predictionResult.SetCreatedBy("system");
        await _uow.PredictionResults.AddAsync(predictionResult, ct);

        task.UpdateAIRecommendation(recommendation.ConfidenceScore, recommendedUserId);
        await _uow.Tasks.UpdateAsync(task, ct);
        await _uow.SaveChangesAsync(ct);

        return MapAllocationRecommendation(entity);
    }

    public async Task<IReadOnlyList<AllocationRecommendationRecordDto>> GetRecommendationHistoryAsync(Guid taskId, CancellationToken ct = default)
    {
        var records = await _uow.AllocationRecommendations.FindAsync(r => r.TaskId == taskId, ct);
        return records.OrderByDescending(r => r.CreatedDate).Select(MapAllocationRecommendation).ToList();
    }

    public async Task<AllocationRecommendationRecordDto> AcceptRecommendationAsync(Guid recommendationId, CancellationToken ct = default)
    {
        var recommendation = await _uow.AllocationRecommendations.GetByIdAsync(recommendationId, ct)
            ?? throw new NotFoundException("AllocationRecommendation", recommendationId);
        recommendation.Accept();

        var task = await _uow.Tasks.GetByIdAsync(recommendation.TaskId, ct);
        if (task != null)
        {
            task.UpdateAIRecommendation(recommendation.MatchScore, recommendation.RecommendedUserId);
            await _uow.Tasks.UpdateAsync(task, ct);
        }

        await _uow.AllocationRecommendations.UpdateAsync(recommendation, ct);
        await _uow.SaveChangesAsync(ct);
        return MapAllocationRecommendation(recommendation);
    }

    public async Task<AllocationRecommendationRecordDto> RejectRecommendationAsync(Guid recommendationId, string reason, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        }

        var recommendation = await _uow.AllocationRecommendations.GetByIdAsync(recommendationId, ct)
            ?? throw new NotFoundException("AllocationRecommendation", recommendationId);
        recommendation.Reject(reason);
        await _uow.AllocationRecommendations.UpdateAsync(recommendation, ct);
        await _uow.SaveChangesAsync(ct);
        return MapAllocationRecommendation(recommendation);
    }

    public async Task<string> ExplainRecommendationAsync(Guid recommendationId, CancellationToken ct = default)
    {
        var recommendation = await _uow.AllocationRecommendations.GetByIdAsync(recommendationId, ct)
            ?? throw new NotFoundException("AllocationRecommendation", recommendationId);
        var rationale = DeserializeList(recommendation.RationaleJson);
        var featureScores = DeserializeDoubleDictionary(recommendation.FeatureScoresJson);
        var topFactors = string.Join(", ", featureScores.OrderByDescending(x => x.Value).Take(3).Select(x => $"{x.Key}: {x.Value:F2}"));
        return $"Recommendation status: {recommendation.Status}. Top rationale: {string.Join(" | ", rationale)}. Dominant scoring factors: {topFactors}.";
    }

    public async Task<TaskAnalysisDto> AnalyzeTaskForAllocationAsync(Guid taskId, CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(taskId, ct)
            ?? throw new NotFoundException("Task", taskId);
        var candidates = (await _uow.Users.GetAvailableUsersAsync(ct)).ToList();
        return new TaskAnalysisDto(
            task.Id,
            task.Title,
            candidates.Count,
            $"Task '{task.Title}' can be scored against {candidates.Count} candidate(s) using workload, performance, burnout risk, and availability.",
            BuildRecommendationInput(task, candidates.Count),
            new List<string>
            {
                $"Priority: {task.Priority}",
                $"EstimatedHours: {task.EstimatedHours}",
                $"Dependencies: {task.Dependencies.Count}",
                $"EscalationLevel: {task.EscalationLevel}",
                $"AvailableCandidates: {candidates.Count}"
            },
            DateTime.UtcNow);
    }
}
