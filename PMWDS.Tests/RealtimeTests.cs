using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// The live-update path: a mutation on the server must push a <c>DataChanged</c> event to
/// every connected client.
/// </summary>
/// <remarks>
/// This is the regression guard for the original bug - two browsers not seeing each other's
/// edits until a manual reload. Before this feature the server published nothing at all and
/// the client had no subscription and no refetch trigger, so the failure mode was silent:
/// everything still worked, just stale.
///
/// Every wait is filtered by scope rather than by draining a backlog. The wizard emits
/// several announcements in quick succession, so filtering is what makes these tests
/// deterministic instead of sleep-dependent.
/// </remarks>
[Collection(ApiCollection.Name)]
public class RealtimeTests
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(20);

    private readonly ApiFixture _fixture;

    public RealtimeTests(ApiFixture fixture) => _fixture = fixture;

    private Task<HubListener> ListenAsync()
        => HubListener.StartAsync(
            _fixture.HubBaseAddress,
            _fixture.SuperAdmin.Client.Token!,
            _fixture.HubHandlerFactory,
            Wait);

    [Fact]
    public async Task Connecting_to_the_dashboard_hub_succeeds()
    {
        await using var listener = await ListenAsync();

        listener.Drain().Should().BeEmpty("a fresh connection receives no backlog");
    }

    [Fact]
    public async Task Creating_a_project_broadcasts_a_data_changed_event()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var result = await new WizardBuilder(client)
            .WithName("Realtime Project")
            .WithCode($"RT-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .BuildAsync();

        try
        {
            var notification = await listener.WaitForScopeAsync("projects");

            notification.Should().NotBeNull(
                "creating a project must push a DataChanged event - this is what makes a " +
                "second browser update without a reload");

            notification!.Value.GetProperty("entityId").GetString().Should().Be(result.ProjectId.ToString());
            notification.Value.GetProperty("projectId").GetString().Should().Be(result.ProjectId.ToString());
            notification.Value.GetProperty("occurredAt").GetString().Should().NotBeNullOrWhiteSpace();
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
        }
    }

    [Fact]
    public async Task Creating_a_milestone_broadcasts_for_the_milestones_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(
            client, "Realtime Milestone Project", withMilestones: false);

        var created = await client.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId = project.ProjectId,
            name = "Realtime Milestone",
            description = "Created by the suite.",
            dueDate = new DateTime(2026, 9, 30),
            order = 9,
            isCritical = false,
        });

        created.Status.Should().Be(System.Net.HttpStatusCode.Created);

        var notification = await listener.WaitForScopeAsync("milestones");
        notification.Should().NotBeNull();
        notification!.Value.GetProperty("entityId").GetString()
            .Should().Be(created.Data.GetGuid("id").ToString());
    }

    [Fact]
    public async Task Creating_a_milestone_dependency_broadcasts_for_the_milestones_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Realtime Dependency Project")
            .WithCode($"RTD-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("First", new DateTime(2026, 3, 31))
            .WithMilestone("Second", new DateTime(2026, 6, 30))
            .BuildAsync();

        try
        {
            // The wizard already announced both milestones; clear them so the wait below
            // can only match the dependency announcement.
            await listener.SettleAndDrainAsync();

            var milestones = (await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{graph.ProjectId}"))
                .Data.EnumerateArray().Select(m => m.GetGuid("id")).ToList();

            var dependency = await client.PostAsync<JsonElement>("/api/v1/milestones/dependencies", new
            {
                projectId = graph.ProjectId,
                prerequisiteMilestoneId = milestones[0],
                dependentMilestoneId = milestones[1],
                type = "CompletionBased",
                thresholdPercentage = (double?)null,
            });

            dependency.Status.Should().Be(System.Net.HttpStatusCode.OK);

            var notification = await listener.WaitForScopeAsync("milestones");
            notification.Should().NotBeNull();
            notification!.Value.GetProperty("entityId").GetString()
                .Should().Be(dependency.Data.GetGuid("id").ToString());
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        }
    }

    [Fact]
    public async Task Creating_a_task_broadcasts_for_the_tasks_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Realtime Task Project");

        var taskId = await project.CreateTaskAsync("Realtime Task");

        var notification = await listener.WaitForScopeAsync("tasks");
        notification.Should().NotBeNull();
        notification!.Value.GetProperty("entityId").GetString().Should().Be(taskId.ToString());
    }

    [Fact]
    public async Task Uploading_a_document_broadcasts_for_the_documents_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Realtime Document Project");

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes("%PDF-1.4"));
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "realtime.pdf");
        form.Add(new StringContent("General"), "category");

        var uploaded = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents", form);
        uploaded.Status.Should().Be(System.Net.HttpStatusCode.OK);

        var notification = await listener.WaitForScopeAsync("documents");
        notification.Should().NotBeNull();
        notification!.Value.GetProperty("projectId").GetString()
            .Should().Be(project.ProjectId.ToString());
    }

    /// <summary>
    /// One mutation can touch several scopes - deleting a project also deletes its tasks and
    /// milestone dependencies - and the client keys its refetch off the scope, so every
    /// affected scope has to be announced.
    /// </summary>
    [Fact]
    public async Task Deleting_a_project_broadcasts_every_affected_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Realtime Cascade Project")
            .WithCode($"RTC-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("First", new DateTime(2026, 3, 31))
            .WithMilestone("Second", new DateTime(2026, 6, 30))
            .WithMilestoneDependency("First", "Second")
            .BuildAsync();

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        deleted.Status.Should().Be(System.Net.HttpStatusCode.NoContent);

        // The controller notifies projects, milestones, tasks and documents.
        (await listener.WaitForScopeAsync("projects")).Should().NotBeNull();
        (await listener.WaitForScopeAsync("milestones")).Should().NotBeNull();
        (await listener.WaitForScopeAsync("tasks")).Should().NotBeNull();
        (await listener.WaitForScopeAsync("documents")).Should().NotBeNull();
    }

    [Fact]
    public async Task Deleting_a_task_broadcasts_for_tasks_milestones_and_projects()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(
            client, "Realtime Task Delete Project", withMilestones: false);

        var milestoneId = (await WizardBuilderMilestoneAsync(client, project)).ToArray();
        var taskId = await project.CreateTaskAsync("Task To Delete", milestoneId[0]);

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        deleted.Status.Should().Be(System.Net.HttpStatusCode.NoContent);

        (await listener.WaitForScopeAsync("tasks")).Should().NotBeNull();
        (await listener.WaitForScopeAsync("milestones")).Should().NotBeNull("the parent milestone is recalculated");
        (await listener.WaitForScopeAsync("projects")).Should().NotBeNull("the project rollup changes");
    }

    [Fact]
    public async Task Adding_a_task_comment_broadcasts_for_the_tasks_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Realtime Comment Project");

        var taskId = await project.CreateTaskAsync("Commented Task");

        var commented = await client.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments", new
        {
            comment = "Visible in other browsers too.",
        });

        commented.Status.Should().Be(System.Net.HttpStatusCode.OK);

        var notification = await listener.WaitForScopeAsync("tasks");
        notification.Should().NotBeNull("a comment appears on the task detail view in other browsers");
    }

    [Fact]
    public async Task Updating_a_milestone_broadcasts_for_milestones_and_projects()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Realtime Milestone Update Project");

        var milestoneId = (await project.MilestoneIdsAsync())[0];

        var updated = await client.PutAsync<JsonElement>($"/api/v1/milestones/{milestoneId}", new
        {
            name = "Renamed By Realtime Test",
            description = "Updated by the suite.",
            dueDate = new DateTime(2026, 11, 30),
            order = 1,
            isCritical = true,
            departmentId = (Guid?)null,
            progressPercentage = 10d,
        });

        updated.Status.Should().Be(System.Net.HttpStatusCode.OK);

        (await listener.WaitForScopeAsync("milestones")).Should().NotBeNull();
        (await listener.WaitForScopeAsync("projects")).Should().NotBeNull();
    }

    [Fact]
    public async Task Updating_a_task_broadcasts_for_the_tasks_scope()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Realtime Task Update Project");

        var taskId = await project.CreateTaskAsync("Task To Update");

        var updated = await client.PutAsync<JsonElement>($"/api/v1/tasks/{taskId}", new
        {
            title = "Task Updated By Realtime Test",
            description = "Updated by the suite.",
            startDate = new DateTime(2026, 1, 5),
            dueDate = new DateTime(2026, 6, 30),
            estimatedHours = 6f,
            priority = "High",
            milestoneId = (Guid?)null,
        });

        updated.Status.Should().Be(System.Net.HttpStatusCode.OK);

        (await listener.WaitForScopeAsync("tasks")).Should().NotBeNull();
    }

    /// <summary>Adds a single milestone to a project that was created without any.</summary>
    private static async Task<IReadOnlyList<Guid>> WizardBuilderMilestoneAsync(ApiClient client, TestProject project)
    {
        var created = await client.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId = project.ProjectId,
            name = "Milestone For Realtime Test",
            description = "Created by the suite.",
            dueDate = new DateTime(2026, 5, 31),
            order = 0,
            isCritical = false,
        });

        created.Status.Should().Be(System.Net.HttpStatusCode.Created);
        return new[] { created.Data.GetGuid("id") };
    }

    [Fact]
    public async Task A_rejected_mutation_broadcasts_nothing()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        // Rejected by validation, so nothing changed and nothing should be announced.
        var response = await client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = $"RTX-{Guid.NewGuid().ToString("N")[..8]}",
            name = "Backwards Dates",
            description = "Must be refused.",
            category = "Monitoring",
            plannedStartDate = new DateTime(2026, 12, 31),
            plannedEndDate = new DateTime(2026, 1, 1),
            plannedBudget = 1000m,
            departmentId = department,
            departmentIds = Array.Empty<Guid>(),
            projectManagerId = string.Empty,
            priority = "Medium",
        });

        response.Status.Should().Be(System.Net.HttpStatusCode.BadRequest);

        // If the server announced a change that did not happen, every client would refetch
        // for nothing on each rejected save.
        await Task.Delay(TimeSpan.FromSeconds(3));
        listener.Drain().Should().BeEmpty("a rejected request must not announce a change");
    }

    [Fact]
    public async Task A_failed_authorization_does_not_broadcast()
    {
        await using var listener = await ListenAsync();
        var client = _fixture.Viewer.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(_fixture.SuperAdmin.Client);

        var response = await client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = $"RTF-{Guid.NewGuid().ToString("N")[..8]}",
            name = "Viewer Attempt",
            description = "Must be refused.",
            category = "Monitoring",
            plannedStartDate = new DateTime(2026, 1, 1),
            plannedEndDate = new DateTime(2026, 12, 31),
            plannedBudget = 1000m,
            departmentId = department,
            departmentIds = new[] { department },
            projectManagerId = string.Empty,
            priority = "Medium",
        });

        response.Status.Should().Be(System.Net.HttpStatusCode.Forbidden);

        await Task.Delay(TimeSpan.FromSeconds(3));
        listener.Drain().Should().BeEmpty("a forbidden request must not announce a change");
    }
}
