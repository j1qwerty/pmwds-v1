using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;
namespace PMWDS.Persistence.Repositories;

public class ProjectRepository
 : EfRepository<Project>, IProjectRepository
{
    public ProjectRepository(ApplicationDbContext ctx)
    : base(ctx) { }
    public async Task<Project?> GetWithDetailsAsync(
    Guid projectId, CancellationToken ct = default)
    => await _dbSet
    .Include(p => p.Milestones)
    .ThenInclude(m => m.Tasks)
    .Include(p => p.Tasks)
    .ThenInclude(t => t.Assignments)
    .Include(p => p.Tasks)
    .ThenInclude(t => t.Comments)
    .Include(p => p.Documents)
    .Include(p => p.Department)
    .Include(p => p.ProjectDepartments)
    .ThenInclude(pd => pd.Department)
    .AsSplitQuery()
    .FirstOrDefaultAsync(p => p.Id == projectId, ct);
    public async Task<IEnumerable<Project>>
    GetByDepartmentAsync(
    Guid departmentId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(p => p.DepartmentId == departmentId || p.ProjectDepartments.Any(pd => pd.DepartmentId == departmentId))
    .Include(p => p.Department)
    .Include(p => p.ProjectDepartments)
    .ThenInclude(pd => pd.Department)
    .Include(p => p.Milestones)
    .OrderByDescending(p => p.CreatedDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<Project>>
    GetByManagerAsync(
    Guid managerId,
    CancellationToken ct = default)
    => await _dbSet
    .Where(p => p.ProjectManagerId == managerId)
    .OrderByDescending(p => p.CreatedDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<Project>>
    GetByStatusAsync(
    ProjectStatus status,
    CancellationToken ct = default)
    => await _dbSet
    .Where(p => p.Status == status)
    .ToListAsync(ct);
    public async Task<IEnumerable<Project>>
    GetOverdueProjectsAsync(
    CancellationToken ct = default)
    => await _dbSet
    .Where(p =>
    p.Status == ProjectStatus.InProgress


    && p.PlannedEndDate < DateTime.UtcNow)
    .OrderBy(p => p.PlannedEndDate)
    .ToListAsync(ct);
    public async Task<IEnumerable<Project>>
    GetProjectsWithHighRiskAsync(
    double riskThreshold = 0.7,
    CancellationToken ct = default)
    => await _dbSet
    .Where(p => p.AIDelayRiskScore >= riskThreshold)
    .OrderByDescending(p => p.AIDelayRiskScore)
    .ToListAsync(ct);
    public async Task<double> GetAverageCompletionRateAsync(
    Guid departmentId,
    CancellationToken ct = default)
    {
        var projects = await _dbSet
        .Where(p => p.DepartmentId == departmentId || p.ProjectDepartments.Any(pd => pd.DepartmentId == departmentId))
        .ToListAsync(ct);
        return projects.Any()
        ? projects.Average(p => p.ProgressPercentage)
        : 0;
    }
}
