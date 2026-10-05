using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class PredictionResult : AuditableEntity
{
    public Guid ModelId { get; private set; }
    public Guid? TaskId { get; private set; }
    public DateTime PredictionDate { get; private set; }
    public string InputFeaturesJson { get; private set; } = "{}";
    public string OutputPredictionsJson { get; private set; } = "{}";
    public double ConfidenceScore { get; private set; }
    public string Recommendation { get; private set; } = string.Empty;

    public AIModel? Model { get; private set; }
    public ProjectTask? Task { get; private set; }

    protected PredictionResult() { }

    public static PredictionResult Create(
        Guid modelId,
        Guid? taskId,
        IDictionary<string, object?>? inputFeatures,
        IDictionary<string, object?>? outputPredictions,
        double confidenceScore,
        string recommendation)
    {
        return new PredictionResult
        {
            ModelId = modelId,
            TaskId = taskId,
            PredictionDate = DateTime.UtcNow,
            InputFeaturesJson = JsonSerializer.Serialize(inputFeatures ?? new Dictionary<string, object?>()),
            OutputPredictionsJson = JsonSerializer.Serialize(outputPredictions ?? new Dictionary<string, object?>()),
            ConfidenceScore = Math.Clamp(confidenceScore, 0, 1),
            Recommendation = recommendation
        };
    }
}
