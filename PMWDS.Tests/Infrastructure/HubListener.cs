using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace PMWDS.Tests.Infrastructure;

/// <summary>
/// Opens a real SignalR connection to the hosted dashboard hub and records the
/// <c>DataChanged</c> events it receives.
/// </summary>
/// <remarks>
/// Uses the host's own <see cref="HttpMessageHandler"/> so the connection is routed through
/// the same pipeline the API is served on. WebSocket transport is not available in-process -
/// <c>TestServer</c> cannot complete a socket upgrade - so SignalR negotiates down to Server
/// Sent Events or Long Polling. That is fine: both carry the identical <c>DataChanged</c>
/// frames, so what is being verified here is the server-side publish and the client
/// subscription, not the transport.
/// </remarks>
public sealed class HubListener : IAsyncDisposable
{
    private readonly HubConnection _connection;
    private readonly List<JsonElement> _events = new();
    private readonly SemaphoreSlim _signal = new(0);
    private readonly TimeSpan _timeout;

    private HubListener(HubConnection connection, string baseAddress, TimeSpan timeout)
    {
        _connection = connection;
        BaseAddress = baseAddress;
        _timeout = timeout;
    }

    public string BaseAddress { get; }

    public static async Task<HubListener> StartAsync(
        string baseAddress,
        string token,
        Func<HttpMessageHandler> handlerFactory,
        TimeSpan timeout)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl($"{baseAddress.TrimEnd('/')}/hubs/dashboard", options =>
            {
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
                options.HttpMessageHandlerFactory = _ => handlerFactory();
            })
            .AddJsonProtocol(options =>
            {
                options.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
            })
            .Build();

        var listener = new HubListener(connection, baseAddress, timeout);

        connection.On("DataChanged", (JsonElement payload) =>
        {
            lock (listener._events)
            {
                listener._events.Add(payload.Clone());
            }

            listener._signal.Release();
        });

        connection.Closed += _ =>
        {
            listener._signal.Release();
            return Task.CompletedTask;
        };

        await connection.StartAsync();
        return listener;
    }

    /// <summary>Waits for the next DataChanged event, or returns null on timeout.</summary>
    public async Task<JsonElement?> WaitForChangeAsync()
        => await WaitForScopeAsync(scope: null);

    /// <summary>
    /// Waits for a DataChanged event for one scope, discarding events for other scopes.
    /// </summary>
    /// <remarks>
    /// The wizard creates a project, three milestones and their dependencies in quick
    /// succession, so several announcements are already in flight before a test gets to the
    /// step it actually cares about. Trying to clear them first races delivery - a fixed
    /// sleep is either too short (flake) or too slow (suite). Filtering by scope expresses
    /// the real intent and is not timing-dependent.
    /// </remarks>
    public async Task<JsonElement?> WaitForScopeAsync(string? scope, TimeSpan? timeout = null)
    {
        var deadline = DateTime.UtcNow + (timeout ?? _timeout);

        while (DateTime.UtcNow < deadline)
        {
            lock (_events)
            {
                for (var i = 0; i < _events.Count; i++)
                {
                    var candidate = _events[i];
                    if (scope is not null &&
                        !string.Equals(candidate.GetProperty("scope").GetString(), scope, StringComparison.Ordinal))
                    {
                        continue;
                    }

                    _events.RemoveAt(i);
                    return candidate;
                }
            }

            var remaining = deadline - DateTime.UtcNow;
            if (remaining <= TimeSpan.Zero)
            {
                break;
            }

            await _signal.WaitAsync(remaining < TimeSpan.FromMilliseconds(250)
                ? remaining
                : TimeSpan.FromMilliseconds(250));
        }

        return null;
    }

    /// <summary>Drains whatever has already arrived without waiting.</summary>
    public List<JsonElement> Drain()
    {
        lock (_events)
        {
            var copy = _events.ToList();
            _events.Clear();
            return copy;
        }
    }

    /// <summary>
    /// Waits briefly for in-flight events to land, then drains them.
    /// </summary>
    /// <remarks>
    /// Delivery is asynchronous - the publish happens before the response returns, but the
    /// frame travels over SSE or Long Polling - so a setup step's own event can still be in
    /// transit when the test decides to "clear the backlog". Draining immediately races it,
    /// and the leftover then pollutes the assertion about the step under test. Sleeping for
    /// a moment first makes the intent explicit.
    /// </remarks>
    public async Task<List<JsonElement>> SettleAndDrainAsync()
    {
        await Task.Delay(TimeSpan.FromMilliseconds(700));
        return Drain();
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            await _connection.StopAsync();
        }
        catch
        {
            // The host may already be shutting down.
        }

        await _connection.DisposeAsync();
        _signal.Dispose();
    }
}
