using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class ProjectsSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        if (context.Database.CurrentTransaction != null)
        {
            await SeedCoreAsync(context, ct);
            return;
        }

        await using var transaction = await context.Database.BeginTransactionAsync(ct);
        try
        {
            await SeedCoreAsync(context, ct);
            await transaction.CommitAsync(ct);
        }
        catch
        {
            await transaction.RollbackAsync(ct);
            throw;
        }
    }

    private static async Task SeedCoreAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var departments = await context.Departments.ToListAsync(ct);
        var users = await context.Users.ToListAsync(ct);
        var spec = BuildProjectSpec(departments, users);

        // Seed once, matching the guard used by every other seeder. The previous implementation
        // deleted all projects on every start, which cascade-deleted ProjectDocuments (and any
        // other project-owned rows), so uploaded documents disappeared after each restart and the
        // project came back with a new GUID, orphaning the files still on disk.
        if (await context.Projects.AnyAsync(p => p.ProjectCode == spec.ProjectCode, ct))
        {
            return;
        }

        var project = Project.Create(spec.Name, spec.Description, spec.Category, spec.Priority, spec.DepartmentId, spec.ManagerId, spec.Start, spec.End, spec.Budget, spec.Client, spec.ProjectCode);
        project.SetCreatedBy(SeedConstants.SeedUser);
        project.UpdateStatus(ProjectStatus.InProgress);
        project.UpdateProgress(spec.Progress);
        project.AddActualCost(spec.ActualCost);
        project.UpdateAIAnalysis(spec.Health, spec.DelayRisk, spec.BudgetRisk, spec.Insight);
        await context.Projects.AddAsync(project, ct);

        await context.SaveChangesAsync(ct);
    }

    private static SeedConstants.ProjectSpec BuildProjectSpec(List<Department> departments, List<ApplicationUser> users)
    {
        var chiefEngineer = users.FirstOrDefault(u => u.EmployeeCode == "CE001") ?? users.First();
        return new SeedConstants.ProjectSpec(
            Name: "Construction of Government Residential Colony ",
            Description: "Development of a government residential colony in Lucknow including land acquisition, planning, construction of residential units, utilities, roads, landscaping, and quality handover.",
            Category: "Infrastructure",
            Priority: ProjectPriority.Critical,
            DepartmentId: departments.First(d => d.Code == "PWD").Id,
            ManagerId: chiefEngineer.Id,
            Start: new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            End: new DateTime(2027, 12, 31, 0, 0, 0, DateTimeKind.Utc),
            Budget: 1850000000m,
            ActualCost: 0m,
            Client: "Government of Uttar Pradesh",
            Progress: 5,
            Health: 85,
            DelayRisk: 0.15,
            BudgetRisk: 0.10,
            Insight: "Project in early stages. Land acquisition phase ongoing.",
            ProjectCode: "UPPWD-COLONY-2026-001");
    }
}
