using System.Data;
using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PMWDS.Infrastructure.Settings;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Services;

public enum ActiveDatabaseProvider
{
    SqlServer,
    Sqlite
}

public sealed record DatabaseConnectionStatus(
    ActiveDatabaseProvider Provider,
    string ProviderName,
    string ConnectionName,
    string DisplayDataSource,
    bool IsFallback,
    IReadOnlyList<string> AttemptLog);

public static class DatabaseConnectionService
{
    public static DatabaseConnectionStatus AddApplicationDatabase(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var settings = configuration.GetSection("Database").Get<DatabaseSettings>() ?? new DatabaseSettings();
        var sqlServerConnection = configuration.GetConnectionString("Default");

        // Resolve relative SQLite data sources against the content root so the path does not
        // depend on the process working directory (differs under systemd).
        var sqliteConnection = ResolveSqliteConnectionString(settings.SqliteConnectionString, environment.ContentRootPath);
        var attempts = new List<string>();

        if (!environment.IsDevelopment())
        {
            GuardSqliteOutsideAppDirectory(sqliteConnection, environment, attempts);
        }

        var selected = SelectProvider(environment, settings, sqlServerConnection, sqliteConnection, attempts);

        services.AddSingleton(selected);
        services.AddDbContext<ApplicationDbContext>(opt =>
        {
            switch (selected.Provider)
            {
                case ActiveDatabaseProvider.SqlServer:
                    opt.UseSqlServer(sqlServerConnection, sql =>
                    {
                        sql.MigrationsAssembly("PMWDS.Persistence");
                        sql.EnableRetryOnFailure(
                            maxRetryCount: 1,
                            maxRetryDelay: TimeSpan.FromSeconds(2),
                            errorNumbersToAdd: null);
                    });
                    break;
                case ActiveDatabaseProvider.Sqlite:
                    opt.UseSqlite(sqliteConnection, sql => sql.MigrationsAssembly("PMWDS.Persistence"));
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported database provider {selected.Provider}.");
            }
            opt.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        Console.WriteLine($"[PMWDS] Using {selected.ProviderName} database ({selected.DisplayDataSource}).");
        foreach (var attempt in attempts)
        {
            Console.WriteLine($"[PMWDS] Database selection: {attempt}");
        }

        if (selected.Provider == ActiveDatabaseProvider.SqlServer)
        {
            EnsureDatabasesExist(configuration, sqlServerConnection);
        }

        return selected;
    }

    public static async Task PrepareDatabaseAsync(
        ApplicationDbContext db,
        DatabaseConnectionStatus status,
        IWebHostEnvironment environment,
        CancellationToken ct = default)
    {
        if (status.Provider == ActiveDatabaseProvider.Sqlite)
        {
            var sqlitePath = status.DisplayDataSource;
            var sqliteDirectory = Path.GetDirectoryName(sqlitePath);
            if (!string.IsNullOrWhiteSpace(sqliteDirectory))
            {
                Directory.CreateDirectory(Path.IsPathRooted(sqliteDirectory)
                    ? sqliteDirectory
                    : Path.Combine(environment.ContentRootPath, sqliteDirectory));
            }

            if (environment.IsDevelopment())
            {
                await EnsureSqliteDevelopmentDatabaseAsync(db, ct);
                return;
            }

            // Production SQLite: never drop the database. Apply EF migrations forward only.
            Console.WriteLine("[PMWDS] Applying SQLite migrations (production, no destructive reset)...");
            await db.Database.MigrateAsync(ct);
            await EnsureSqliteCompatibilityColumnsAsync(db, ct);
            return;
        }

        Console.WriteLine("[PMWDS] Applying database migrations...");

        // A database whose __EFMigrationsHistory references migrations that no longer exist in
        // the assembly cannot be migrated: EF tries to create tables that are already there and
        // fails. Previously that failure was swallowed in Development and answered by dropping
        // the whole database, which turned a recoverable "baseline this database" problem into
        // silent data loss. Detect it first and say exactly what to do instead.
        await GuardAgainstStaleMigrationHistoryAsync(db, environment, ct);

        try
        {
            await db.Database.MigrateAsync(ct);
        }
        catch when (environment.IsDevelopment() && AllowDevelopmentReset())
        {
            Console.WriteLine(
                "[PMWDS] SQL Server development migration failed and Database__AllowDevelopmentReset is on; " +
                "recreating the database from InitialCreate. Any existing data will be lost.");
            await db.Database.EnsureDeletedAsync(ct);
            await db.Database.MigrateAsync(ct);
        }
        catch when (environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "Database migration failed, and the database was left untouched because " +
                "Database__AllowDevelopmentReset is not set. Fix the cause, or set " +
                "Database__AllowDevelopmentReset=true to drop and recreate this development " +
                "database from scratch (this destroys its data). See the exception above for the " +
                "underlying migration error.");
        }

        if (!await HasExpectedSqlServerSchemaAsync(db, ct))
        {
            if (!environment.IsDevelopment() || !AllowDevelopmentReset())
            {
                throw new InvalidOperationException(
                    "SQL Server schema is incomplete after migrations. " +
                    (environment.IsDevelopment()
                        ? "Set Database__AllowDevelopmentReset=true to recreate this development database (this destroys its data)."
                        : "Refusing to reset outside Development."));
            }

            Console.WriteLine(
                "[PMWDS] SQL Server development schema is incomplete and Database__AllowDevelopmentReset is on; " +
                "recreating from InitialCreate. Any existing data will be lost.");
            await db.Database.EnsureDeletedAsync(ct);
            await db.Database.MigrateAsync(ct);
        }
    }

    /// <summary>
    /// Destructive resets are opt-in. They used to happen automatically in Development, so any
    /// migration hiccup silently destroyed the developer's database.
    /// </summary>
    private static bool AllowDevelopmentReset()
    {
        var configured = Environment.GetEnvironmentVariable("Database__AllowDevelopmentReset");
        return string.Equals(configured, "true", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Fails with an actionable message when the database was last migrated by a migration set
    /// that has since been squashed or removed.
    /// </summary>
    private static async Task GuardAgainstStaleMigrationHistoryAsync(
        ApplicationDbContext db,
        IWebHostEnvironment environment,
        CancellationToken ct)
    {
        var applied = await GetAppliedMigrationIdsAsync(db, ct);
        if (applied.Count == 0)
        {
            return;
        }

        var known = db.Database.GetMigrations();
        var unknown = applied.Where(id => !known.Contains(id)).ToList();
        if (unknown.Count == 0)
        {
            return;
        }

        var message =
            "This database was migrated by migrations that no longer exist in the application: " +
            string.Join(", ", unknown) +
            Environment.NewLine +
            "EF cannot migrate a database in that state. Baseline it against the current migration " +
            "set before starting: see docs/database/migration-squash.md." +
            Environment.NewLine +
            "For a throwaway development database, set Database__AllowDevelopmentReset=true and restart to " +
            "drop and recreate it from scratch (this destroys its data).";

        if (environment.IsDevelopment())
        {
            Console.WriteLine("[PMWDS] " + message);
        }

        throw new InvalidOperationException(message);
    }

    private static async Task<List<string>> GetAppliedMigrationIdsAsync(
        ApplicationDbContext db,
        CancellationToken ct)
    {
        // A database that has never been migrated has no history table at all. That is the normal
        // state of a fresh deployment, not a corrupt one, so report it as "nothing applied yet"
        // and let the migration step create the table. Selecting from it unconditionally threw
        // "Invalid object name '__EFMigrationsHistory'" and made a brand new SQL Server database
        // impossible to start against.
        //
        // The check has to be for this specific table, not for "does the database have any
        // tables": Hangfire installs its own tables during startup, so a database can be
        // non-empty and still have no migration history.
        var history = db.GetService<IHistoryRepository>();
        if (!history.Exists())
        {
            return [];
        }

        return [.. history.GetAppliedMigrations().Select(row => row.MigrationId)];
    }

    /// <summary>
    /// Outside Development the SQLite file must live outside the application directory. The usual
    /// deploy replaces the publish folder in place, so a database inside it is destroyed on every
    /// redeploy — the "data disappears" symptom. Fail fast instead of silently losing data.
    /// </summary>
    private static void GuardSqliteOutsideAppDirectory(
        string sqliteConnectionString,
        IWebHostEnvironment environment,
        List<string> attempts)
    {
        if (string.IsNullOrWhiteSpace(sqliteConnectionString))
        {
            return;
        }

        var marker = "data source=";
        var index = sqliteConnectionString.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return;
        }

        var valueStart = index + marker.Length;
        var valueEnd = sqliteConnectionString.IndexOf(';', valueStart);
        if (valueEnd < 0)
        {
            valueEnd = sqliteConnectionString.Length;
        }

        var dataSource = sqliteConnectionString[valueStart..valueEnd].Trim();
        if (dataSource.Length == 0 ||
            dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase) ||
            dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase) ||
            !Path.IsPathRooted(dataSource))
        {
            return;
        }

        var appDirectory = Path.GetFullPath(AppContext.BaseDirectory)
            .TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;

        if (dataSource.StartsWith(appDirectory, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Database:SqliteConnectionString points inside the application directory ({dataSource}). " +
                "A deploy replaces that directory, which would delete the database. " +
                "Use a durable absolute path outside the app folder, e.g. /var/lib/pmwds/database/pmwds-v1.sqlite.");
        }

        attempts.Add($"SQLite data source '{dataSource}' verified outside the application directory.");
    }

    private static string ResolveSqliteConnectionString(string connectionString, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return connectionString;
        }

        var marker = "data source=";
        var index = connectionString.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return connectionString;
        }

        var valueStart = index + marker.Length;
        var valueEnd = connectionString.IndexOf(';', valueStart);
        if (valueEnd < 0)
        {
            valueEnd = connectionString.Length;
        }

        var dataSource = connectionString[valueStart..valueEnd].Trim();
        if (dataSource.Length == 0
            || dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase)
            || dataSource.StartsWith("file:", StringComparison.OrdinalIgnoreCase)
            || Path.IsPathRooted(dataSource))
        {
            return connectionString;
        }

        var resolved = Path.GetFullPath(Path.Combine(contentRootPath, dataSource));
        return connectionString[..valueStart] + resolved + connectionString[valueEnd..];
    }

    private static DatabaseConnectionStatus SelectProvider(
        IWebHostEnvironment environment,
        DatabaseSettings settings,
        string? sqlServerConnection,
        string sqliteConnection,
        List<string> attempts)
    {
        var sqlitePermitted = environment.IsDevelopment() || settings.AllowSqliteInProduction;

        if (settings.ForceSqlite)
        {
            if (!sqlitePermitted)
            {
                throw new InvalidOperationException(
                    "Database:ForceSqlite requires Development or Database:AllowSqliteInProduction=true. Production must use SQL Server by default.");
            }

            attempts.Add("SQLite forced by Database:ForceSqlite.");
            return CreateStatus(ActiveDatabaseProvider.Sqlite, "SQLite", "Database:SqliteConnectionString", sqliteConnection, true, attempts);
        }

        if (CanConnectToSqlServer(sqlServerConnection))
        {
            attempts.Add("SQL Server connection succeeded.");
            return CreateStatus(ActiveDatabaseProvider.SqlServer, "SQL Server", "ConnectionStrings:Default", sqlServerConnection!, false, attempts);
        }

        attempts.Add("SQL Server unavailable or not configured.");

        if (!sqlitePermitted)
        {
            throw new InvalidOperationException(
                "SQL Server is required outside Development, but ConnectionStrings:Default is not reachable. " +
                "Set Database:AllowSqliteInProduction=true to run SQLite in Production.");
        }

        attempts.Add("SQLite selected after a single SQL Server connectivity check.");
        return CreateStatus(ActiveDatabaseProvider.Sqlite, "SQLite", "Database:SqliteConnectionString", sqliteConnection, true, attempts);
    }

    private static DatabaseConnectionStatus CreateStatus(
        ActiveDatabaseProvider provider,
        string providerName,
        string connectionName,
        string connectionString,
        bool isFallback,
        IReadOnlyList<string> attempts)
        => new(
            provider,
            providerName,
            connectionName,
            GetDisplayDataSource(provider, connectionString),
            isFallback,
            attempts.ToArray());

    private static bool CanConnectToSqlServer(string? connectionString)
    {
        // Use 'master' for the connectivity probe — the target database may not exist yet
        var probeCs = connectionString;
        if (!string.IsNullOrWhiteSpace(probeCs))
        {
            var builder = new SqlConnectionStringBuilder(probeCs) { InitialCatalog = "master", ConnectTimeout = 3 };
            probeCs = builder.ConnectionString;
        }

        return CanConnect(probeCs, cs =>
        {
            var b = new SqlConnectionStringBuilder(cs) { ConnectTimeout = 3 };
            return new SqlConnection(b.ConnectionString);
        });
    }

    private static void EnsureDatabasesExist(IConfiguration configuration, string? sqlServerConnection)
    {
        if (string.IsNullOrWhiteSpace(sqlServerConnection))
            return;

        var databases = new[]
        {
            new SqlConnectionStringBuilder(sqlServerConnection).InitialCatalog,
            configuration.GetConnectionString("Hangfire") is { } hg
                ? new SqlConnectionStringBuilder(hg).InitialCatalog
                : null
        }.Where(db => !string.IsNullOrWhiteSpace(db)).Distinct();

        foreach (var dbName in databases)
        {
            try
            {
                var masterBuilder = new SqlConnectionStringBuilder(sqlServerConnection)
                {
                    InitialCatalog = "master",
                    ConnectTimeout = 5
                };
                using var conn = new SqlConnection(masterBuilder.ConnectionString);
                conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = @db) CREATE DATABASE [{dbName}]";
                cmd.Parameters.AddWithValue("@db", dbName);
                cmd.ExecuteNonQuery();
                Console.WriteLine($"[PMWDS] Database '{dbName}' ensured.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PMWDS] WARNING: Could not ensure database '{dbName}' exists: {ex.Message}");
            }
        }
    }

    private static bool CanConnect(string? connectionString, Func<string, DbConnection> connectionFactory)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return false;
        }

        try
        {
            using var connection = connectionFactory(connectionString);
            connection.Open();
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string GetDisplayDataSource(ActiveDatabaseProvider provider, string connectionString)
    {
        try
        {
            return provider switch
            {
                ActiveDatabaseProvider.SqlServer => new SqlConnectionStringBuilder(connectionString).DataSource,
                ActiveDatabaseProvider.Sqlite => connectionString.Replace("Data Source=", string.Empty, StringComparison.OrdinalIgnoreCase).Trim(),
                _ => provider.ToString()
            };
        }
        catch
        {
            return provider.ToString();
        }
    }

    private static async Task EnsureSqliteDevelopmentDatabaseAsync(ApplicationDbContext db, CancellationToken ct)
    {
        try
        {
            if (!await HasExpectedSqliteSchemaAsync(db, ct))
            {
                await db.Database.EnsureDeletedAsync(ct);
                await db.Database.EnsureCreatedAsync(ct);
            }

            await EnsureSqliteCompatibilityColumnsAsync(db, ct);
        }
        catch
        {
            await db.Database.EnsureDeletedAsync(ct);
            await db.Database.EnsureCreatedAsync(ct);
            await EnsureSqliteCompatibilityColumnsAsync(db, ct);
        }
    }

    private static async Task<bool> HasExpectedSqliteSchemaAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (!await db.Database.CanConnectAsync(ct))
        {
            return false;
        }

        var expectedTables = new[]
        {
            "Organizations",
            "Departments",
            "Roles",
            "AIModels",
            "PredictionResults",
            "TrainingDataPoints",
            "AllocationRecommendations",
            "DelayPredictions",
            "NotificationTemplates",
            "Dashboards",
            "Reports",
            "Integrations",
            "KnowledgeArticles",
            "ActivityLogs",
            "AIProviderCredentials",
            "UserDepartments",
            "ProjectDepartments",
            "MilestoneDependencies",
            "UtilizationCertificates"
        };

        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(ct);
        }

        try
        {
            foreach (var table in expectedTables)
            {
                await using var command = connection.CreateCommand();
                command.CommandText = $"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'";
                var result = await command.ExecuteScalarAsync(ct);
                if (result == null || result == DBNull.Value)
                {
                    return false;
                }
            }

            return !await HasSqliteIndexAsync(connection, "IX_Departments_Code", ct);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task<bool> HasSqliteIndexAsync(DbConnection connection, string indexName, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT name FROM sqlite_master WHERE type='index' AND name='{indexName}'";
        var result = await command.ExecuteScalarAsync(ct);
        return result != null && result != DBNull.Value;
    }

    private static async Task<bool> HasExpectedSqlServerSchemaAsync(ApplicationDbContext db, CancellationToken ct)
    {
        if (!await db.Database.CanConnectAsync(ct))
        {
            return false;
        }

        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(ct);
        }

        try
        {
            var expectedTables = new[]
            {
                "Organizations",
                "Users",
                "Roles",
                "Projects",
                "Milestones",
                "MilestoneDependencies",
                "Tasks",
                "TaskAssignments",
                "AIGlobalSettings"
            };

            foreach (var table in expectedTables)
            {
                if (!await HasSqlServerTableAsync(connection, table, ct))
                {
                    return false;
                }
            }

            return await HasSqlServerColumnAsync(connection, "Roles", "Key", ct) &&
                await HasSqlServerColumnAsync(connection, "Users", "RefreshTokenHash", ct) &&
                await HasSqlServerColumnAsync(connection, "Users", "AccessTokenVersion", ct) &&
                await HasSqlServerColumnAsync(connection, "Milestones", "DepartmentId", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "Projects", "ProjectManagerId", "uniqueidentifier", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "Tasks", "AssignedToUserId", "uniqueidentifier", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "Tasks", "AssignedByUserId", "uniqueidentifier", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "Tasks", "AIRecommendedAssigneeId", "uniqueidentifier", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "TaskAssignments", "UserId", "uniqueidentifier", ct) &&
                await HasSqlServerColumnTypeAsync(connection, "TaskComments", "UserId", "uniqueidentifier", ct);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task<bool> HasSqlServerTableAsync(DbConnection connection, string tableName, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT OBJECT_ID(@tableName, 'U')";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "@tableName";
        parameter.Value = $"dbo.{tableName}";
        command.Parameters.Add(parameter);
        var result = await command.ExecuteScalarAsync(ct);
        return result != null && result != DBNull.Value;
    }

    private static async Task<bool> HasSqlServerColumnAsync(DbConnection connection, string tableName, string columnName, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = @"
SELECT 1
FROM sys.columns c
INNER JOIN sys.tables t ON c.object_id = t.object_id
WHERE t.name = @tableName AND c.name = @columnName";
        var tableParameter = command.CreateParameter();
        tableParameter.ParameterName = "@tableName";
        tableParameter.Value = tableName;
        command.Parameters.Add(tableParameter);
        var columnParameter = command.CreateParameter();
        columnParameter.ParameterName = "@columnName";
        columnParameter.Value = columnName;
        command.Parameters.Add(columnParameter);
        var result = await command.ExecuteScalarAsync(ct);
        return result != null && result != DBNull.Value;
    }

    private static async Task<bool> HasSqlServerColumnTypeAsync(DbConnection connection, string tableName, string columnName, string dataType, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = @"
SELECT DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tableName AND COLUMN_NAME = @columnName";
        var tableParameter = command.CreateParameter();
        tableParameter.ParameterName = "@tableName";
        tableParameter.Value = tableName;
        command.Parameters.Add(tableParameter);
        var columnParameter = command.CreateParameter();
        columnParameter.ParameterName = "@columnName";
        columnParameter.Value = columnName;
        command.Parameters.Add(columnParameter);
        var result = await command.ExecuteScalarAsync(ct);
        return string.Equals(result?.ToString(), dataType, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task EnsureSqliteCompatibilityColumnsAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(ct);
        }

        try
        {
            // Legacy compatibility: older schemas included AIGlobalSettings.IsActive,
            // but AIGlobalSetting is no longer an auditable entity. The consolidated
            // migrations drop this column. Remove it here too when an older baseline
            // still contains it so the runtime model and physical schema agree.
            if (await HasSqliteColumnAsync(connection, "AIGlobalSettings", "IsActive", ct))
            {
                await ExecuteSqliteAsync(
                    connection,
                    "ALTER TABLE \"AIGlobalSettings\" DROP COLUMN \"IsActive\"",
                    ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "PasswordResetTokenExpiresAt", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"PasswordResetTokenExpiresAt\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "PasswordResetTokenHash", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"PasswordResetTokenHash\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "RefreshTokenHash", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"RefreshTokenHash\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "RefreshTokenExpiresAt", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"RefreshTokenExpiresAt\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "RefreshTokenRevokedAt", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"RefreshTokenRevokedAt\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "AccessTokenVersion", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"AccessTokenVersion\" INTEGER NOT NULL DEFAULT 0", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Users", "OrganizationId", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Users\" ADD COLUMN \"OrganizationId\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Skills", "OrganizationId", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Skills\" ADD COLUMN \"OrganizationId\" TEXT NULL", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Roles", "Key", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Roles\" ADD COLUMN \"Key\" TEXT NOT NULL DEFAULT ''", ct);
                await ExecuteSqliteAsync(connection, "UPDATE \"Roles\" SET \"Key\" = LOWER(REPLACE(\"Name\", ' ', '-')) WHERE \"Key\" = ''", ct);
                await ExecuteSqliteAsync(connection, "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Roles_Key\" ON \"Roles\" (\"Key\")", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Roles", "PaginationPageSize", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Roles\" ADD COLUMN \"PaginationPageSize\" INTEGER NOT NULL DEFAULT 10", ct);
            }

            if (!await HasSqliteColumnAsync(connection, "Milestones", "DepartmentId", ct))
            {
                await ExecuteSqliteAsync(connection, "ALTER TABLE \"Milestones\" ADD COLUMN \"DepartmentId\" TEXT NULL", ct);
                await ExecuteSqliteAsync(connection, "UPDATE \"Milestones\" SET \"DepartmentId\" = (SELECT \"DepartmentId\" FROM \"Projects\" WHERE \"Projects\".\"Id\" = \"Milestones\".\"ProjectId\") WHERE \"DepartmentId\" IS NULL", ct);
                await ExecuteSqliteAsync(connection, "CREATE INDEX IF NOT EXISTS \"IX_Milestones_DepartmentId\" ON \"Milestones\" (\"DepartmentId\")", ct);
            }

            await NormalizeSqliteNullableGuidColumnsAsync(connection, ct);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task NormalizeSqliteNullableGuidColumnsAsync(DbConnection connection, CancellationToken ct)
    {
        var nullableGuidColumns = new (string Table, string Column)[]
        {
            ("ActivityLogs", "ProjectId"),
            ("Departments", "OrganizationId"),
            ("Departments", "ParentDepartmentId"),
            ("KnowledgeArticles", "ProjectId"),
            ("Milestones", "DepartmentId"),
            ("PredictionResults", "TaskId"),
            ("Projects", "ProjectManagerId"),
            ("Skills", "OrganizationId"),
            ("TaskComments", "UserId"),
            ("TaskComments", "ParentCommentId"),
            ("Tasks", "MilestoneId"),
            ("Tasks", "ParentTaskId"),
            ("Tasks", "AssignedToUserId"),
            ("Tasks", "AssignedByUserId"),
            ("Tasks", "AIRecommendedAssigneeId"),
            ("Users", "OrganizationId"),
            ("Users", "DepartmentId"),
            ("Webhooks", "IntegrationId")
        };

        foreach (var (table, column) in nullableGuidColumns)
        {
            if (await HasSqliteColumnAsync(connection, table, column, ct))
            {
                await ExecuteSqliteAsync(
                    connection,
                    $"UPDATE \"{table}\" SET \"{column}\" = NULL WHERE \"{column}\" = ''",
                    ct);
            }
        }
    }

    private static async Task<bool> HasSqliteColumnAsync(DbConnection connection, string tableName, string columnName, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info(\"{tableName}\")";
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            if (string.Equals(reader["name"]?.ToString(), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task ExecuteSqliteAsync(DbConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(ct);
    }
}
