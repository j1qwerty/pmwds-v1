using PMWDS.Application.DTOs.AI;

namespace PMWDS.Application.Interfaces.Services;

public interface IProjectHealthService
{
    Task<ProjectHealthDto> AnalyzeProjectHealthAsync(Guid projectId, CancellationToken ct = default);
    Task<List<string>> GenerateProjectInsightsAsync(Guid projectId, CancellationToken ct = default);
    Task<ResourceOptimizationDto> OptimizeResourceAllocationAsync(Guid projectId, CancellationToken ct = default);
    Task<string> GenerateStructuredReportAsync(string systemPrompt, string userContext, CancellationToken ct = default);
}
