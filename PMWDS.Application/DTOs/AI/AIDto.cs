namespace PMWDS.Application.DTOs.AI;

public record AssigneeRecommendationDto(
 Guid TaskId,
 string RecommendedUserId,
 string RecommendedUserName,
 double ConfidenceScore,
 List<string> Rationale,
 List<AlternativeAssignee> Alternatives,
 Dictionary<string, double> FeatureScores,
 DateTime GeneratedAt);

public record AlternativeAssignee(
 string UserId,
 string UserName,
 double Score,
 string Reason);

public record DelayPredictionDto(
 Guid TaskId,
 double DelayProbability,
 int ExpectedDelayDays,
 DateTime? PredictedCompletionDate,
 string RiskLevel,
 List<string> ContributingFactors,
 List<string> MitigationStrategies,
 bool ShouldEscalate);

public record ProjectHealthDto(
 Guid ProjectId,
 string ProjectName,
 double OverallHealthScore,
 double ScheduleHealth,
 double BudgetHealth,
 double TeamHealth,
 double QualityHealth,
 string HealthStatus,
 List<string> Strengths,
 List<string> Weaknesses,
 List<string> Recommendations,
 List<RiskItem> Risks,
 DateTime GeneratedAt);

public record RiskItem(
 string Category,
 string Description,
 double Probability,
 string Severity,
 string MitigationStrategy);

public record ChatResponseDto(
 string Message,
 string Intent,
 List<string> SuggestedActions,
 object? ContextData,
 bool RequiresConfirmation);

public record AIProviderInfoDto(
 string Provider,
 string DisplayName,
 bool IsEnabled,
 bool IsConfigured,
 string DefaultModel,
 string BaseUrl);

public record AIModelInfoDto(
 string Provider,
 string Id,
 string Name,
 int? ContextLength,
 string? Description);

public record AIProviderTestResultDto(
 string Provider,
 string Model,
 bool Success,
 string Message,
 string? RawResponse,
 DateTime ExecutedAtUtc);

public record BurnoutRiskDto(
 string UserId,
 string FullName,
 double BurnoutRisk,
 double WorkloadScore,
 int ActiveTasks,
 string RiskLevel,
 List<string> Recommendations);

public record ResourceOptimizationDto(
 Guid ProjectId,
 List<ReallocationSuggestion> Suggestions,
 double ExpectedEfficiencyGain,
 int TasksAtRisk,
 List<string> ActionPlan,
 DateTime GeneratedAt);

public record ReallocationSuggestion(
 Guid TaskId,
 string TaskTitle,
 string CurrentAssigneeId,
 string CurrentAssigneeName,
 string SuggestedAssigneeId,
 string SuggestedAssigneeName,
 string Reason,
 double ImprovementScore);

public record AIModelDto(
 Guid Id,
 string Name,
 string Version,
 string ModelType,
 DateTime CreatedDate,
 DateTime? LastTrainedDate,
 double AccuracyScore,
 double PrecisionScore,
 double RecallScore,
 string? ModelPath,
 Dictionary<string, double> Hyperparameters,
 List<string> Features,
 int PredictionCount);

public record UpsertAIModelDto(
 string Name,
 string Version,
 string ModelType,
 string? ModelPath,
 Dictionary<string, double> Hyperparameters,
 List<string> Features,
 double AccuracyScore = 0,
 double PrecisionScore = 0,
 double RecallScore = 0);

public record TrainingDataPointDto(
 Guid Id,
 string DataType,
 Dictionary<string, object?> Features,
 Dictionary<string, object?> Labels,
 DateTime CreatedDate,
 string Source);

public record CreateTrainingDataPointDto(
 string DataType,
 Dictionary<string, object?> Features,
 Dictionary<string, object?> Labels,
 string Source);

public record AllocationRecommendationRecordDto(
 Guid Id,
 Guid TaskId,
 Guid ModelId,
 string RecommendedUserId,
 double MatchScore,
 List<string> Rationale,
 Dictionary<string, double> FeatureScores,
 List<AlternativeAssignee> Alternatives,
 string Status,
 string? DecisionReason,
 DateTime CreatedDate);

public record DelayPredictionRecordDto(
 Guid Id,
 Guid TaskId,
 Guid ModelId,
 double DelayProbability,
 int ExpectedDelayDays,
 DateTime? PredictedCompletionDate,
 string RiskLevel,
 List<string> ContributingFactors,
 Dictionary<string, double> FactorWeights,
 List<string> MitigationStrategies,
 bool ShouldEscalate,
 DateTime CreatedDate);

public record PredictionResultDto(
 Guid Id,
 Guid ModelId,
 Guid? TaskId,
 DateTime PredictionDate,
 Dictionary<string, object?> InputFeatures,
 Dictionary<string, object?> OutputPredictions,
 double ConfidenceScore,
 string Recommendation);

public record TaskAnalysisDto(
 Guid TaskId,
 string TaskTitle,
 int CandidateCount,
 string Summary,
 Dictionary<string, object?> InputFeatures,
 List<string> KeyFactors,
 DateTime GeneratedAt);
