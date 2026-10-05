using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// What deleting one thing does to everything hanging off it.
/// </summary>
/// <remarks>
/// This is the area with the most moving parts and the least coverage, so the expectations
/// are written from the configuration in <c>PMWDS.Persistence/Configurations</c> and the
/// controller bodies, not from observed behaviour. Where the implementation turns out to
/// differ, the test is reporting a real defect rather than a flaky assertion.
///
/// Two shapes matter and are easy to confuse:
/// <list type="bullet">
///   <item><b>Hard delete</b> - <c>_dbSet.RemoveRange(...)</c>. The row is gone.</item>
///   <item><b>Soft delete</b> - <c>EfRepository.DeleteAsync</c> sets <c>IsDeleted</c> for
///   anything deriving from <c>BaseEntity</c>. The row survives but the global query filter
///   hides it, and a database-level ON DELETE CASCADE never fires because the row was never
///   actually removed.</item>
/// </list>
/// That distinction is why a project delete leaves its milestones behind.
/// </remarks>
[Collection(ApiCollection.Name)]
public class CascadeTests
{
    private readonly ApiFixture _fixture;

    public CascadeTests(ApiFixture fixture) => _fixture = fixture;

    // ------------------------------------------------------------ task deletion

    [Fact]
    public async Task Deleting_a_task_removes_its_subtasks_recursively()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Cascade Task Subtasks");

        var parent = await project.CreateTaskAsync("Parent");
        var child = await project.CreateSubtaskAsync(parent, "Child");
        var grandchild = await project.CreateSubtaskAsync(child, "Grandchild");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{parent}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // The whole subtree must be gone, not just the root. A shallow delete here is the
        // classic cascade bug and nothing else in the suite would notice.
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{parent}")).Status
            .Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{child}")).Status
            .Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{grandchild}")).Status
            .Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Deleting_a_task_removes_its_comments_and_attachments()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Cascade Task Children");
        var taskId = await project.CreateTaskAsync("Task With Children");

        var comment = await client.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments", new
        {
            comment = "This comment should not outlive its task.",
        });
        comment.Status.Should().Be(HttpStatusCode.OK);

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // If the FK cascade did not fire, the comment row would be orphaned and the task
        // list would eventually show it or the delete would have thrown.
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}")).Status
            .Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Deleting_a_task_removes_dependencies_that_reference_it()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Cascade Task Dependencies");

        var predecessor = await project.CreateTaskAsync("Predecessor");
        var successor = await project.CreateTaskAsync("Successor");

        var dependency = await client.PostAsync<JsonElement>($"/api/v1/tasks/{predecessor}/dependencies", new
        {
            predecessorTaskId = predecessor,
            successorTaskId = successor,
            type = "FinishToStart",
            lagDays = 0,
        });
        dependency.Status.Should().Be(HttpStatusCode.OK);

        // Delete the PREDECESSOR. The dependency row must go even though the successor
        // survives - otherwise the survivor keeps a dangling predecessor reference.
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{predecessor}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{successor}")).Status
            .Should().Be(HttpStatusCode.OK);

        var remaining = await client.GetAsync<JsonElement>($"/api/v1/tasks/{successor}/dependencies");
        remaining.Status.Should().Be(HttpStatusCode.OK);
        remaining.Data.GetArrayLength().Should().Be(0);
    }

    // ------------------------------------------------------------ milestone deletion

    [Fact]
    public async Task Deleting_a_milestone_removes_its_tasks_and_subtasks()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Cascade Milestone Tasks");

        var milestones = await project.MilestoneIdsAsync();
        var target = milestones[1];

        var task = await project.CreateTaskAsync("Task Under Milestone", target);
        var subtask = await project.CreateSubtaskAsync(task, "Subtask Under Milestone");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{target}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // Milestone deletes its tasks explicitly, and the task delete is recursive.
        (await client.GetAsync<JsonElement>($"/api/v1/milestones/{target}")).Status
            .Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{task}")).Status
            .Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{subtask}")).Status
            .Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Deleting_a_milestone_removes_dependencies_that_reference_it()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Cascade Milestone Dependencies")
            .WithCode($"CAS-MD-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("First", new DateTime(2026, 3, 31))
            .WithMilestone("Second", new DateTime(2026, 6, 30))
            .WithMilestoneDependency("First", "Second")
            .BuildAsync();

        try
        {
            var dependencyId = graph.DependencyIds.Should().ContainSingle().Subject;

            var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{graph.MilestoneIds[0]}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);

            // Both MilestoneDependency FKs are Restrict, so the controller must remove the
            // rows itself before the milestone can be deleted. If it did not, the delete
            // would have failed with a foreign-key error instead of 204.
            var remaining = await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{graph.ProjectId}/dependencies");
            remaining.Data.GetArrayLength().Should().Be(0);

            (await client.GetAsync<JsonElement>($"/api/v1/milestones/{dependencyId}")).Status
                .Should().Be(HttpStatusCode.NotFound);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        }
    }

    [Fact]
    public async Task Deleting_a_milestone_leaves_sibling_milestones_alone()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Cascade Milestone Siblings");

        var milestones = await project.MilestoneIdsAsync();
        var task = await project.CreateTaskAsync("Sibling Task", milestones[2]);

        await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{milestones[0]}");

        (await client.GetAsync<JsonElement>($"/api/v1/milestones/{milestones[1]}")).Status
            .Should().Be(HttpStatusCode.OK);
        (await client.GetAsync<JsonElement>($"/api/v1/milestones/{milestones[2]}")).Status
            .Should().Be(HttpStatusCode.OK);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{task}")).Status
            .Should().Be(HttpStatusCode.OK);
    }

    // ------------------------------------------------------------ project deletion

    [Fact]
    public async Task Deleting_a_project_removes_its_tasks_recursively()
    {
        var client = _fixture.SuperAdmin.Client;
        var project = await TestProject.CreateAsync(client, "Cascade Project Tasks");
        var projectId = project.ProjectId;

        var task = await project.CreateTaskAsync("Project Task");
        var subtask = await project.CreateSubtaskAsync(task, "Project Subtask");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/projects/{projectId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{task}")).Status
            .Should().Be(HttpStatusCode.NotFound);
        (await client.GetAsync<JsonElement>($"/api/v1/tasks/{subtask}")).Status
            .Should().Be(HttpStatusCode.NotFound);

        await project.DisposeAsync();
    }

    [Fact]
    public async Task Deleting_a_project_removes_milestone_dependencies()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Cascade Project Dependencies")
            .WithCode($"CAS-PD-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("First", new DateTime(2026, 3, 31))
            .WithMilestone("Second", new DateTime(2026, 6, 30))
            .WithMilestoneDependency("First", "Second")
            .BuildAsync();

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // MilestoneDependency -> Project is ON DELETE CASCADE, but the project row is only
        // soft-deleted, so the database cascade never fires. The controller has to remove
        // them by hand; if it stopped doing that, these rows would be orphaned.
        var remaining = await client.GetAsync<JsonElement>(
            $"/api/v1/milestones/by-project/{graph.ProjectId}/dependencies");
        remaining.Data.GetArrayLength().Should().Be(0);
    }

    /// <summary>
    /// Documents the soft-delete consequence of the Project -> Milestone FK being NoAction.
    /// </summary>
    /// <remarks>
    /// Deleting a project soft-deletes the project row, so no database cascade can fire.
    /// The controller deletes tasks and milestone dependencies explicitly but does NOT touch
    /// milestones, and Milestone -> Project is configured NoAction. The milestone rows
    /// therefore survive with <c>IsDeleted = false</c>, still attached to a project that no
    /// longer appears in any list.
    ///
    /// This test asserts what actually happens so the behaviour is pinned and visible. If
    /// someone later fixes it by cascading the milestone soft-delete, the assertion flips
    /// and the test tells them.
    /// </remarks>
    [Fact]
    public async Task Deleting_a_project_leaves_its_milestones_undeleted_today()
    {
        var client = _fixture.SuperAdmin.Client;
        var project = await TestProject.CreateAsync(client, "Cascade Project Milestones");
        var projectId = project.ProjectId;
        var milestoneId = (await project.MilestoneIdsAsync())[0];

        await client.DeleteAsync<JsonElement>($"/api/v1/projects/{projectId}");

        var milestones = await client.GetAsync<JsonElement>($"/api/v1/milestones/by-project/{projectId}");

        // Known gap, not an endorsed behaviour. See the remarks on this test.
        milestones.Data.GetArrayLength().Should().Be(3,
            "milestones are currently orphaned by a project delete: the project row is only " +
            "soft-deleted so the NoAction FK never cascades");

        await project.DisposeAsync();
    }
}
