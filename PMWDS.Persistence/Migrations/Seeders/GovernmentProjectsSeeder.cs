using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Migrations.Seeders;

/// <summary>
/// Seeds the three researched government projects - the Greater Aligarh township and ADA
/// affordable-housing allotment, the Varanasi Smart City mission-area works, and the Ganga
/// Expressway Phase-1 works - with milestones, chained milestone dependencies, tasks and
/// subtasks.
/// </summary>
/// <remarks>
/// The project data lives in <c>Data/GovernmentProjectsSeed.json</c> so the shape stays
/// reviewable without editing C#. Every row is matched by project code, title or milestone
/// order and skipped when present, so re-running never duplicates. Databases that were
/// seeded through the API already hold these rows and are unaffected.
/// </remarks>
internal static class GovernmentProjectsSeeder
{
    private const string ResourceName =
        "PMWDS.Persistence.Migrations.Seeders.Data.GovernmentProjectsSeed.json";

    internal static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct)
    {
        var specs = LoadSpecs();
        if (specs.Count == 0) return;

        var departments = await context.Departments.ToListAsync(ct);
        var users = await context.Users.ToListAsync(ct);
        if (departments.Count == 0 || users.Count == 0) return;

        var managerId = users.FirstOrDefault(u => u.EmployeeCode == "CE001")?.Id ?? users.First().Id;

        foreach (var spec in specs)
        {
            if (await context.Projects.AnyAsync(p => p.ProjectCode == spec.ProjectCode, ct))
                continue;

            await SeedProjectAsync(context, spec, departments, managerId, ct);
        }

        await context.SaveChangesAsync(ct);
    }

    private static async Task SeedProjectAsync(
        ApplicationDbContext context,
        ProjectSpec spec,
        List<Department> departments,
        Guid managerId,
        CancellationToken ct)
    {
        var projectDepartments = PickDepartments(spec, departments);
        var budget = Math.Round(spec.PlannedBudgetCrore * 10_000_000m);

        var project = Project.Create(
            spec.Name,
            spec.Description,
            spec.Category,
            ProjectPriority.High,
            projectDepartments[0].Id,
            managerId,
            new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2028, 12, 20, 0, 0, 0, DateTimeKind.Utc),
            budget,
            spec.Authority,
            spec.ProjectCode);
        project.AssignDepartments(projectDepartments.Select(d => d.Id));
        project.SetCreatedBy(SeedConstants.SeedUser);
        await context.Projects.AddAsync(project, ct);

        var milestones = new List<Milestone>();
        var order = 0;
        foreach (var milestoneSpec in spec.Milestones)
        {
            var milestone = Milestone.Create(
                project.Id,
                milestoneSpec.Name,
                milestoneSpec.Description,
                AsUtc(milestoneSpec.DueDate),
                order++,
                milestoneSpec.IsCritical,
                PickMilestoneDepartment(milestoneSpec.Name, projectDepartments));
            milestone.SetCreatedBy(SeedConstants.SeedUser);
            await context.Milestones.AddAsync(milestone, ct);
            milestones.Add(milestone);
        }

        // Chain each milestone to the one before it, mirroring the wizard's dependency step.
        for (var i = 1; i < milestones.Count; i++)
        {
            var dependency = MilestoneDependency.Create(
                project.Id,
                milestones[i - 1].Id,
                milestones[i].Id,
                MilestoneDependencyType.CompletionBased);
            dependency.SetCreatedBy(SeedConstants.SeedUser);
            await context.MilestoneDependencies.AddAsync(dependency, ct);
        }

        for (var i = 0; i < spec.Milestones.Count; i++)
        {
            foreach (var taskSpec in spec.Milestones[i].Tasks)
            {
                var task = ProjectTask.Create(
                    project.Id,
                    taskSpec.Title,
                    taskSpec.Description,
                    ParsePriority(taskSpec.Priority),
                    AsUtc(taskSpec.StartDate),
                    AsUtc(taskSpec.DueDate),
                    (int)Math.Round(taskSpec.EstimatedHours),
                    milestones[i].Id,
                    parentTaskId: null);
                task.SetCreatedBy(SeedConstants.SeedUser);
                await context.Tasks.AddAsync(task, ct);

                foreach (var subtaskSpec in taskSpec.Subtasks)
                {
                    var subtask = ProjectTask.Create(
                        project.Id,
                        subtaskSpec.Title,
                        subtaskSpec.Description,
                        ParsePriority(taskSpec.Priority),
                        AsUtc(taskSpec.StartDate),
                        AsUtc(taskSpec.DueDate),
                        (int)Math.Round(subtaskSpec.EstimatedHours),
                        milestones[i].Id,
                        task.Id);
                    subtask.SetCreatedBy(SeedConstants.SeedUser);
                    await context.Tasks.AddAsync(subtask, ct);
                }
            }
        }
    }

    /// <summary>
    /// The seeded departments closest to the project's real-world authority. The real
    /// authority (ADA, Varanasi Smart City Ltd, UPEIDA) is preserved in the project's
    /// description and client name; these are the in-system departments that own the work.
    /// </summary>
    private static List<Department> PickDepartments(ProjectSpec spec, List<Department> departments)
    {
        var haystack = $"{spec.Authority} {spec.Name} {spec.Category}";
        var codes = new List<string>();

        void Add(params string[] preferred)
        {
            foreach (var code in preferred)
            {
                if (!codes.Contains(code)) codes.Add(code);
            }
        }

        if (Regex.IsMatch(haystack, "housing|colon(y|ies)|residential|awas|township|allotment|rera", RegexOptions.IgnoreCase))
            Add("APC", "TCP", "PWD");
        if (Regex.IsMatch(haystack, "smart ?city|surveillance|traffic|urban|heritage|ghat|command", RegexOptions.IgnoreCase))
            Add("APC", "TCP", "ELEC");
        if (Regex.IsMatch(haystack, "water|sewer|jal|nigam|drainage", RegexOptions.IgnoreCase))
            Add("JAL", "SEW");
        if (Regex.IsMatch(haystack, "road|highway|expressway|transport|bridge|carriageway|toll|upeida", RegexOptions.IgnoreCase))
            Add("PWD", "PWDC", "PROC");
        if (Regex.IsMatch(haystack, "electric|power|transmission|substation", RegexOptions.IgnoreCase))
            Add("ELEC");
        if (Regex.IsMatch(haystack, "industrial|corridor|factory|logistics", RegexOptions.IgnoreCase))
            Add("PROC", "TCP");
        if (codes.Count == 0)
            Add("PWD", "PROC");

        var matched = codes
            .Select(code => departments.FirstOrDefault(d => d.Code == code))
            .Where(department => department is not null)
            .Cast<Department>()
            .ToList();

        return matched.Count > 0 ? matched : new List<Department> { departments.First() };
    }

    /// <summary>
    /// Best-effort owning department for a milestone, constrained to the project's own
    /// departments so the seed can never reference a department the project does not own.
    /// Returns null when nothing matches clearly.
    /// </summary>
    private static Guid? PickMilestoneDepartment(string milestoneName, List<Department> projectDepartments)
    {
        var codes = projectDepartments.Select(d => d.Code).ToHashSet();
        Guid? Department(string code) => projectDepartments.FirstOrDefault(d => d.Code == code)?.Id;

        var matches = new List<(string Pattern, string Code)>
        {
            ("land|revenue|cadastral|registry|title|allotment", "REV"),
            ("layout|design|master plan|planning", "APC"),
            ("approval|rera|statutory|noc|certification|audit", "TCP"),
            ("tender|contract|procurement|bid|documentation|subsidy|claim", "PROC"),
            ("site preparation|foundation|superstructure|structural|rcc|masonry|slab|plinth|housing block|building", "PWDC"),
            ("water|pipeline|hydrotesting|plumbing", "JAL"),
            ("sewer|drain|manhole", "SEW"),
            ("electr|streetlight|transformer|power|ups|solar", "ELEC"),
            ("road|bridge|carriageway|toll|parking|footpath|junction|marking|gantry|shoulder", "PWD"),
            ("park|landscape|plantation|horticulture|play area", "HORT"),
            ("quality|inspection|safety|handover|snag|testing", "QA"),
        };

        foreach (var (pattern, code) in matches)
        {
            if (codes.Contains(code) && Regex.IsMatch(milestoneName, pattern, RegexOptions.IgnoreCase))
                return Department(code);
        }

        return null;
    }

    private static IReadOnlyList<ProjectSpec> LoadSpecs()
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        using var stream = typeof(GovernmentProjectsSeeder).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException(
                $"Seed data resource '{ResourceName}' was not embedded. Check the EmbeddedResource entry in PMWDS.Persistence.csproj.");
        var file = JsonSerializer.Deserialize<SeedFile>(stream, options);
        return file?.Projects ?? Array.Empty<ProjectSpec>();
    }

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static TaskPriority ParsePriority(string? priority)
        => Enum.TryParse<TaskPriority>(priority, ignoreCase: true, out var parsed)
            ? parsed
            : TaskPriority.Medium;

    private sealed record SeedFile(IReadOnlyList<ProjectSpec> Projects);

    private sealed record ProjectSpec(
        string ProjectCode,
        string Name,
        string Description,
        string Category,
        decimal PlannedBudgetCrore,
        string Authority,
        IReadOnlyList<MilestoneSpec> Milestones);

    private sealed record MilestoneSpec(
        string Name,
        string Description,
        DateTime DueDate,
        bool IsCritical,
        IReadOnlyList<TaskSpec> Tasks);

    private sealed record TaskSpec(
        string Title,
        string Description,
        DateTime StartDate,
        DateTime DueDate,
        double EstimatedHours,
        string Priority,
        IReadOnlyList<SubtaskSpec> Subtasks);

    private sealed record SubtaskSpec(
        string Title,
        string Description,
        double EstimatedHours);
}
