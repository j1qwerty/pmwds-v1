using PMWDS.Application.DTOs.AI;

namespace PMWDS.Application.Interfaces.Services;

public interface IRecommendationService
{
    Task<AssigneeRecommendationDto> GetOptimalAssigneeAsync(Guid taskId, CancellationToken ct = default);
    Task<AllocationRecommendationRecordDto> GenerateRecommendationAsync(Guid taskId, CancellationToken ct = default);
    Task<IReadOnlyList<AllocationRecommendationRecordDto>> GetRecommendationHistoryAsync(Guid taskId, CancellationToken ct = default);
    Task<AllocationRecommendationRecordDto> AcceptRecommendationAsync(Guid recommendationId, CancellationToken ct = default);
    Task<AllocationRecommendationRecordDto> RejectRecommendationAsync(Guid recommendationId, string reason, CancellationToken ct = default);
    Task<string> ExplainRecommendationAsync(Guid recommendationId, CancellationToken ct = default);
    Task<TaskAnalysisDto> AnalyzeTaskForAllocationAsync(Guid taskId, CancellationToken ct = default);
}
