using PMWDS.Application.DTOs.AI;

namespace PMWDS.Application.Interfaces.Services;

public interface IPredictionService
{
    Task<DelayPredictionDto> PredictTaskDelayAsync(Guid taskId, CancellationToken ct = default);
    Task<DelayPredictionRecordDto> GenerateDelayPredictionAsync(Guid taskId, CancellationToken ct = default);
    Task<IReadOnlyList<DelayPredictionRecordDto>> GetPredictionHistoryAsync(Guid taskId, CancellationToken ct = default);
    Task<IReadOnlyList<DelayPredictionRecordDto>> PredictProjectDelaysAsync(Guid projectId, CancellationToken ct = default);
    Task<IReadOnlyList<PredictionResultDto>> GetPredictionResultsAsync(Guid? taskId = null, Guid? modelId = null, CancellationToken ct = default);
}
