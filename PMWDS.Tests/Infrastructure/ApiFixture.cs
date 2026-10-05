using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace PMWDS.Tests.Infrastructure;

/// <summary>
/// A logged-in session for one seeded identity.
/// </summary>
public sealed class Session : IDisposable
{
    private const string DefaultPassword = "Pmwds@123";

    private Session(ApiClient client, string email, string userId, string[] roles, string[] permissions)
    {
        Client = client;
        Email = email;
        UserId = userId;
        Roles = roles;
        Permissions = permissions;
    }

    public ApiClient Client { get; }
    public string Email { get; }
    public string UserId { get; }
    public string[] Roles { get; }
    public string[] Permissions { get; }

    public bool Can(string permission) => Permissions.Contains(permission, StringComparer.OrdinalIgnoreCase);

    public void Dispose() => Client.Dispose();

    /// <summary>Logs in over the real <c>POST /api/v1/auth/login</c> endpoint.</summary>
    public static async Task<Session> LoginAsync(HttpClient http, string email, bool ownsClient = false)
    {
        var client = new ApiClient(http, ownsClient);

        var response = await client.PostAsync<JsonElement>("/api/v1/auth/login", new
        {
            email,
            password = DefaultPassword,
        });

        if (!response.IsSuccess || response.Data.ValueKind == System.Text.Json.JsonValueKind.Undefined)
        {
            client.Dispose();
            throw new InvalidOperationException(
                $"Integration setup could not log in as '{email}'. " +
                $"The seeded account is required. Got {(int)response.Status} " +
                $"[{(response.ErrorCode ?? response.ErrorMessage)}]: {response.RawBody}");
        }

        var token = response.Data.GetProperty("token").GetString()
            ?? throw new InvalidOperationException($"Login for '{email}' returned no token.");

        client.UseToken(token);

        return new Session(
            client,
            email,
            response.Data.GetProperty("userId").GetString() ?? string.Empty,
            ReadStrings(response.Data, "roles"),
            ReadStrings(response.Data, "permissions"));
    }

    private static string[] ReadStrings(JsonElement element, string property)
        => element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().Select(x => x.GetString() ?? string.Empty).ToArray()
            : Array.Empty<string>();
}

/// <summary>
/// Shared, lazily created sessions. One collection fixture for the whole suite so the app
/// boots (and seeds) exactly once - startup migrates and seeds the database, which is far
/// too slow to repeat per test class.
/// </summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

/// <summary>
/// Owns the in-process server (or points at an external one) and caches logged-in sessions.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private ApiFactory? _factory;
    private readonly List<HttpClient> _clients = new();

    public Session SuperAdmin { get; private set; } = null!;
    public Session Admin { get; private set; } = null!;
    public Session DepartmentHead { get; private set; } = null!;
    public Session ProjectManager { get; private set; } = null!;
    public Session TeamMember { get; private set; } = null!;
    public Session Viewer { get; private set; } = null!;

    /// <summary>True when Hangfire/SQL Server behaviour is reachable in this run.</summary>
    public bool RunsAgainstSqlServer { get; private set; }

    /// <summary>
    /// Directory documents and uploads are written to. Null when pointed at an external
    /// server, since the test process does not own that filesystem.
    /// </summary>
    public string? StorageRoot => _factory?.StorageRoot;

    public async Task InitializeAsync()
    {
        if (ApiFactory.UsesExternalServer)
        {
            RunsAgainstSqlServer = true;
        }
        else
        {
            _factory = new ApiFactory();
        }

        // One HttpClient PER SESSION, never a shared one.
        //
        // ApiClient.UseToken sets DefaultRequestHeaders.Authorization, which lives on the
        // HttpClient itself. Sharing a single client means logging in as a second identity
        // silently replaces the first one's Authorization header, so whichever session was
        // created last acts as every other one. That made SuperAdmin project creation fail
        // with 403 while the permission assertions still passed - and it would have made
        // every authorization test in the suite meaningless.
        SuperAdmin = await LoginAsync(SeededUsers.SuperAdmin);
        Admin = await LoginAsync(SeededUsers.Admin);
        DepartmentHead = await LoginAsync(SeededUsers.DepartmentHead);
        ProjectManager = await LoginAsync(SeededUsers.ProjectManager);
        TeamMember = await LoginAsync(SeededUsers.TeamMember);
        Viewer = await LoginAsync(SeededUsers.Viewer);
    }

    /// <summary>
    /// A fresh unauthenticated client, for negative tests that need their own header state.
    /// </summary>
    public HttpClient CreateAnonymousClient()
    {
        var client = CreateClient();
        client.Timeout = TimeSpan.FromMinutes(5);
        return client;
    }

    /// <summary>
    /// Address the hub is served on. "http://localhost" is the in-process TestServer's
    /// virtual host; the handler below is what actually routes the request.
    /// </summary>
    public string HubBaseAddress => ApiFactory.UsesExternalServer
        ? ApiFactory.ExternalBaseUrl
        : "http://localhost";

    /// <summary>
    /// Handler that routes SignalR traffic through the in-process host.
    /// </summary>
    public Func<HttpMessageHandler> HubHandlerFactory => () =>
        _factory?.Server.CreateHandler() ?? new HttpClientHandler();

    private async Task<Session> LoginAsync(string email)
    {
        var http = CreateClient();
        _clients.Add(http);
        return await Session.LoginAsync(http, email);
    }

    private HttpClient CreateClient()
    {
        if (ApiFactory.UsesExternalServer)
        {
            return new HttpClient { BaseAddress = new Uri(ApiFactory.ExternalBaseUrl) };
        }

        // WebApplicationFactory hands out clients that share one handler but each own their
        // own DefaultRequestHeaders, which is exactly the isolation needed here.
        return _factory!.CreateClient();
    }

    public async Task DisposeAsync()
    {
        SuperAdmin?.Dispose();
        Admin?.Dispose();
        DepartmentHead?.Dispose();
        ProjectManager?.Dispose();
        TeamMember?.Dispose();
        Viewer?.Dispose();

        foreach (var client in _clients)
        {
            client.Dispose();
        }

        _clients.Clear();
        _factory?.Dispose();
    }
}

/// <summary>Seeded identities. Password is the seeder default, see SeedConstants.DefaultPassword.</summary>
public static class SeededUsers
{
    public const string SuperAdmin = "superadmin@org1.com";
    public const string Admin = "admin@org1.com";            // role key: director
    public const string DepartmentHead = "head.eng@org1.com"; // PWDC
    public const string ProjectManager = "manager@org1.com";  // PWD
    public const string TeamMember = "member@org1.com";       // PWDC
    public const string Viewer = "viewer@org1.com";           // PWD

    public const string Password = "Pmwds@123";
}
