using Microsoft.ML;
using Microsoft.ML.Data;
using PMWDS.Application.DTOs.AI;
using PMWDS.Domain.Entities;
namespace PMWDS.AI.Services;

public interface ITaskAllocationEngine
{
    Task<AssigneeRecommendationDto> RecommendAsync(
    ProjectTask task,
    List<ApplicationUser> candidates,
    CancellationToken ct = default);
    Task TrainAsync(CancellationToken ct = default);
}
public class MLTaskAllocationEngine : ITaskAllocationEngine
{
    private readonly MLContext _ml;
    public MLTaskAllocationEngine()
    => _ml = new MLContext(seed: 42);
    public async Task<AssigneeRecommendationDto>
    RecommendAsync(
    ProjectTask task,
    List<ApplicationUser> candidates,
    CancellationToken ct = default)
    {
        if (!candidates.Any())
            throw new InvalidOperationException(
            "No candidates available.");
        // Score each candidate
        var scores = candidates
        .Select(u => new
        {
            User = u,
            Score = CalculateMatchScore(task, u)
        })
        .OrderByDescending(x => x.Score)
        .ToList();
        var best = scores.First();
        return new AssigneeRecommendationDto(
        TaskId: task.Id,
        RecommendedUserId: best.User.Id.ToString(),
        RecommendedUserName: best.User.FullName,
        ConfidenceScore: best.Score,
        Rationale: BuildRationale(task, best.User),
        Alternatives: scores.Skip(1).Take(3)
        .Select(s => new AlternativeAssignee(
        s.User.Id.ToString(),
       s.User.FullName,
       s.Score,
       $"Lower score than {best.User.FullName}"))
        .ToList(),
        FeatureScores: GetFeatureScores(task, best.User),
        GeneratedAt: DateTime.UtcNow
        );
    }
    public Task TrainAsync(CancellationToken ct = default)
    {
        // ML.NET training pipeline placeholder
        // Real implementation loads historical task/user data
        return Task.CompletedTask;
    }
    private static double CalculateMatchScore(
    ProjectTask task, ApplicationUser user)
    {
        double score = 0;
        // Availability weight: 30%
        score += user.AvailabilityPercentage / 100 * 0.30;
        // Performance weight: 25%
        score += user.AIPerformanceScore / 100 * 0.25;
        // Workload (inverse) weight: 25%
        var workloadFactor = Math.Max(0,
        1 - user.AIWorkloadScore / 100);
        score += workloadFactor * 0.25;
        // Burnout risk (inverse) weight: 20%
        var burnoutFactor = 1 - user.AIBurnoutRiskScore;
        score += burnoutFactor * 0.20;
        return Math.Round(score * 100, 2);
    }
    private static List<string> BuildRationale(
    ProjectTask task, ApplicationUser user)
    => new()
    {
 $"Availability: {user.AvailabilityPercentage}%",
 $"Performance Score: {user.AIPerformanceScore:F1}/100",
 $"Workload Score: {user.AIWorkloadScore:F1}/100",
 $"Burnout Risk: {user.AIBurnoutRiskScore * 100:F1}%",
 $"Active Tasks: {user.GetActiveTaskCount()}",
 $"Department Match: " +
 $"{(user.DepartmentId == task.Project?.DepartmentId
 ? "Yes" : "No")}"
    };
    private static Dictionary<string, double> GetFeatureScores(
    ProjectTask task, ApplicationUser user)
    => new()
    {
        ["Availability"] =
    user.AvailabilityPercentage / 100 * 0.30,
        ["Performance"] =
    user.AIPerformanceScore / 100 * 0.25,
        ["Workload"] =
    Math.Max(0, 1 - user.AIWorkloadScore / 100) * 0.25,
        ["BurnoutRisk"] =
    (1 - user.AIBurnoutRiskScore) * 0.20
    };
}
