using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace PMWDS.Tests.Infrastructure;

/// <summary>
/// Hosts the real API in-process for integration tests.
/// </summary>
/// <remarks>
/// The application does a great deal at startup - resolve the database, create it, apply
/// migrations, seed it, resolve storage roots, probe Redis, install Hangfire. Rather than
/// mocking any of that, the tests exercise the genuine startup path, because that path is
/// exactly where the SQL Server bugs were hiding.
///
/// Two isolation guarantees:
/// <list type="bullet">
///   <item>Each fixture instance gets its own SQLite file under the temp directory, so
///   tests never read or write the developer's <c>App_Data/pmwds-dev.sqlite</c>.</item>
///   <item>Storage is redirected to a temp directory too, so uploads and seeded avatars do
///   not land in the real <c>App_Data</c> tree.</item>
/// </list>
///
/// Set <c>PMWDS_TEST_BASE_URL</c> to run the same tests against an already-running server
/// instead - useful for exercising the SQL Server and Hangfire branches, which are skipped
/// in-process. See <see cref="ApiFixture.UsesExternalServer"/>.
/// </remarks>
public sealed class ApiFactory : WebApplicationFactory<PMWDS.API.TestHost>
{
    private readonly string _root;

    public ApiFactory()
    {
        _root = Path.Combine(Path.GetTempPath(), "pmwds-tests", Guid.NewGuid().ToString("N")[..12]);
        Directory.CreateDirectory(_root);

        DatabasePath = Path.Combine(_root, "pmwds-test.sqlite");
        StorageRoot = Path.Combine(_root, "data");
        Directory.CreateDirectory(StorageRoot);

        ApplySettingsAsEnvironmentVariables();
    }

    public string DatabasePath { get; }
    public string StorageRoot { get; }

    /// <summary>True when the suite is pointed at an external server via env var.</summary>
    public static bool UsesExternalServer =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("PMWDS_TEST_BASE_URL"));

    public static string ExternalBaseUrl =>
        Environment.GetEnvironmentVariable("PMWDS_TEST_BASE_URL")!.TrimEnd('/');

    private static Dictionary<string, string?> BuildSettings(string databasePath, string storageRoot) => new()
    {
        // SQLite: fast and self-contained, and it runs the same migrations and cascade
        // behaviour the VPS uses. Hangfire stays off because it is gated on SQL Server;
        // that branch is covered by pointing the suite at an external server with
        // PMWDS_TEST_BASE_URL.
        ["ConnectionStrings:Default"] = string.Empty,
        ["ConnectionStrings:Hangfire"] = string.Empty,
        ["ConnectionStrings:Redis"] = string.Empty,

        ["Database:ForceSqlite"] = "true",
        ["Database:AllowSqliteInProduction"] = "true",
        ["Database:SqliteConnectionString"] = $"Data Source={databasePath}",

        ["AzureStorage:LocalUploadPath"] = storageRoot,
        ["AzureStorage:LocalBaseUrl"] = "/files",
        ["FileStorage:BasePath"] = storageRoot,
        ["FileStorage:AvatarsPath"] = "avatars",
        ["FileStorage:DocumentsPath"] = "documents",

        ["Jwt:Secret"] = "IntegrationTestKey_NotUsedInProduction_0123456789_ABCDEFG",
        ["Jwt:Issuer"] = "PMWDS",
        ["Jwt:Audience"] = "PMWDS_Users",
        ["Jwt:ExpiryMinutes"] = "120",

        ["Serilog:MinimumLevel:Default"] = "Warning",
        ["Serilog:MinimumLevel:Override:Microsoft.AspNetCore"] = "Warning",
        ["Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore"] = "Error",
        ["Serilog:MinimumLevel:Override:System"] = "Error",

        ["AllowedOrigins:0"] = "http://localhost",
    };

    /// <summary>
    /// Configuration has to be injected through process environment variables, not through
    /// <c>UseSetting</c> or <c>ConfigureAppConfiguration</c>.
    ///
    /// <c>Program.cs</c> reads the database settings before <c>builder.Build()</c>:
    /// <c>AddApplicationDatabase</c> runs near the top of the file and pulls
    /// <c>ConnectionStrings:Default</c> straight out of <c>builder.Configuration</c>. Values
    /// handed to the <c>IWebHostBuilder</c> are only merged into the host at Build() time, so
    /// they arrive too late and the test host silently picks up the developer's real
    /// <c>.env</c> - which pointed it at SQL Server and produced a
    /// SqlServerRetryingExecutionStrategy inside a supposedly SQLite-only suite.
    ///
    /// Environment variables are read when the configuration manager is constructed, which
    /// happens after this constructor runs, so they are seen everywhere.
    ///
    /// The test host is a dedicated process, so mutating its environment is safe.
    /// </summary>
    private void ApplySettingsAsEnvironmentVariables()
    {
        foreach (var (key, value) in BuildSettings(DatabasePath, StorageRoot))
        {
            Environment.SetEnvironmentVariable(key.Replace(":", "__"), value);
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");

        // Also applied here so anything the app reads after Build() sees the same values.
        foreach (var (key, value) in BuildSettings(DatabasePath, StorageRoot))
        {
            builder.UseSetting(key, value);
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (!disposing)
        {
            return;
        }

        try
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }
        catch (IOException)
        {
            // A locked file must never fail the test run; the temp directory is disposable.
        }
    }
}
