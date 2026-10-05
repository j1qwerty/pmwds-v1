using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class MilestonesSeeder
{
    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var project = await context.Projects.FirstOrDefaultAsync(p => p.ProjectCode == "UPPWD-COLONY-2026-001", ct);
        if (project == null) return;

        await SeedMilestonesForProjectAsync(context, project, ct);
        await context.SaveChangesAsync(ct);
        await SeedMilestoneDependenciesAsync(context, ct);
    }

    private static async Task SeedMilestonesForProjectAsync(ApplicationDbContext context, Project project, CancellationToken ct)
    {
        var departments = await context.Departments.ToListAsync(ct);
        var specs = GetMilestoneSpecs(project, departments);

        foreach (var spec in specs)
        {
            if (await context.Milestones.AnyAsync(m => m.ProjectId == project.Id && m.Name == spec.Name, ct))
                continue;

            var milestone = Milestone.Create(project.Id, spec.Name, spec.Description, spec.DueDate, spec.Order, true, spec.DepartmentId);
            milestone.SetCreatedBy(SeedConstants.SeedUser);
            milestone.UpdateProgress(spec.Progress);
            await context.Milestones.AddAsync(milestone, ct);
        }
    }

    private static async Task SeedMilestoneDependenciesAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var project = await context.Projects.FirstOrDefaultAsync(ct);
        if (project == null) return;

        var milestones = await context.Milestones
            .Where(m => m.ProjectId == project.Id)
            .ToDictionaryAsync(m => m.Name, ct);

        var dependencies = new List<MilestoneDependency>();

        void AddDep(string prereqName, string depName, MilestoneDependencyType type, double? threshold = null)
        {
            if (!milestones.TryGetValue(prereqName, out var prereq)) return;
            if (!milestones.TryGetValue(depName, out var dependent)) return;
            dependencies.Add(MilestoneDependency.Create(project.Id, prereq.Id, dependent.Id, type, threshold));
        }

        // M2 -> depends on M1 (FS)
        AddDep("Land Acquisition & Site Readiness", "Master Planning & Design", MilestoneDependencyType.CompletionBased);

        // M3 -> depends on M2 (FS)
        AddDep("Master Planning & Design", "Statutory Approvals", MilestoneDependencyType.CompletionBased);

        // M4 -> depends on M3 at 50%
        AddDep("Statutory Approvals", "Tendering & Contractor Selection", MilestoneDependencyType.ProgressThreshold, 50);

        // M5 -> depends on M4 (FS)
        AddDep("Tendering & Contractor Selection", "Site Preparation", MilestoneDependencyType.CompletionBased);

        // M6 -> depends on M5 (FS)
        AddDep("Site Preparation", "Foundation Construction", MilestoneDependencyType.CompletionBased);

        // M7 -> depends on M6 (FS)
        AddDep("Foundation Construction", "Superstructure Construction", MilestoneDependencyType.CompletionBased);

        // M8 -> depends on M7 at 35%
        AddDep("Superstructure Construction", "Water Supply Infrastructure", MilestoneDependencyType.ProgressThreshold, 35);

        // M9 -> depends on M7 at 40%
        AddDep("Superstructure Construction", "Electrical Infrastructure", MilestoneDependencyType.ProgressThreshold, 40);

        // M10 -> depends on M7 at 50%
        AddDep("Superstructure Construction", "Sewerage & Drainage", MilestoneDependencyType.ProgressThreshold, 50);

        // M11 -> depends on M7=100%, M8=80%, M10=80% (mixed)
        AddDep("Superstructure Construction", "Roads & External Development", MilestoneDependencyType.CompletionBased);
        AddDep("Water Supply Infrastructure", "Roads & External Development", MilestoneDependencyType.ProgressThreshold, 80);
        AddDep("Sewerage & Drainage", "Roads & External Development", MilestoneDependencyType.ProgressThreshold, 80);

        // M12 -> depends on M11 at 70%
        AddDep("Roads & External Development", "Landscaping", MilestoneDependencyType.ProgressThreshold, 70);

        // M13 -> depends on M11=100%, M12=100%, M8=100%, M9=100%, M10=100%
        AddDep("Roads & External Development", "Quality Inspection & Handover", MilestoneDependencyType.CompletionBased);
        AddDep("Landscaping", "Quality Inspection & Handover", MilestoneDependencyType.CompletionBased);
        AddDep("Water Supply Infrastructure", "Quality Inspection & Handover", MilestoneDependencyType.CompletionBased);
        AddDep("Electrical Infrastructure", "Quality Inspection & Handover", MilestoneDependencyType.CompletionBased);
        AddDep("Sewerage & Drainage", "Quality Inspection & Handover", MilestoneDependencyType.CompletionBased);

        foreach (var dep in dependencies)
        {
            var exists = await context.MilestoneDependencies.AnyAsync(
                d => d.ProjectId == dep.ProjectId
                  && d.PrerequisiteMilestoneId == dep.PrerequisiteMilestoneId
                  && d.DependentMilestoneId == dep.DependentMilestoneId, ct);
            if (!exists)
            {
                dep.SetCreatedBy(SeedConstants.SeedUser);
                await context.MilestoneDependencies.AddAsync(dep, ct);
            }
        }

        await context.SaveChangesAsync(ct);
    }

    private static MilestoneSpec[] GetMilestoneSpecs(Project project, List<Department> departments)
    {
        Guid Dept(string code) => departments.FirstOrDefault(d => d.Code == code)?.Id ?? departments.First().Id;
        var start = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        return new[]
        {
            new MilestoneSpec("Land Acquisition & Site Readiness", "Land ownership verification, physical survey, and handover to PWD", new DateTime(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc), 1, Dept("REV"), 30),
            new MilestoneSpec("Master Planning & Design", "Master layout preparation, building design and drawing approval", new DateTime(2026, 8, 31, 0, 0, 0, DateTimeKind.Utc), 2, Dept("APC"), 0),
            new MilestoneSpec("Statutory Approvals", "Building plan approval, development permission and documentation", new DateTime(2026, 9, 30, 0, 0, 0, DateTimeKind.Utc), 3, Dept("TCP"), 0),
            new MilestoneSpec("Tendering & Contractor Selection", "BOQ preparation, tender publication, bid evaluation and contract award", new DateTime(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc), 4, Dept("PROC"), 0),
            new MilestoneSpec("Site Preparation", "Temporary site office, site clearance and construction mobilization", new DateTime(2026, 11, 20, 0, 0, 0, DateTimeKind.Utc), 5, Dept("PWDC"), 0),
            new MilestoneSpec("Foundation Construction", "Excavation, PCC, reinforcement and foundation concrete", new DateTime(2027, 1, 31, 0, 0, 0, DateTimeKind.Utc), 6, Dept("PWDC"), 0),
            new MilestoneSpec("Superstructure Construction", "Columns, beams, slabs, brickwork, staircases and roofing", new DateTime(2027, 7, 31, 0, 0, 0, DateTimeKind.Utc), 7, Dept("PWDC"), 0),
            new MilestoneSpec("Water Supply Infrastructure", "Water pipeline, pump house, overhead tank and internal plumbing", new DateTime(2027, 8, 30, 0, 0, 0, DateTimeKind.Utc), 8, Dept("JAL"), 0),
            new MilestoneSpec("Electrical Infrastructure", "Transformer, HT/LT cables, internal wiring and street lighting", new DateTime(2027, 9, 15, 0, 0, 0, DateTimeKind.Utc), 9, Dept("ELEC"), 0),
            new MilestoneSpec("Sewerage & Drainage", "Sewer pipeline, manholes, storm drains and STP connection", new DateTime(2027, 9, 30, 0, 0, 0, DateTimeKind.Utc), 10, Dept("SEW"), 0),
            new MilestoneSpec("Roads & External Development", "Internal roads, footpaths, kerbs, parking and road marking", new DateTime(2027, 10, 31, 0, 0, 0, DateTimeKind.Utc), 11, Dept("PWDC"), 0),
            new MilestoneSpec("Landscaping", "Lawn, plantation, irrigation, children's park and benches", new DateTime(2027, 11, 20, 0, 0, 0, DateTimeKind.Utc), 12, Dept("HORT"), 0),
            new MilestoneSpec("Quality Inspection & Handover", "Material testing, structural audit, snag correction and handover report", new DateTime(2027, 12, 31, 0, 0, 0, DateTimeKind.Utc), 13, Dept("QA"), 0),
        };
    }

    private sealed record MilestoneSpec(string Name, string Description, DateTime DueDate, int Order, Guid DepartmentId, double Progress);
}
