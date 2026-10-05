using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class ActivityLogsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var users = await context.Users.Take(5).ToListAsync(ct);
        var projects = await context.Projects.Take(2).ToListAsync(ct);

        foreach (var user in users)
        {
            var projectName = projects.Count > 0 ? projects[new Random().Next(projects.Count)].Name : "Sample Project";

            var seedActivities = new[]
            {
                new { Type = "Project Viewed", Description = $"{user.FullName} viewed project \"{projectName}\"" },
                new { Type = "Task Updated", Description = $"{user.FullName} updated a task in project \"{projectName}\"" },
                new { Type = "Report Generated", Description = $"{user.FullName} generated a report for project \"{projectName}\"" },
            };

            foreach (var activity in seedActivities)
            {
                var exists = await context.ActivityLogs.AnyAsync(a => a.UserId == user.Id && a.ActivityType == activity.Type, ct);
                if (exists)
                    continue;

                var log = ActivityLog.Create(
                    user.Id,
                    activity.Type,
                    activity.Description,
                    new Dictionary<string, object>
                    {
                        ["source"] = "seed",
                        ["employeeCode"] = user.EmployeeCode ?? ""
                    },
                    projects.Count > 0 ? projects[0].Id : null);
                log.SetCreatedBy(SeedConstants.SeedUser);
                await context.ActivityLogs.AddAsync(log, ct);
            }
        }

        await context.SaveChangesAsync(ct);
    }
}
