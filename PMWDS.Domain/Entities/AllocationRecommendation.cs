using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class AllocationRecommendation : AuditableEntity
{
    public Guid TaskId { get; private set; }
    public Guid ModelId { get; private set; }
    public Guid RecommendedUserId { get; private set; }
    public double MatchScore { get; private set; }
    public string RationaleJson { get; private set; } = "[]";
    public string FeatureScoresJson { get; private set; } = "{}";
    public string AlternativesJson { get; private set; } = "[]";
    public string Status { get; private set; } = "Pending";
    public string? DecisionReason { get; private set; }

    public ProjectTask? Task { get; private set; }
    public AIModel? Model { get; private set; }

    protected AllocationRecommendation() { }

    public static AllocationRecommendation Create(
        Guid taskId,
        Guid modelId,
        Guid recommendedUserId,
        double matchScore,
        IEnumerable<string>? rationale,
        IDictionary<string, double>? featureScores,
        IEnumerable<object>? alternatives)
    {
        return new AllocationRecommendation
        {
            TaskId = taskId,
            ModelId = modelId,
            RecommendedUserId = recommendedUserId,
            MatchScore = matchScore,
            RationaleJson = JsonSerializer.Serialize(rationale ?? Enumerable.Empty<string>()),
            FeatureScoresJson = JsonSerializer.Serialize(featureScores ?? new Dictionary<string, double>()),
            AlternativesJson = JsonSerializer.Serialize(alternatives ?? Enumerable.Empty<object>())
        };
    }

    public void Accept()
    {
        Status = "Accepted";
        DecisionReason = null;
    }

    public void Reject(string reason)
    {
        Status = "Rejected";
        DecisionReason = reason.Trim();
    }
}
