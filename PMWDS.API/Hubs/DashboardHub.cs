using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PMWDS.API.Services;
using System.Security.Claims;

namespace PMWDS.API.Hubs;

[Authorize]
public class DashboardHub : Hub
{
    private readonly RoleScopeService _scope;

    public DashboardHub(RoleScopeService scope)
    {
        _scope = scope;
    }

    public override async Task OnConnectedAsync()
    {
        var deptId = Context.User?
            .FindFirstValue("DepartmentId");

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            "dashboard-global");

        if (!string.IsNullOrEmpty(deptId))
        {
            await Groups.AddToGroupAsync(
                Context.ConnectionId,
                $"dashboard-dept-{deptId}");
        }

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Client subscribes to a specific project's live updates.
    /// The same project-access rule used by REST endpoints is enforced here so
    /// a client cannot join another project's invalidation group.
    /// </summary>
    public async Task SubscribeToProject(string projectId)
    {
        if (!Guid.TryParse(projectId, out var parsedProjectId) ||
            !await _scope.CanAccessProjectAsync(parsedProjectId, Context.ConnectionAborted))
        {
            throw new HubException("You do not have access to this project.");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId,
            $"project-{parsedProjectId}");
    }

    /// <summary>Unsubscribe from project updates.</summary>
    public async Task UnsubscribeFromProject(string projectId)
    {
        if (!Guid.TryParse(projectId, out var parsedProjectId))
        {
            return;
        }

        await Groups.RemoveFromGroupAsync(
            Context.ConnectionId,
            $"project-{parsedProjectId}");
    }
}
