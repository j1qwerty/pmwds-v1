using PMWDS.Application.DTOs.AI;
using PMWDS.Domain.Entities;
using System.Text.Json;

namespace PMWDS.AI.Services;

public partial class AIService
{
    private async Task<AIModel> EnsureAllocationModelAsync(CancellationToken ct)
    {
        var model = (await _uow.AIModels.FindAsync(m => m.ModelType == TaskAllocationModelType, ct))
            .OrderByDescending(m => m.LastTrainedDate)
            .FirstOrDefault();
        if (model != null)
        {
            return model;
        }

        model = TaskAllocationModel.Create(
            "Default Task Allocation Model",
            "1.0.0",
            _settings.MLModelPath,
            new Dictionary<string, double> { ["riskThreshold"] = _settings.RiskThreshold },
            new[] { "Availability", "Performance", "Workload", "BurnoutRisk" });
        model.SetCreatedBy("system");
        await _uow.AIModels.AddAsync(model, ct);
        await _uow.SaveChangesAsync(ct);
        return model;
    }

    private async Task<AIModel> EnsureDelayModelAsync(CancellationToken ct)
    {
        var model = (await _uow.AIModels.FindAsync(m => m.ModelType == DelayPredictionModelType, ct))
            .OrderByDescending(m => m.LastTrainedDate)
            .FirstOrDefault();
        if (model != null)
        {
            return model;
        }

        model = DelayPredictionModel.Create(
            "Default Delay Prediction Model",
            "1.0.0",
            _settings.MLModelPath,
            new Dictionary<string, double> { ["riskThreshold"] = _settings.RiskThreshold },
            new[] { "EstimatedHours", "DaysSinceStart", "ProgressPercentage", "DaysUntilDue", "EscalationLevel", "DependencyCount" });
        model.SetCreatedBy("system");
        await _uow.AIModels.AddAsync(model, ct);
        await _uow.SaveChangesAsync(ct);
        return model;
    }

    private static AIModelDto MapModel(AIModel model, int predictionCount)
        => new(
            model.Id,
            model.Name,
            model.Version,
            model.ModelType,
            model.CreatedDate,
            model.LastTrainedDate,
            model.AccuracyScore,
            model.PrecisionScore,
            model.RecallScore,
            model.ModelPath,
            model.GetHyperparameters().ToDictionary(x => x.Key, x => x.Value),
            model.GetFeatures().ToList(),
            predictionCount);

    private static TrainingDataPointDto MapTrainingDataPoint(TrainingDataPoint dataPoint)
        => new(
            dataPoint.Id,
            dataPoint.DataType,
            DeserializeObjectDictionary(dataPoint.FeaturesJson),
            DeserializeObjectDictionary(dataPoint.LabelsJson),
            dataPoint.CreatedDate,
            dataPoint.Source);

    private static PredictionResultDto MapPredictionResult(PredictionResult result)
        => new(
            result.Id,
            result.ModelId,
            result.TaskId,
            result.PredictionDate,
            DeserializeObjectDictionary(result.InputFeaturesJson),
            DeserializeObjectDictionary(result.OutputPredictionsJson),
            result.ConfidenceScore,
            result.Recommendation);

    private static AllocationRecommendationRecordDto MapAllocationRecommendation(AllocationRecommendation recommendation)
        => new(
            recommendation.Id,
            recommendation.TaskId,
            recommendation.ModelId,
            recommendation.RecommendedUserId.ToString(),
            recommendation.MatchScore,
            DeserializeList(recommendation.RationaleJson),
            DeserializeDoubleDictionary(recommendation.FeatureScoresJson),
            JsonSerializer.Deserialize<List<AlternativeAssignee>>(recommendation.AlternativesJson) ?? new List<AlternativeAssignee>(),
            recommendation.Status,
            recommendation.DecisionReason,
            recommendation.CreatedDate);

    private static DelayPredictionRecordDto MapDelayPrediction(DelayPrediction prediction)
    {
        var factors = DeserializeList(prediction.ContributingFactorsJson);
        return new DelayPredictionRecordDto(
            prediction.Id,
            prediction.TaskId,
            prediction.ModelId,
            prediction.DelayProbability,
            prediction.ExpectedDelayDays,
            prediction.PredictedCompletionDate,
            GetRiskLevel(prediction.DelayProbability),
            factors,
            DeserializeDoubleDictionary(prediction.FactorWeightsJson),
            GetMitigationStrategies(prediction.DelayProbability),
            prediction.DelayProbability >= 0.7,
            prediction.CreatedDate);
    }

    private static AssigneeRecommendationDto ToAssigneeRecommendationDto(AllocationRecommendationRecordDto record)
        => new(
            record.TaskId,
            record.RecommendedUserId,
            string.Empty,
            record.MatchScore,
            record.Rationale,
            record.Alternatives,
            record.FeatureScores,
            record.CreatedDate);

    private static Dictionary<string, object?> BuildRecommendationInput(ProjectTask task, int candidateCount)
        => new()
        {
            ["taskId"] = task.Id,
            ["priority"] = task.Priority.ToString(),
            ["estimatedHours"] = task.EstimatedHours,
            ["daysSinceStart"] = (DateTime.UtcNow - task.StartDate).TotalDays,
            ["progressPercentage"] = task.ProgressPercentage,
            ["dependencyCount"] = task.Dependencies.Count,
            ["candidateCount"] = candidateCount
        };

    private static Dictionary<string, object?> BuildDelayInput(ProjectTask task)
        => new()
        {
            ["taskId"] = task.Id,
            ["estimatedHours"] = task.EstimatedHours,
            ["daysSinceStart"] = (DateTime.UtcNow - task.StartDate).TotalDays,
            ["progressPercentage"] = task.ProgressPercentage,
            ["daysUntilDue"] = (task.DueDate - DateTime.UtcNow).TotalDays,
            ["dependencyCount"] = task.Dependencies.Count,
            ["escalationLevel"] = task.EscalationLevel
        };

    private static Dictionary<string, double> BuildFactorWeights(IEnumerable<string> factors)
    {
        var factorList = factors.ToList();
        if (!factorList.Any())
        {
            return new Dictionary<string, double>();
        }

        var weight = Math.Round(1d / factorList.Count, 4);
        return factorList.ToDictionary(f => f, _ => weight);
    }

    private static string GetRiskLevel(double probability)
        => probability switch
        {
            >= 0.8 => "Critical",
            >= 0.6 => "High",
            >= 0.4 => "Medium",
            _ => "Low"
        };

    private static List<string> GetMitigationStrategies(double probability)
        => probability switch
        {
            >= 0.8 => new List<string> { "Immediately escalate to project manager.", "Reassign task to available team member.", "Reduce task scope or split into sub-tasks." },
            >= 0.6 => new List<string> { "Schedule daily check-ins on task progress.", "Provide additional resources if needed." },
            >= 0.4 => new List<string> { "Monitor closely and send reminder.", "Verify dependencies are unblocked." },
            _ => new List<string> { "Continue standard monitoring." }
        };

    private static List<string> GetRecommendations(double health, double delayRisk, double budgetRisk)
    {
        var recommendations = new List<string>();
        if (health < 50)
        {
            recommendations.Add("Conduct immediate project review meeting.");
        }
        if (delayRisk > 0.5)
        {
            recommendations.Add("Consider adding resources or adjusting scope.");
        }
        if (budgetRisk > 0.9)
        {
            recommendations.Add("Escalate budget overrun to executive sponsor.");
        }

        return recommendations;
    }

    private static List<RiskItem> BuildRiskFactors(Project project, int overdue, int highRisk)
    {
        var risks = new List<RiskItem>();
        if (overdue > 0)
        {
            risks.Add(new RiskItem("Overdue Tasks", "Tasks are running past due dates.", overdue * 0.1, "High", "Reassign or reprioritize overdue tasks."));
        }
        if (highRisk > 0)
        {
            risks.Add(new RiskItem("High-Risk Tasks", "Several tasks exceed the configured AI risk threshold.", highRisk * 0.05, "Medium", "Monitor closely and provide support."));
        }
        if (project.IsOverBudget())
        {
            risks.Add(new RiskItem("Budget Overrun", "Project spend is above the planned budget.", 0.3, "High", "Review and control spending immediately."));
        }

        return risks;
    }

    private static double NormalizeScore(double confidenceScore)
        => confidenceScore > 1 ? Math.Round(confidenceScore / 100d, 4) : Math.Round(confidenceScore, 4);

    private static List<string> DeserializeList(string json)
        => JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();

    private static Dictionary<string, double> DeserializeDoubleDictionary(string json)
        => JsonSerializer.Deserialize<Dictionary<string, double>>(json) ?? new Dictionary<string, double>();

    private static Dictionary<string, object?> DeserializeObjectDictionary(string json)
        => JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? new Dictionary<string, object?>();
}
