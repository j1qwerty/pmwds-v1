using Microsoft.AspNetCore.SignalR;
using PMWDS.API.Hubs;
using PMWDS.Application.Interfaces.Services;

namespace PMWDS.API.Services;

/// <summary>Payload of the <c>DataChanged</c> hub event.</summary>
public sealed record DataChangedNotification(
    string Scope,
    string? EntityId,
    Guid? ProjectId,
    DateTime OccurredAt);

/// <summary>
/// Publishes data-change hints over the existing <see cref="DashboardHub"/>.
/// </summary>
/// <remarks>
/// Lives in the API project rather than Infrastructure because it depends on
/// <c>IHubContext&lt;DashboardHub&gt;</c> and the hub itself, and Infrastructure cannot
/// reference the API.
/// </remarks>
public class DataChangeNotifier : IDataChangeNotifier
{
    private readonly IHubContext<DashboardHub> _hub;
    private readonly ILogger<DataChangeNotifier> _logger;

    public DataChangeNotifier(
        IHubContext<DashboardHub> hub,
        ILogger<DataChangeNotifier> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyAsync(
        string scope,
        string? entityId = null,
        Guid? projectId = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(scope))
            return;

        try
        {
            var payload = new DataChangedNotification(
                scope,
                entityId,
                projectId,
                DateTime.UtcNow);

            if (projectId.HasValue)
            {
                await _hub.Clients.Group("dashboard-global").SendAsync("DataChanged", payload, ct);
                await _hub.Clients.Group($"project-{projectId.Value}").SendAsync("DataChanged", payload, ct);
            }
            else
            {
                await _hub.Clients.All.SendAsync("DataChanged", payload, ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // The request itself is being torn down; nothing to recover.
        }
        catch (Exception ex)
        {
            // A SignalR problem must never turn a successful save into a failed request.
            _logger.LogWarning(
                ex,
                "[DataChange] Failed to broadcast scope {Scope}; clients will fall back to polling.",
                scope);
        }
    }
}