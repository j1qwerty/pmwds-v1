using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
namespace PMWDS.Application.Interfaces.Repositories;

public interface IProjectRepository : IRepository<Project>
{
    Task<Project?> GetWithDetailsAsync(Guid projectId,
    CancellationToken ct = default);
    Task<IEnumerable<Project>> GetByDepartmentAsync(
    Guid departmentId,
    CancellationToken ct = default);
    Task<IEnumerable<Project>> GetByManagerAsync(
    Guid managerId,
    CancellationToken ct = default);
    Task<IEnumerable<Project>> GetByStatusAsync(
    ProjectStatus status,
    CancellationToken ct = default);
    Task<IEnumerable<Project>> GetOverdueProjectsAsync(
    CancellationToken ct = default);
    Task<IEnumerable<Project>> GetProjectsWithHighRiskAsync(
    double riskThreshold = 0.7,
    CancellationToken ct = default);
    Task<double> GetAverageCompletionRateAsync(
    Guid departmentId,
    CancellationToken ct = default);
}
