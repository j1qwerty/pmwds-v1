using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
namespace PMWDS.API.Hubs;

[Authorize]
public class DashboardHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var deptId = Context.User?
        .FindFirstValue("DepartmentId");
        if (!string.IsNullOrEmpty(deptId))
            await Groups.AddToGroupAsync(
            Context.ConnectionId,
            $"dashboard-dept-{deptId}");
        await base.OnConnectedAsync();
    }
    /// <summary>
    /// Client subscribes to a specific project's live updates
    /// </summary>
    public async Task SubscribeToProject(string projectId)
    => await Groups.AddToGroupAsync(
    Context.ConnectionId,
    $"project-{projectId}");
    /// <summary>Unsubscribe from project updates</summary>
    public async Task UnsubscribeFromProject(string projectId)
    => await Groups.RemoveFromGroupAsync(
    Context.ConnectionId,
    $"project-{projectId}");
}