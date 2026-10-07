using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Repositories;

public class UserRepository : EfRepository<ApplicationUser>, IUserRepository
{
    public UserRepository(ApplicationDbContext ctx)
        : base(ctx)
    {
    }

    public override async Task<ApplicationUser?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .FirstOrDefaultAsync(u => u.Id == id, ct);

    public override async Task<IEnumerable<ApplicationUser>> GetAllAsync(CancellationToken ct = default)
        => await IncludeIdentityGraph().ToListAsync(ct);

    public async Task<ApplicationUser?> GetByEmailAsync(
        string email,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .FirstOrDefaultAsync(u => u.Email == email.ToLower(), ct);

    public async Task<ApplicationUser?> GetByIdWithSkillsAsync(
        Guid userId,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Include(u => u.Skills)
            .ThenInclude(s => s.Skill)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

    public async Task<IEnumerable<ApplicationUser>> GetByDepartmentAsync(
        Guid departmentId,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Where(u => (u.DepartmentId == departmentId ||
                         u.DepartmentAssignments.Any(d => d.DepartmentId == departmentId)) &&
                        u.IsActive)
            .ToListAsync(ct);

    public async Task<IEnumerable<ApplicationUser>> GetAllWithSkillsAsync(
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Include(u => u.Skills)
            .ThenInclude(s => s.Skill)
            .ToListAsync(ct);

    public async Task<IEnumerable<ApplicationUser>> GetByDepartmentWithSkillsAsync(
        Guid departmentId,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Where(u => (u.DepartmentId == departmentId ||
                         u.DepartmentAssignments.Any(d => d.DepartmentId == departmentId)) &&
                        u.IsActive)
            .Include(u => u.Skills)
            .ThenInclude(s => s.Skill)
            .ToListAsync(ct);

    public async Task<IEnumerable<ApplicationUser>> GetAvailableUsersAsync(
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Where(u => u.IsActive &&
                        u.AvailabilityStatus == Domain.Enums.AvailabilityStatus.Available)
            .Include(u => u.Skills)
            .ThenInclude(s => s.Skill)
            .ToListAsync(ct);

    public async Task<IEnumerable<ApplicationUser>> GetUsersBySkillAsync(
        Guid skillId,
        int minProficiency = 1,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Where(u => u.IsActive &&
                        u.Skills.Any(s => s.SkillId == skillId && s.ProficiencyLevel >= minProficiency))
            .Include(u => u.Skills)
            .ToListAsync(ct);

    public async Task<IEnumerable<ApplicationUser>> GetUsersByRoleAsync(
        string roleName,
        CancellationToken ct = default)
        => await IncludeIdentityGraph()
            .Where(u => u.Roles.Any(r => r.Name == roleName))
            .ToListAsync(ct);

    public async Task<double> GetUserWorkloadScoreAsync(
        string userId,
        CancellationToken ct = default)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return 0;
        }

        var user = await _dbSet.FirstOrDefaultAsync(u => u.Id == parsedUserId, ct);
        return user?.AIWorkloadScore ?? 0;
    }

    public async Task<IReadOnlyDictionary<Guid, (int ActiveTasks, int OverdueTasks, double EstimatedHours)>>
        GetLiveWorkloadAsync(Guid? departmentId = null, CancellationToken ct = default)
    {
        var userQuery = _dbSet
            .AsNoTracking()
            .Where(user => user.IsActive);

        if (departmentId.HasValue)
        {
            userQuery = userQuery.Where(user =>
                user.DepartmentId == departmentId.Value ||
                user.DepartmentAssignments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        var userIds = await userQuery
            .Select(user => user.Id)
            .ToListAsync(ct);

        if (userIds.Count == 0)
        {
            return new Dictionary<Guid, (int, int, double)>();
        }

        var activeStatuses = new[]
        {
            Domain.Enums.TaskStatus.NotStarted,
            Domain.Enums.TaskStatus.InProgress,
            Domain.Enums.TaskStatus.OnHold,
            Domain.Enums.TaskStatus.Delayed
        };

        var now = DateTime.UtcNow;

        var directTasks = await _context.Tasks
            .AsNoTracking()
            .Where(task =>
                task.AssignedToUserId.HasValue &&
                userIds.Contains(task.AssignedToUserId.Value) &&
                activeStatuses.Contains(task.Status))
            .Select(task => new
            {
                UserId = task.AssignedToUserId!.Value,
                TaskId = task.Id,
                task.DueDate,
                task.EstimatedHours
            })
            .ToListAsync(ct);

        var additionalAssignments = await _context.TaskAssignments
            .AsNoTracking()
            .Where(assignment =>
                assignment.IsActive &&
                userIds.Contains(assignment.UserId))
            .Join(
                _context.Tasks.AsNoTracking().Where(task => activeStatuses.Contains(task.Status)),
                assignment => assignment.TaskId,
                task => task.Id,
                (assignment, task) => new
                {
                    assignment.UserId,
                    TaskId = task.Id,
                    task.DueDate,
                    task.EstimatedHours
                })
            .ToListAsync(ct);

        var rows = directTasks
            .Concat(additionalAssignments)
            .GroupBy(row => new { row.UserId, row.TaskId })
            .Select(group => group.First())
            .GroupBy(row => row.UserId)
            .ToDictionary(
                group => group.Key,
                group => (
                    ActiveTasks: group.Count(),
                    OverdueTasks: group.Count(row => row.DueDate < now),
                    EstimatedHours: group.Sum(row => (double)Math.Max(0, row.EstimatedHours))));

        return userIds.ToDictionary(
            userId => userId,
            userId => rows.GetValueOrDefault(userId, (0, 0, 0d)));
    }

    private IQueryable<ApplicationUser> IncludeIdentityGraph()
        => _dbSet
            .Include(u => u.Department)
            .Include(u => u.DepartmentAssignments)
            .ThenInclude(d => d.Department)
            .ThenInclude(d => d!.Organization)
            .Include(u => u.Profile)
            .Include(u => u.Roles)
            .ThenInclude(r => r.Permissions);
}
