using PMWDS.Application.DTOs.AI;

namespace PMWDS.Application.Interfaces.Services;

public interface IModelManagementService
{
    Task<IReadOnlyList<AIModelDto>> GetModelsAsync(string? modelType = null, CancellationToken ct = default);
    Task<AIModelDto?> GetModelByIdAsync(Guid modelId, CancellationToken ct = default);
    Task<AIModelDto> UpsertModelAsync(Guid? modelId, UpsertAIModelDto dto, CancellationToken ct = default);
    Task DeleteModelAsync(Guid modelId, CancellationToken ct = default);
    Task<IReadOnlyList<TrainingDataPointDto>> GetTrainingDataAsync(string? dataType = null, CancellationToken ct = default);
    Task<TrainingDataPointDto> AddTrainingDataPointAsync(CreateTrainingDataPointDto dto, CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, double>> GetModelPerformanceAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AIProviderInfoDto>> GetProvidersAsync(CancellationToken ct = default);
    Task<IReadOnlyList<AIModelInfoDto>> SearchModelsAsync(string provider, string? search = null, int limit = 25, CancellationToken ct = default);
    Task<AIProviderTestResultDto> TestProviderAsync(string provider, string? model = null, string? prompt = null, CancellationToken ct = default);
    Task TrainModelsAsync(CancellationToken ct = default);
}
