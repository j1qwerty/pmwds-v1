using PMWDS.Domain.Entities;
namespace PMWDS.Application.Interfaces.Repositories;

public interface IUserRepository : IRepository<ApplicationUser>
{
    Task<ApplicationUser?> GetByEmailAsync(string email,
    CancellationToken ct = default);
    Task<ApplicationUser?> GetByIdWithSkillsAsync(
    Guid userId, CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetByDepartmentAsync(
    Guid departmentId,
    CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetAllWithSkillsAsync(
    CancellationToken ct = default);
    Task<IEnumerable<ApplicationUser>> GetByDepartmentWithSkillsAsync(
    Guid departmentId,
    CancellationToken ct = default);
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
}
