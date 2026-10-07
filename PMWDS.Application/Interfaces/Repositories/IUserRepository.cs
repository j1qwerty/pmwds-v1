using PMWDS.Domain.Entities;
namespace PMWDS.Application.Interfaces.Repositories;

public interface IUserRepository : IRepository<ApplicationUser>
{
    Task<ApplicationUser?> GetByEmailAsync(string email,
    CancellationToken ct = default);
    Task<ApplicationUser?> GetByIdWithSkillsAsync(
    Guid userId, CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetByDepartmentAsync(
    Guid departmentId, CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetAllWithSkillsAsync(
    CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetByDepartmentWithSkillsAsync(
    Guid departmentId, CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetAvailableUsersAsync(
    CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetUsersBySkillAsync(
    Guid skillId, int minProficiency = 1,
    CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetUsersByRoleAsync(
    string roleName,
    CancellationToken ct = default);
    Task<double> GetUserWorkloadScoreAsync(string userId,
    CancellationToken ct = default);

    /// <summary>
    /// Returns live workload inputs from current task data. This intentionally bypasses the
    /// persisted AI score fields so AI fallbacks never surface stale training output.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, (int ActiveTasks, int OverdueTasks, double EstimatedHours)>>
        GetLiveWorkloadAsync(Guid? departmentId = null, CancellationToken ct = default);
}
