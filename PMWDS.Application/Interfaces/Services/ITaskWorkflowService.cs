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

    /// <summary>
    /// Whether the caller may add a subtask under <paramref name="parentTaskId"/>.
    /// Department-scoped against the Subtask permission family.
    /// </summary>
    Task<bool> CanCreateSubtaskAsync(Guid parentTaskId, CancellationToken ct);

    /// <summary>
    /// Whether the caller may edit <paramref name="subtaskId"/>'s own fields (title,
    /// priority, dates, assignment). Department-scoped against the Subtask permission
    /// family.
    /// </summary>
    Task<bool> CanModifySubtaskAsync(Guid subtaskId, CancellationToken ct);

    /// <summary>
    /// Whether the caller may record progress/status against <paramref name="subtaskId"/>.
    /// True for a holder of the Subtask edit permission inside the owning department, or
    /// for someone assigned to the subtask *or to its parent task*.
    /// </summary>
    Task<bool> CanWorkOnSubtaskAsync(Guid subtaskId, CancellationToken ct);

    Task<HashSet<Guid>> GetAccessibleProjectIdsAsync(CancellationToken ct);
    Task<bool> IsUserInProjectOrganizationAsync(string userId, Guid projectId, CancellationToken ct);
    Task<string> ResolveProjectNameAsync(Guid projectId, CancellationToken ct);
}
