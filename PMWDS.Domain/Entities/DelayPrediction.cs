using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class DelayPrediction : AuditableEntity
{
    public Guid TaskId { get; private set; }
    public Guid ModelId { get; private set; }
    public double DelayProbability { get; private set; }
    public int ExpectedDelayDays { get; private set; }
    public DateTime? PredictedCompletionDate { get; private set; }
    public string ContributingFactorsJson { get; private set; } = "[]";
    public string FactorWeightsJson { get; private set; } = "{}";

    public ProjectTask? Task { get; private set; }
    public AIModel? Model { get; private set; }

    protected DelayPrediction() { }

    public static DelayPrediction Create(
        Guid taskId,
        Guid modelId,
        double delayProbability,
        int expectedDelayDays,
        DateTime? predictedCompletionDate,
        IEnumerable<string>? contributingFactors,
        IDictionary<string, double>? factorWeights)
    {
        return new DelayPrediction
        {
            TaskId = taskId,
            ModelId = modelId,
            DelayProbability = Math.Clamp(delayProbability, 0, 1),
            ExpectedDelayDays = expectedDelayDays,
            PredictedCompletionDate = predictedCompletionDate,
            ContributingFactorsJson = JsonSerializer.Serialize(contributingFactors ?? Enumerable.Empty<string>()),
            FactorWeightsJson = JsonSerializer.Serialize(factorWeights ?? new Dictionary<string, double>())
        };
    }
}
