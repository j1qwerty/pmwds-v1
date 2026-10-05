using Microsoft.ML;
using Microsoft.ML.Data;
using PMWDS.Application.DTOs.AI;
using PMWDS.Domain.Entities;
using PMWDS.Infrastructure.Settings;
using Microsoft.Extensions.Options;
namespace PMWDS.AI.Services;

public interface IDelayPredictionEngine
{
    Task<DelayPredictionDto> PredictAsync(
    ProjectTask task,
    CancellationToken ct = default);


    Task TrainAsync(CancellationToken ct = default);
}
// ML.NET data model
public class TaskDelayInput
{
    [LoadColumn(0)] public float EstimatedHours { get; set; }
    [LoadColumn(1)] public float ActualHours { get; set; }
    [LoadColumn(2)] public float ProgressPercentage { get; set; }
    [LoadColumn(3)] public float DaysUntilDue { get; set; }
    [LoadColumn(4)] public float EscalationLevel { get; set; }
    [LoadColumn(5)] public float AssigneeWorkload { get; set; }
    [LoadColumn(6)] public float AssigneeBurnoutRisk { get; set; }
    [LoadColumn(7)] public float DependencyCount { get; set; }
    [LoadColumn(8)] public bool Label { get; set; }
}
public class TaskDelayPrediction
{
    [ColumnName("PredictedLabel")] public bool WillBeDelayed { get; set; }
    [ColumnName("Probability")] public float Probability { get; set; }
    [ColumnName("Score")] public float Score { get; set; }
}
public class MLDelayPredictionEngine : IDelayPredictionEngine
{
    private readonly MLContext _ml;
    private readonly AISettings _settings;
    private PredictionEngine<TaskDelayInput,
    TaskDelayPrediction>? _predEngine;
    public MLDelayPredictionEngine(
    IOptions<AISettings> settings)
    {
        _ml = new MLContext(seed: 42);
        _settings = settings.Value;
        TryLoadModel();
    }
    private void TryLoadModel()
    {
        if (!string.IsNullOrEmpty(_settings.MLModelPath)
        && File.Exists(_settings.MLModelPath))
        {
            var model = _ml.Model.Load(
            _settings.MLModelPath,
            out _);
            _predEngine =
            _ml.Model.CreatePredictionEngine<
            TaskDelayInput, TaskDelayPrediction>(model);
        }
    }
    public Task<DelayPredictionDto> PredictAsync(
    ProjectTask task,
    CancellationToken ct = default)
    {
        double probability;
        if (_predEngine != null)
        {
            var input = BuildInput(task);
            var pred = _predEngine.Predict(input);
            probability = pred.Probability;
        }
        else
        {
            // Heuristic fallback
            probability = ComputeHeuristicRisk(task);
        }
        var riskLevel = probability switch
        {
            >= 0.8 => "Critical",
            >= 0.6 => "High",
            >= 0.4 => "Medium",
            _ => "Low"
        };
        var expectedDelayDays = (int)(probability * 14);
        var predictedDate = task.DueDate
        .AddDays(expectedDelayDays);
        return Task.FromResult(new DelayPredictionDto(
        TaskId: task.Id,
        DelayProbability: Math.Round(probability, 4),
        ExpectedDelayDays: expectedDelayDays,
        PredictedCompletionDate: predictedDate,
        RiskLevel: riskLevel,
        ContributingFactors: GetContributingFactors(task),
        MitigationStrategies: GetMitigationStrategies(
        probability),
        ShouldEscalate: probability >=
        _settings.RiskThreshold
        ));
    }
    public Task TrainAsync(CancellationToken ct = default)
    {
        // Real implementation: load historical data from DB,
        // build pipeline, train, save model
        // Placeholder for scheduled re-training
 return Task.CompletedTask;
 }
 private static ApplicationUser? GetAssignedUser(
 ProjectTask task)
 => task.Assignments
 .Where(a => a.IsActive)
 .Select(a => a.User)
 .FirstOrDefault(u => u != null);
    private static TaskDelayInput BuildInput(ProjectTask task)
    {
    var assignedUser = GetAssignedUser(task);
    return new()
    {
        EstimatedHours = task.EstimatedHours,
        ActualHours = task.ActualHours,
        ProgressPercentage = (float)task.ProgressPercentage,
        DaysUntilDue =
    (float)(task.DueDate - DateTime.UtcNow)
    .TotalDays,
        EscalationLevel = task.EscalationLevel,
        AssigneeWorkload =
    (float)(assignedUser?
    .AIWorkloadScore ?? 50),
        AssigneeBurnoutRisk =
    (float)(assignedUser?
    .AIBurnoutRiskScore ?? 0.3),
        DependencyCount =
    task.Dependencies?.Count ?? 0
    };
    }
    private static double ComputeHeuristicRisk(ProjectTask task)
    {
        double risk = 0.0;


        var daysLeft = (task.DueDate - DateTime.UtcNow)
        .TotalDays;
        // Overdue → 80%+ risk
        if (daysLeft < 0)
            risk += 0.80;
        else if (daysLeft < 3)
            risk += 0.50;
        else if (daysLeft < 7)
            risk += 0.25;
        // Low progress vs time consumed
        var totalDays = (task.DueDate - task.StartDate)
        .TotalDays;
        if (totalDays > 0)
        {
            var elapsed = (DateTime.UtcNow - task.StartDate)
            .TotalDays;
            var expected = elapsed / totalDays * 100;
            if (task.ProgressPercentage < expected - 20)
                risk += 0.30;
        }
        // Hours exceeded estimate
        if (task.EstimatedHours > 0
        && task.ActualHours > task.EstimatedHours * 0.9)
            risk += 0.15;
        // Escalation already triggered
        if (task.IsEscalated)
            risk += 0.10;
        // Assignee burnout
        var assignedUser = GetAssignedUser(task);
        if (assignedUser?.AIBurnoutRiskScore > 0.7)
            risk += 0.10;
        return Math.Min(1.0, risk);
    }
    private static List<string> GetContributingFactors(
    ProjectTask task)
    {
        var factors = new List<string>();
        var daysLeft = (task.DueDate - DateTime.UtcNow)
        .TotalDays;
        if (daysLeft < 0)
            factors.Add("Task is already past due date.");
        if (task.ProgressPercentage < 30 && daysLeft < 5)
            factors.Add("Low progress with deadline approaching.");
        if (task.ActualHours > task.EstimatedHours)
            factors.Add("Actual hours exceed estimate.");
        if (task.IsEscalated)
            factors.Add("Task has been escalated.");
        if (task.Dependencies?.Any() == true)
            factors.Add(
            $"{task.Dependencies.Count} " +
            $"dependency(ies) may cause blocking.");
        var assignedUser = GetAssignedUser(task);
        if (assignedUser?.AIBurnoutRiskScore > 0.7)
            factors.Add("Assignee shows high burnout risk.");
        if (assignedUser?.AIWorkloadScore > 80)
            factors.Add("Assignee is overloaded.");
        return factors.Any()
        ? factors
        : new List<string> { "No critical risk factors." };
    }
    private static List<string> GetMitigationStrategies(
    double probability)
    {
        var strategies = new List<string>();
        if (probability >= 0.8)
        {
            strategies.Add(
            "Immediately escalate to project manager.");
            strategies.Add(
            "Reassign task to available team member.");
            strategies.Add(
            "Reduce task scope or split into sub-tasks.");
        }
        else if (probability >= 0.6)
        {
            strategies.Add(
            "Schedule daily check-ins on task progress.");
            strategies.Add(
            "Provide additional resources if needed.");
        }
        else if (probability >= 0.4)
        {
            strategies.Add(
            "Monitor closely and send reminder.");
            strategies.Add(
            "Verify dependencies are unblocked.");
        }
        else
        {
            strategies.Add("Continue standard monitoring.");
        }
        return strategies;
    }
}
