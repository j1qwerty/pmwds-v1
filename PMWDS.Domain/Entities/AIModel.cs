using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public abstract class AIModel : AuditableEntity
{
    public string Name { get; protected set; } = string.Empty;
    public string Version { get; protected set; } = string.Empty;
    public string ModelType { get; protected set; } = string.Empty;
    public DateTime? LastTrainedDate { get; protected set; }
    public double AccuracyScore { get; protected set; }
    public double PrecisionScore { get; protected set; }
    public double RecallScore { get; protected set; }
    public string? ModelPath { get; protected set; }
    public string HyperparametersJson { get; protected set; } = "{}";
    public string FeaturesJson { get; protected set; } = "[]";

    public ICollection<PredictionResult> PredictionResults { get; private set; } = new List<PredictionResult>();

    protected void Initialize(
        string name,
        string version,
        string modelType,
        string? modelPath,
        IDictionary<string, double>? hyperparameters,
        IEnumerable<string>? features)
    {
        Name = name.Trim();
        Version = version.Trim();
        ModelType = modelType.Trim();
        ModelPath = modelPath?.Trim();
        HyperparametersJson = JsonSerializer.Serialize(hyperparameters ?? new Dictionary<string, double>());
        FeaturesJson = JsonSerializer.Serialize(features ?? Enumerable.Empty<string>());
    }

    public void UpdateMetadata(
        string name,
        string version,
        string? modelPath,
        IDictionary<string, double>? hyperparameters,
        IEnumerable<string>? features)
    {
        Name = name.Trim();
        Version = version.Trim();
        ModelPath = modelPath?.Trim();
        HyperparametersJson = JsonSerializer.Serialize(hyperparameters ?? new Dictionary<string, double>());
        FeaturesJson = JsonSerializer.Serialize(features ?? Enumerable.Empty<string>());
    }

    public void UpdateMetrics(double accuracyScore, double precisionScore, double recallScore)
    {
        AccuracyScore = Math.Clamp(accuracyScore, 0, 1);
        PrecisionScore = Math.Clamp(precisionScore, 0, 1);
        RecallScore = Math.Clamp(recallScore, 0, 1);
        LastTrainedDate = DateTime.UtcNow;
    }

    public IReadOnlyDictionary<string, double> GetHyperparameters()
        => JsonSerializer.Deserialize<Dictionary<string, double>>(HyperparametersJson) ?? new Dictionary<string, double>();

    public IReadOnlyList<string> GetFeatures()
        => JsonSerializer.Deserialize<List<string>>(FeaturesJson) ?? new List<string>();
}
