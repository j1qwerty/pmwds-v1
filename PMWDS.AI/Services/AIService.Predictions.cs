using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Exceptions;
using PMWDS.Domain.Entities;
using System.Text.Json;

namespace PMWDS.AI.Services;

public partial class AIService
{
    public async Task<DelayPredictionDto> PredictTaskDelayAsync(Guid taskId, CancellationToken ct = default)
    {
        try
        {
            var record = await GenerateDelayPredictionAsync(taskId, ct);
            return new DelayPredictionDto(
                record.TaskId,
                record.DelayProbability,
                record.ExpectedDelayDays,
                record.PredictedCompletionDate,
                record.RiskLevel,
                record.ContributingFactors,
                record.MitigationStrategies,
                record.ShouldEscalate);
        }
        catch
        {
            return new DelayPredictionDto(taskId, 0, 0, null, "Low", new List<string>(), new List<string>(), false);
        }
    }

    public async Task<DelayPredictionRecordDto> GenerateDelayPredictionAsync(Guid taskId, CancellationToken ct = default)
    {
        var task = await _uow.Tasks.GetWithDetailsAsync(taskId, ct)
            ?? throw new NotFoundException("Task", taskId);
        var model = await EnsureDelayModelAsync(ct);
        var prediction = await _delay.PredictAsync(task, ct);
        var factorWeights = BuildFactorWeights(prediction.ContributingFactors);

        var entity = DelayPrediction.Create(
            taskId,
            model.Id,
            prediction.DelayProbability,
            prediction.ExpectedDelayDays,
            prediction.PredictedCompletionDate,
            prediction.ContributingFactors,
            factorWeights);
        entity.SetCreatedBy("system");
        await _uow.DelayPredictions.AddAsync(entity, ct);

        var predictionResult = PredictionResult.Create(
            model.Id,
            taskId,
            BuildDelayInput(task),
            new Dictionary<string, object?>
            {
                ["delayProbability"] = prediction.DelayProbability,
                ["expectedDelayDays"] = prediction.ExpectedDelayDays,
                ["predictedCompletionDate"] = prediction.PredictedCompletionDate,
                ["riskLevel"] = prediction.RiskLevel
            },
            prediction.DelayProbability,
            prediction.MitigationStrategies.FirstOrDefault() ?? "AI-generated delay prediction.");
        predictionResult.SetCreatedBy("system");
        await _uow.PredictionResults.AddAsync(predictionResult, ct);

        task.UpdateAIPrediction(
            prediction.DelayProbability,
            prediction.PredictedCompletionDate ?? DateTime.UtcNow.AddDays(prediction.ExpectedDelayDays),
            JsonSerializer.Serialize(prediction.ContributingFactors),
            task.AIRecommendedAssigneeId);
        await _uow.Tasks.UpdateAsync(task, ct);
        await _uow.SaveChangesAsync(ct);

        return MapDelayPrediction(entity);
    }

    public async Task<IReadOnlyList<DelayPredictionRecordDto>> GetPredictionHistoryAsync(Guid taskId, CancellationToken ct = default)
    {
        var records = await _uow.DelayPredictions.FindAsync(p => p.TaskId == taskId, ct);
        return records.OrderByDescending(p => p.CreatedDate).Select(MapDelayPrediction).ToList();
    }

    public async Task<IReadOnlyList<DelayPredictionRecordDto>> PredictProjectDelaysAsync(Guid projectId, CancellationToken ct = default)
    {
        var tasks = await _uow.Tasks.GetByProjectAsync(projectId, ct);
        var activeTasks = tasks
            .Where(t => t.Status != PMWDS.Domain.Enums.TaskStatus.Completed && t.Status != PMWDS.Domain.Enums.TaskStatus.Cancelled)
            .ToList();

        var results = new List<DelayPredictionRecordDto>();
        foreach (var task in activeTasks)
        {
            results.Add(await GenerateDelayPredictionAsync(task.Id, ct));
        }

        return results;
    }
}
