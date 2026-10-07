using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PMWDS.Persistence.Context;

public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

        var sqliteConnectionString = Environment.GetEnvironmentVariable("PMWDS_SQLITE_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(sqliteConnectionString))
        {
            var solutionRoot = FindSolutionRoot(Directory.GetCurrentDirectory());
            var sqlitePath = Path.GetFullPath(Path.Combine(solutionRoot, "PMWDS.API", "App_Data", "pmwds-v1.sqlite"));
            Directory.CreateDirectory(Path.GetDirectoryName(sqlitePath)!);
            sqliteConnectionString = $"Data Source={sqlitePath}";
        }

        optionsBuilder.UseSqlite(sqliteConnectionString, sql => sql.MigrationsAssembly("PMWDS.Persistence"));

        return new ApplicationDbContext(optionsBuilder.Options);
    }

    private static string FindSolutionRoot(string startDirectory)
    {
        var current = new DirectoryInfo(startDirectory);
        while (current != null)
        {
            if (current.GetFiles("*.slnx").Any() || current.GetFiles("*.sln").Any())
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        return startDirectory;
    }
}
