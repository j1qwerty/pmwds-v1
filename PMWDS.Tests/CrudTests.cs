using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>Create, read, update and delete for every entity the API exposes.</summary>
[Collection(ApiCollection.Name)]
public class CrudTests
{
    private readonly ApiFixture _fixture;

    public CrudTests(ApiFixture fixture) => _fixture = fixture;

    // ---------------------------------------------------------------- projects

    [Fact]
    public async Task Project_create_read_update_delete()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);
        var code = $"CRUD-P-{Guid.NewGuid().ToString("N")[..8]}";

        // create
        var created = await client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = code,
            name = "Original Name",
            description = "Before the update.",
            category = "Monitoring",
            plannedStartDate = new DateTime(2026, 1, 1),
            plannedEndDate = new DateTime(2026, 12, 31),
            plannedBudget = 500_000m,
            departmentId = department,
            departmentIds = new[] { department },
            projectManagerId = string.Empty,
            priority = "Medium",
        });

        created.Status.Should().Be(HttpStatusCode.Created);
        var projectId = created.Data.GetGuid("id");
        created.Data.GetString("name").Should().Be("Original Name");

        try
        {
            // read
            var read = await client.GetAsync<JsonElement>($"/api/v1/projects/{projectId}");
            read.Status.Should().Be(HttpStatusCode.OK);
            read.Data.GetString("name").Should().Be("Original Name");
            read.Data.GetString("projectCode").Should().Be(code);

            // update
            var updated = await client.PutAsync<JsonElement>($"/api/v1/projects/{projectId}", new
            {
                name = "Updated Name",
                description = "After the update.",
                category = "Renovation",
                plannedStartDate = new DateTime(2026, 2, 1),
                plannedEndDate = new DateTime(2027, 1, 31),
                plannedBudget = 750_000m,
                departmentId = department,
                projectManagerId = string.Empty,
                priority = "High",
            });

            updated.Status.Should().Be(HttpStatusCode.OK);

            var afterUpdate = await client.GetAsync<JsonElement>($"/api/v1/projects/{projectId}");
            afterUpdate.Data.GetString("name").Should().Be("Updated Name");
            afterUpdate.Data.GetString("category").Should().Be("Renovation");

            // delete
            var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/projects/{projectId}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);

            // a soft-deleted project must disappear from reads
            var gone = await client.GetAsync<JsonElement>($"/api/v1/projects/{projectId}");
            gone.Status.Should().Be(HttpStatusCode.NotFound);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{projectId}");
        }
    }

    [Fact]
    public async Task Project_status_transitions_are_accepted()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Status Flow Project");

        foreach (var status in new[] { "InProgress", "OnHold", "InProgress", "Completed" })
        {
            var response = await client.PatchAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/status",
                new { newStatus = status, justification = $"moving to {status}" });

            response.Status.Should().Be(HttpStatusCode.OK, $"transition to {status} should be accepted");
        }

        var read = await client.GetAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
        read.Data.GetString("status").Should().Be("Completed");
    }

    // ---------------------------------------------------------------- milestones

    [Fact]
    public async Task Milestone_create_update_complete_delete()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Milestone CRUD Project");

        var created = await client.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId = project.ProjectId,
            name = "Milestone Under Test",
            description = "Created by the suite.",
            dueDate = new DateTime(2026, 9, 30),
            order = 1,
            isCritical = true,
        });

        created.Status.Should().Be(HttpStatusCode.Created);
        var milestoneId = created.Data.GetGuid("id");
        created.Data.GetString("name").Should().Be("Milestone Under Test");
        created.Data.GetProperty("isCritical").GetBoolean().Should().BeTrue();

        // update
        var updated = await client.PutAsync<JsonElement>($"/api/v1/milestones/{milestoneId}", new
        {
            name = "Milestone Renamed",
            description = "Updated by the suite.",
            dueDate = new DateTime(2026, 10, 15),
            order = 2,
            isCritical = false,
            departmentId = (Guid?)null,
            progressPercentage = 25d,
        });

        updated.Status.Should().Be(HttpStatusCode.OK);

        var read = await client.GetAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        read.Data.GetString("name").Should().Be("Milestone Renamed");

        // complete
        var completed = await client.PatchAsync<JsonElement>($"/api/v1/milestones/{milestoneId}/complete", null);
        completed.Status.Should().Be(HttpStatusCode.OK);

        var afterComplete = await client.GetAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        afterComplete.Data.GetString("status").Should().Be("Completed");

        // delete
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var gone = await client.GetAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        gone.Status.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Milestone_dependency_crud()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Dependency CRUD Project")
            .WithCode($"CRUD-D-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("First", new DateTime(2026, 3, 31))
            .WithMilestone("Second", new DateTime(2026, 6, 30))
            .WithMilestone("Third", new DateTime(2026, 9, 30))
            .WithMilestoneDependency("First", "Second")
            .BuildAsync();

        try
        {
            var dependencyId = graph.DependencyIds.Should().ContainSingle().Subject;

            // read
            var read = await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{graph.ProjectId}/dependencies");
            read.Status.Should().Be(HttpStatusCode.OK);
            read.Data.GetArrayLength().Should().Be(1);

            // update
            var updated = await client.PutAsync<JsonElement>($"/api/v1/milestones/dependencies/{dependencyId}", new
            {
                type = "ProgressThreshold",
                thresholdPercentage = 60d,
            });

            updated.Status.Should().Be(HttpStatusCode.OK);

            var afterUpdate = await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{graph.ProjectId}/dependencies");
            afterUpdate.Data[0].GetString("type").Should().Be("ProgressThreshold");

            // delete
            var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/dependencies/{dependencyId}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);

            var afterDelete = await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{graph.ProjectId}/dependencies");
            afterDelete.Data.GetArrayLength().Should().Be(0);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        }
    }

    [Fact]
    public async Task Milestone_dependency_rejects_an_invalid_threshold()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await WizardFlowTests.FirstDepartmentAsync(client);

        var graph = await new WizardBuilder(client)
            .WithName("Bad Dependency Project")
            .WithCode($"CRUD-BD-{Guid.NewGuid().ToString("N")[..8]}")
            .WithDepartments(department)
            .WithMilestone("A", new DateTime(2026, 3, 31))
            .WithMilestone("B", new DateTime(2026, 6, 30))
            .BuildAsync();

        try
        {
            var milestones = (await client.GetAsync<JsonElement>($"/api/v1/milestones/by-project/{graph.ProjectId}")).Data.EnumerateArray().Select(m => m.GetGuid("id")).ToList();
            var response = await client.PostAsync<JsonElement>("/api/v1/milestones/dependencies", new
            {
                projectId = graph.ProjectId,
                prerequisiteMilestoneId = milestones[0],
                dependentMilestoneId = milestones[1],
                type = "ProgressThreshold",
                thresholdPercentage = 500d,
            });

            response.Status.Should().Be(HttpStatusCode.BadRequest);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{graph.ProjectId}");
        }
    }

    // ---------------------------------------------------------------- tasks

    [Fact]
    public async Task Task_create_read_update_progress_status_delete()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Task CRUD Project");
        var milestoneId = (await project.MilestoneIdsAsync())[0];

        // create
        var taskId = await project.CreateTaskAsync("Task Under Test", milestoneId);
        taskId.Should().NotBeEmpty();

        var read = await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        read.Status.Should().Be(HttpStatusCode.OK);
        read.Data.GetString("title").Should().Be("Task Under Test");
        read.Data.GetGuid("milestoneId").Should().Be(milestoneId);

        // update
        var updated = await client.PutAsync<JsonElement>($"/api/v1/tasks/{taskId}", new
        {
            title = "Task Renamed",
            description = "Updated by the suite.",
            startDate = new DateTime(2026, 1, 10),
            dueDate = new DateTime(2026, 7, 15),
            estimatedHours = 12f,
            priority = "High",
            milestoneId,
        });

        updated.Status.Should().Be(HttpStatusCode.OK);

        var afterUpdate = await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        afterUpdate.Data.GetString("title").Should().Be("Task Renamed");

        // progress
        var progress = await client.PatchAsync<JsonElement>($"/api/v1/tasks/{taskId}/progress", new
        {
            progressPercentage = 40d,
            notes = "halfway",
        });

        progress.Status.Should().Be(HttpStatusCode.OK);

        var afterProgress = await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        afterProgress.Data.GetProperty("progressPercentage").GetDouble().Should().BeApproximately(40, 0.01);

        // status
        var status = await client.PatchAsync<JsonElement>($"/api/v1/tasks/{taskId}/status", new
        {
            newStatus = "InProgress",
        });

        status.Status.Should().Be(HttpStatusCode.OK);

        var afterStatus = await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        afterStatus.Data.GetString("status").Should().Be("InProgress");

        // delete
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var gone = await client.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        gone.Status.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Task_progress_is_bounded_to_zero_and_one_hundred()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Progress Bounds Project");
        var taskId = await project.CreateTaskAsync("Bounds Task");

        var tooHigh = await client.PatchAsync<JsonElement>($"/api/v1/tasks/{taskId}/progress", new
        {
            progressPercentage = 150d,
        });

        tooHigh.Status.Should().Be(HttpStatusCode.BadRequest);

        var tooLow = await client.PatchAsync<JsonElement>($"/api/v1/tasks/{taskId}/progress", new
        {
            progressPercentage = -5d,
        });

        tooLow.Status.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Task_due_date_before_start_date_is_rejected()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Bad Dates Project");

        var response = await client.PostAsync<JsonElement>("/api/v1/tasks", new
        {
            title = "Backwards",
            description = "Due before start.",
            startDate = new DateTime(2026, 6, 1),
            dueDate = new DateTime(2026, 1, 1),
            estimatedHours = 1f,
            projectId = project.ProjectId,
            milestoneId = (Guid?)null,
            assignedToUserId = (string?)null,
            priority = "Medium",
        });

        response.Status.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Task_can_be_assigned_and_commented_on()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Assignment Project");
        var taskId = await project.CreateTaskAsync("Assignable Task");

        // assign
        var assigned = await client.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/assign", new
        {
            assigneeId = _fixture.TeamMember.UserId,
            useAIRecommendation = false,
        });

        assigned.Status.Should().Be(HttpStatusCode.OK);

        // comment
        var commented = await client.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments", new
        {
            comment = "Progressing as planned.",
        });

        commented.Status.Should().Be(HttpStatusCode.OK);
    }

    // ---------------------------------------------------------------- subtasks

    [Fact]
    public async Task Subtask_create_update_progress_delete()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Subtask Project");
        var parentId = await project.CreateTaskAsync("Parent Task");

        // create
        var subtaskId = await project.CreateSubtaskAsync(parentId, "Subtask Under Test");
        subtaskId.Should().NotBeEmpty();

        var list = await client.GetAsync<JsonElement>($"/api/v1/tasks/{parentId}/subtasks");
        list.Status.Should().Be(HttpStatusCode.OK);
        // Paginated envelope here, unlike /milestones/by-project.
        list.Data.GetProperty("items").GetArrayLength().Should().Be(1);

        // update
        var updated = await client.PutAsync<JsonElement>($"/api/v1/tasks/subtasks/{subtaskId}", new
        {
            title = "Subtask Renamed",
            description = "Updated by the suite.",
            startDate = new DateTime(2026, 1, 8),
            dueDate = new DateTime(2026, 7, 1),
            estimatedHours = 3f,
            priority = "Critical",
            milestoneId = (Guid?)null,
        });

        updated.Status.Should().Be(HttpStatusCode.OK);

        var afterUpdate = await client.GetAsync<JsonElement>($"/api/v1/tasks/subtasks/{subtaskId}");
        afterUpdate.Data.GetString("title").Should().Be("Subtask Renamed");

        // progress
        var progress = await client.PatchAsync<JsonElement>($"/api/v1/tasks/subtasks/{subtaskId}/progress", new
        {
            progressPercentage = 70d,
        });

        progress.Status.Should().Be(HttpStatusCode.OK);

        // delete
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/subtasks/{subtaskId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);
    }

    // ---------------------------------------------------------------- task dependencies

    [Fact]
    public async Task Task_dependency_crud()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Task Dependency Project");

        var predecessor = await project.CreateTaskAsync("Predecessor");
        var successor = await project.CreateTaskAsync("Successor");

        // create
        var created = await client.PostAsync<JsonElement>($"/api/v1/tasks/{predecessor}/dependencies", new
        {
            predecessorTaskId = predecessor,
            successorTaskId = successor,
            type = "FinishToStart",
            lagDays = 2,
        });

        created.Status.Should().Be(HttpStatusCode.OK);
        var dependencyId = created.Data.GetGuid("id");

        // read
        var read = await client.GetAsync<JsonElement>($"/api/v1/tasks/{predecessor}/dependencies");
        read.Status.Should().Be(HttpStatusCode.OK);
        read.Data.GetArrayLength().Should().Be(1);

        // update
        var updated = await client.PutAsync<JsonElement>($"/api/v1/tasks/dependencies/{dependencyId}", new
        {
            type = "StartToStart",
            lagDays = 5,
        });

        updated.Status.Should().Be(HttpStatusCode.OK);

        // delete
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/dependencies/{dependencyId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var afterDelete = await client.GetAsync<JsonElement>($"/api/v1/tasks/{predecessor}/dependencies");
        afterDelete.Data.GetArrayLength().Should().Be(0);
    }
}
