namespace PMWDS.Application.Interfaces.Services;

/// <summary>
/// Announces that a slice of workspace data changed so connected clients can refetch.
/// </summary>
/// <remarks>
/// This is an invalidation hint, not a data transport. Clients re-request the data
/// through the normal authorized endpoints, so nothing is disclosed here that the
/// recipient could not already read for themselves.
/// </remarks>
public interface IDataChangeNotifier
{
    /// <summary>
    /// Broadcasts a change for one of the scopes in <see cref="DataChangeScopes"/>.
    /// Must never throw: a failed notification must not fail the caller's save.
    /// </summary>
    Task NotifyAsync(
        string scope,
        string? entityId = null,
        Guid? projectId = null,
        CancellationToken ct = default);
}

/// <summary>
/// The scopes a client can subscribe to. Keep in sync with
/// <c>Client/src/realtimeScopes.ts</c>.
/// </summary>
public static class DataChangeScopes
{
    public const string Projects = "projects";
    public const string Milestones = "milestones";
    public const string Tasks = "tasks";
    public const string Users = "users";
    public const string Documents = "documents";
    public const string Departments = "departments";
    public const string Organizations = "organizations";
    public const string Roles = "roles";
    public const string Notifications = "notifications";
    public const string Dashboards = "dashboards";
    public const string UtilizationCertificates = "utilization-certificates";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Projects,
        Milestones,
        Tasks,
        Users,
        Documents,
        Departments,
        Organizations,
        Roles,
        Notifications,
        Dashboards,
        UtilizationCertificates,
    };
}