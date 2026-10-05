using System.Text.Json;

namespace PMWDS.Tests.Infrastructure;

/// <summary>
/// Creates the exact object graph the React "New Project" wizard creates.
/// </summary>
/// <remarks>
/// <c>Client/src/pages/NewProject/NewProjectPage.tsx</c> keeps steps 1-4 as local state and
/// issues every write from <c>handleFinish</c> in a fixed order:
/// <list type="number">
///   <item><c>POST /api/v1/projects</c></item>
///   <item><c>POST /api/v1/milestones</c> for each milestone, sequentially</item>
///   <item><c>POST /api/v1/milestones/dependencies</c> for each dependency</item>
///   <item><c>POST /api/v1/tasks</c> (legacy non-executive flow only)</item>
/// </list>
/// Reproducing that order here means the tests cover the sequence the product actually
/// performs, including the fact that milestone ids have to be captured as they are created
/// before dependencies can reference them.
/// </remarks>
public sealed class WizardBuilder
{
    private readonly ApiClient _client;
    private readonly List<MilestonePlan> _milestones = new();
    private readonly List<DependencyPlan> _dependencies = new();
    private readonly List<TaskPlan> _tasks = new();

    private string _name = "Integration Test Project";
    private string _code = string.Empty;
    private string _description = "Created by the integration suite.";
    private string _category = "Monitoring";
    private DateTime _start = new(2026, 1, 1);
    private DateTime _end = new(2026, 12, 31);
    private decimal _budget = 1_000_000m;
    private string _priority = "Medium";
    private Guid? _primaryDepartmentId;
    private readonly List<Guid> _departmentIds = new();

    public WizardBuilder(ApiClient client) => _client = client;

    public WizardBuilder WithName(string name)
    {
        _name = name;
        return this;
    }

    public WizardBuilder WithCode(string code)
    {
        _code = code;
        return this;
    }

    public WizardBuilder WithDescription(string description)
    {
        _description = description;
        return this;
    }

    public WizardBuilder WithBudget(decimal budget)
    {
        _budget = budget;
        return this;
    }

    public WizardBuilder WithDates(DateTime start, DateTime end)
    {
        _start = start;
        _end = end;
        return this;
    }

    public WizardBuilder WithPriority(string priority)
    {
        _priority = priority;
        return this;
    }

    /// <summary>Primary department plus any additional departments.</summary>
    public WizardBuilder WithDepartments(Guid primary, params Guid[] additional)
    {
        _primaryDepartmentId = primary;
        _departmentIds.Clear();
        _departmentIds.Add(primary);
        _departmentIds.AddRange(additional);
        return this;
    }

    public WizardBuilder WithMilestone(string name, DateTime dueDate, Guid? departmentId = null, bool isCritical = false)
    {
        _milestones.Add(new MilestonePlan(name, $"Milestone {name}", dueDate, departmentId, isCritical));
        return this;
    }

    /// <summary>Dependency expressed by milestone *name*, resolved to ids at build time.</summary>
    public WizardBuilder WithMilestoneDependency(string prerequisiteName, string dependentName, string type = "CompletionBased", double? threshold = null)
    {
        _dependencies.Add(new DependencyPlan(prerequisiteName, dependentName, type, threshold));
        return this;
    }

    public WizardBuilder WithTask(string title, DateTime start, DateTime dueDate, string? milestoneName = null, string? assigneeId = null)
    {
        _tasks.Add(new TaskPlan(title, "Created by the integration suite.", start, dueDate, milestoneName, assigneeId));
        return this;
    }

    /// <summary>
    /// Runs the wizard sequence and returns the created graph. Throws on the first failed
    /// call so a partial graph is never mistaken for success.
    /// </summary>
    public async Task<WizardResult> BuildAsync()
    {
        if (_primaryDepartmentId is null)
        {
            throw new InvalidOperationException(
                "The wizard refuses to finish without a department. Call WithDepartments first.");
        }

        var code = string.IsNullOrEmpty(_code)
            ? $"IT-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}"
            : _code;

        // Step 1: project
        var project = await _client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = code,
            name = _name,
            description = _description,
            category = _category,
            plannedStartDate = _start,
            plannedEndDate = _end,
            plannedBudget = _budget,
            departmentId = _primaryDepartmentId.Value,
            departmentIds = _departmentIds,
            projectManagerId = string.Empty,
            priority = _priority,
        });

        project.ThrowIfFailed("create project");

        var projectId = project.Data!.GetProperty("id").GetGuid();
        var milestoneIds = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        var createdMilestones = new List<Guid>();

        // Step 2: milestones, sequentially, capturing ids as we go
        foreach (var milestone in _milestones)
        {
            var created = await _client.PostAsync<JsonElement>("/api/v1/milestones", new
            {
                projectId,
                name = milestone.Name,
                description = milestone.Description,
                dueDate = milestone.DueDate,
                order = createdMilestones.Count,
                departmentId = milestone.DepartmentId,
                isCritical = milestone.IsCritical,
            });

            created.ThrowIfFailed($"create milestone '{milestone.Name}'");

            var id = created.Data!.GetProperty("id").GetGuid();
            createdMilestones.Add(id);
            milestoneIds[milestone.Name] = id;
        }

        // Step 3: milestone dependencies
        var createdDependencies = new List<Guid>();
        foreach (var dependency in _dependencies)
        {
            if (!milestoneIds.TryGetValue(dependency.PrerequisiteName, out var prerequisite) ||
                !milestoneIds.TryGetValue(dependency.DependentName, out var dependent))
            {
                throw new InvalidOperationException(
                    $"Dependency references unknown milestone(s) " +
                    $"'{dependency.PrerequisiteName}' -> '{dependency.DependentName}'. " +
                    "Declare them with WithMilestone first.");
            }

            var created = await _client.PostAsync<JsonElement>("/api/v1/milestones/dependencies", new
            {
                projectId,
                prerequisiteMilestoneId = prerequisite,
                dependentMilestoneId = dependent,
                type = dependency.Type,
                thresholdPercentage = dependency.Type == "ProgressThreshold"
                    ? dependency.Threshold ?? 50
                    : (double?)null,
            });

            created.ThrowIfFailed("create milestone dependency");
            createdDependencies.Add(created.Data!.GetProperty("id").GetGuid());
        }

        // Step 4: tasks (legacy flow only, but worth covering)
        var createdTasks = new List<Guid>();
        foreach (var task in _tasks)
        {
            Guid? milestoneId = null;
            if (task.MilestoneName is not null && milestoneIds.TryGetValue(task.MilestoneName, out var resolved))
            {
                milestoneId = resolved;
            }

            var created = await _client.PostAsync<JsonElement>("/api/v1/tasks", new
            {
                title = task.Title,
                description = task.Description,
                startDate = task.StartDate,
                dueDate = task.DueDate,
                estimatedHours = 8f,
                projectId,
                milestoneId,
                assignedToUserId = task.AssigneeId,
                priority = "Medium",
                assignedToUserIds = task.AssigneeId is null ? null : new[] { task.AssigneeId },
            });

            created.ThrowIfFailed($"create task '{task.Title}'");
            createdTasks.Add(created.Data!.GetProperty("id").GetGuid());
        }

        return new WizardResult(projectId, code, createdMilestones, createdDependencies, createdTasks);
    }

    private sealed record MilestonePlan(string Name, string Description, DateTime DueDate, Guid? DepartmentId, bool IsCritical);
    private sealed record DependencyPlan(string PrerequisiteName, string DependentName, string Type, double? Threshold);
    private sealed record TaskPlan(string Title, string Description, DateTime StartDate, DateTime DueDate, string? MilestoneName, string? AssigneeId);
}

public sealed record WizardResult(
    Guid ProjectId,
    string ProjectCode,
    IReadOnlyList<Guid> MilestoneIds,
    IReadOnlyList<Guid> DependencyIds,
    IReadOnlyList<Guid> TaskIds);

public static class ResultAssertions
{
    /// <summary>Throws with the API's own error message, so failures read like server errors.</summary>
    public static void ThrowIfFailed<T>(this Result<T> result, string what)
    {
        if (result.IsSuccess)
        {
            return;
        }

        var details = result.ErrorDetails is { Count: > 0 }
            ? " | " + string.Join("; ", result.ErrorDetails.Select(d => $"{d.Key}: {string.Join(", ", d.Value)}"))
            : string.Empty;

        throw new InvalidOperationException(
            $"Expected to succeed at '{what}' but got {(int)result.Status} " +
            $"[{result.ErrorCode}]: {result.ErrorMessage}{details}");
    }
}

public static class JsonExtensions
{
    public static Guid GetGuid(this JsonElement element, string property)
        => element.GetProperty(property).GetGuid();

    public static string GetString(this JsonElement element, string property)
        => element.GetProperty(property).GetString() ?? string.Empty;

    /// <summary>
    /// True when the property is absent or explicitly null.
    /// </summary>
    /// <remarks>
    /// The API is configured with <c>DefaultIgnoreCondition = WhenWritingNull</c>, so a null
    /// reference is omitted from the payload rather than serialised as <c>null</c>. Reading
    /// such a property with <c>GetProperty</c> throws KeyNotFoundException, which is a trap
    /// worth encoding once here.
    /// </remarks>
    public static bool IsAbsentOrNull(this JsonElement element, string property)
        => !element.TryGetProperty(property, out var value) ||
           value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined;
}
