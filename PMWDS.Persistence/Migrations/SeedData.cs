using Microsoft.EntityFrameworkCore;
using PMWDS.Persistence.Context;
using PMWDS.Persistence.Migrations.Seeders;

namespace PMWDS.Persistence.Migrations;

public static class SeedData
{
    /// <param name="storageBasePath">
    /// Absolute directory that seed profile images are copied into. Passed in from the host so the
    /// seeder does not have to guess a path: it previously walked three directories up from the
    /// assembly, which resolves outside the publish folder on a deployed server (for example
    /// /var/Data) and fails with UnauthorizedAccessException.
    /// </param>
    public static async Task SeedAsync(
        ApplicationDbContext context,
        CancellationToken ct = default,
        IReadOnlyDictionary<string, string?>? aiProviderKeys = null,
        string? storageBasePath = null)
    {
        var strategy = context.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(ct);
            try
            {
                await OrganizationsSeeder.SeedAsync(context, ct);
                await DepartmentsSeeder.SeedAsync(context, ct);
                await RolesAndPermissionsSeeder.SeedAsync(context, ct);
                await UsersSeeder.SeedAsync(context, ct, storageBasePath);
                await ProfilesSeeder.SeedAsync(context, ct);
                await ProjectsSeeder.SeedAsync(context, ct);
                await MilestonesSeeder.SeedAsync(context, ct);
                await TasksSeeder.SeedAsync(context, ct);
                await GovernmentProjectsSeeder.SeedAsync(context, ct);
                await NotificationsSeeder.SeedAsync(context, ct);
                await ActivityLogsSeeder.SeedAsync(context, ct);
                await MiscSeeder.SeedAsync(context, ct, aiProviderKeys);

                await transaction.CommitAsync(ct);
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        });
    }
}
