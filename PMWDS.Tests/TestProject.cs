using System.Text.Json;
using PMWDS.Tests.Infrastructure;

namespace PMWDS.Tests;

/// <summary>
/// Creates and disposes a throwaway project graph so each test owns its data and cannot be
/// affected by, or affect, another test's rows.
/// </summary>
public sealed class TestProject : IAsyncDisposable
{
    private readonly ApiClient _client;

    private TestProject(ApiClient client, Guid projectId)
    {
        _client = client;
        ProjectId = projectId;
    }

    public Guid ProjectId { get; }

    /// <param name="withMilestones">
    /// When false the project is created with no milestones. Tests that assert on a
    /// milestone-specific event need the setup to be quiet, otherwise the listener can
    /// consume a setup announcement instead of the one under test.
    /// </param>
    public static async Task<TestProject> CreateAsync(
        ApiClient client,
        string name,
        Guid? departmentId = null,
        bool withMilestones = true)
    {
        var department = departmentId ?? await WizardFlowTests.FirstDepartmentAsync(client);

        var builder = new WizardBuilder(client)
            .WithName(name)
            .WithCode($"IT-{Guid.NewGuid().ToString("N")[..10]}")
            .WithDepartments(department);

        if (withMilestones)
        {
            builder
                .WithMilestone("Planning", new DateTime(2026, 2, 28))
                .WithMilestone("Execution", new DateTime(2026, 8, 31))
                .WithMilestone("Handover", new DateTime(2026, 12, 15));
        }

        var result = await builder.BuildAsync();

        return new TestProject(client, result.ProjectId);
    }

    /// <summary>Milestones created by <see cref="CreateAsync"/>, in order.</summary>
    public async Task<IReadOnlyList<Guid>> MilestoneIdsAsync()
    {
        var response = await _client.GetAsync<JsonElement>($"/api/v1/milestones/by-project/{ProjectId}");
        response.ThrowIfFailed("list milestones");

        // GET /milestones/by-project/{id} returns a bare JSON array, not the paginated
        // envelope that GET /departments and GET /tasks use.
        return response.Data.EnumerateArray()
            .OrderBy(m => m.GetProperty("order").GetInt32())
            .Select(m => m.GetGuid("id"))
            .ToList();
    }

    public async Task<Guid> CreateTaskAsync(
        string title,
        Guid? milestoneId = null,
        string? assigneeId = null,
        DateTime? dueDate = null)
    {
        var response = await _client.PostAsync<JsonElement>("/api/v1/tasks", new
        {
            title,
            description = "Created by the integration suite.",
            startDate = new DateTime(2026, 1, 5),
            dueDate = dueDate ?? new DateTime(2026, 6, 30),
            estimatedHours = 4f,
            projectId = ProjectId,
            milestoneId,
            assignedToUserId = assigneeId,
            priority = "Medium",
        });

        response.ThrowIfFailed($"create task '{title}'");
        return response.Data.GetGuid("id");
    }

    public async Task<Guid> CreateSubtaskAsync(Guid parentTaskId, string title)
    {
        var response = await _client.PostAsync<JsonElement>($"/api/v1/tasks/{parentTaskId}/subtasks", new
        {
            title,
            description = "Created by the integration suite.",
            startDate = new DateTime(2026, 1, 6),
            dueDate = new DateTime(2026, 6, 25),
            estimatedHours = 2f,
            projectId = ProjectId,
            priority = "Medium",
        });

        response.ThrowIfFailed($"create subtask '{title}'");
        return response.Data.GetGuid("id");
    }

    public async ValueTask DisposeAsync()
    {
        // Best effort: a test that already deleted the project should not fail here.
        try
        {
            await _client.DeleteAsync<JsonElement>($"/api/v1/projects/{ProjectId}");
        }
        catch
        {
            // Ignore.
        }
    }
}
