using PMWDS.Application.DTOs.Controllers;
using PMWDS.Domain.Entities;

namespace PMWDS.Application.Interfaces.Services;

public interface ITaskWorkflowService
{
    Task RecalculateTaskMilestoneAsync(ProjectTask task, CancellationToken ct);
    Task ApplyStatusChangeAsync(ProjectTask task, UpdateTaskStatusRequest req, CancellationToken ct);
    Task<bool> CanAccessTaskAsync(Guid taskId, CancellationToken ct);
    Task<bool> CanManageTaskAsync(Guid taskId, CancellationToken ct);
    Task<bool> CanWorkOnTaskAsync(Guid taskId, CancellationToken ct);
    Task<HashSet<Guid>> GetAccessibleProjectIdsAsync(CancellationToken ct);
    Task<bool> IsUserInProjectOrganizationAsync(string userId, Guid projectId, CancellationToken ct);
    Task<string> ResolveProjectNameAsync(Guid projectId, CancellationToken ct);
}
