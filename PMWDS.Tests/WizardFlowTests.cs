using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// The full "New Project" wizard flow, run exactly as the React client runs it, plus the
/// authorization boundary around it.
/// </summary>
[Collection(ApiCollection.Name)]
public class WizardFlowTests
{
    private readonly ApiFixture _fixture;

    public WizardFlowTests(ApiFixture fixture) => _fixture = fixture;

    /// <summary>
    /// Steps 1-4 of the wizard for an executive: project, milestones, dependencies. This is
    /// the sequence NewProjectPage.handleFinish issues, in the same order.
    /// </summary>
    [Fact]
    public async Task Wizard_creates_project_then_milestones_then_dependencies()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await FirstDepartmentAsync(client);

        var result = await new WizardBuilder(client)
            .WithName("Wizard Flow Project")
            .WithDescription("End-to-end wizard reproduction.")
            .WithDepartments(department)
            .WithMilestone("Site Preparation", new DateTime(2026, 3, 31))
            .WithMilestone("Foundation Works", new DateTime(2026, 6, 30), isCritical: true)
            .WithMilestone("Handover", new DateTime(2026, 11, 30))
            .WithMilestoneDependency("Site Preparation", "Foundation Works")
            .WithMilestoneDependency("Foundation Works", "Handover", "ProgressThreshold", threshold: 75)
            .BuildAsync();

        try
        {
            result.ProjectId.Should().NotBeEmpty();
            result.MilestoneIds.Should().HaveCount(3);
            result.DependencyIds.Should().HaveCount(2);

            // The project is readable afterwards.
            var project = await client.GetAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
            project.Status.Should().Be(HttpStatusCode.OK);
            project.Data!.GetString("name").Should().Be("Wizard Flow Project");

            // Milestones come back for the project, in creation order.
            var milestones = await client.GetAsync<JsonElement>($"/api/v1/milestones/by-project/{result.ProjectId}");
            milestones.Status.Should().Be(HttpStatusCode.OK);
            milestones.Data!.GetArrayLength().Should().Be(3);

            // Dependencies come back with both milestone names resolved.
            var dependencies = await client.GetAsync<JsonElement>(
                $"/api/v1/milestones/by-project/{result.ProjectId}/dependencies");
            dependencies.Status.Should().Be(HttpStatusCode.OK);
            dependencies.Data!.GetArrayLength().Should().Be(2);

            var progressThreshold = dependencies.Data.EnumerateArray()
                .Single(d => d.GetString("type") == "ProgressThreshold");
            progressThreshold.GetProperty("thresholdPercentage").GetDouble().Should().Be(75);
            progressThreshold.GetString("prerequisiteMilestoneName").Should().Be("Foundation Works");
            progressThreshold.GetString("dependentMilestoneName").Should().Be("Handover");
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
        }
    }

    /// <summary>Non-executive flow additionally creates tasks (step 6 of the legacy wizard).</summary>
    [Fact]
    public async Task Wizard_creates_tasks_against_created_milestones()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await FirstDepartmentAsync(client);

        var result = await new WizardBuilder(client)
            .WithName("Wizard With Tasks")
            .WithDepartments(department)
            .WithMilestone("Planning", new DateTime(2026, 2, 28))
            .WithMilestone("Execution", new DateTime(2026, 8, 31))
            .WithMilestoneDependency("Planning", "Execution")
            .WithTask("Draft the plan", new DateTime(2026, 1, 5), new DateTime(2026, 2, 1), "Planning")
            .WithTask("Execute the plan", new DateTime(2026, 3, 1), new DateTime(2026, 8, 1), "Execution")
            .BuildAsync();

        try
        {
            result.TaskIds.Should().HaveCount(2);

            var tasks = await client.GetAsync<JsonElement>($"/api/v1/tasks/by-project/{result.ProjectId}");
            tasks.Status.Should().Be(HttpStatusCode.OK);
            tasks.Data!.GetArrayLength().Should().Be(2);

            // Each task is attached to its own milestone.
            var all = tasks.Data.EnumerateArray().ToList();
            all.Should().OnlyContain(t => t.GetGuid("milestoneId") != Guid.Empty);
            all.Select(t => t.GetGuid("milestoneId")).Distinct().Should().HaveCount(2);
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
        }
    }

    /// <summary>
    /// The wizard aborts before any write when no department was chosen. Reproduced here so
    /// the guard is pinned: a validation rule that silently disappears is invisible until
    /// someone creates an orphan project.
    /// </summary>
    [Fact]
    public async Task Wizard_refuses_to_finish_without_a_department()
    {
        var builder = new WizardBuilder(_fixture.SuperAdmin.Client).WithName("No Department");

        var act = async () => await builder.BuildAsync();
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*department*");
    }

    /// <summary>Duplicate project code hits the unique index.</summary>
    [Fact]
    public async Task Duplicate_project_code_is_rejected()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await FirstDepartmentAsync(client);
        var code = $"DUP-{Guid.NewGuid().ToString("N")[..8]}";

        var first = await new WizardBuilder(client).WithName("Duplicate One").WithCode(code)
            .WithDepartments(department).BuildAsync();

        try
        {
            var second = new WizardBuilder(client).WithName("Duplicate Two").WithCode(code)
                .WithDepartments(department);

            var act = async () => await second.BuildAsync();
            await act.Should().ThrowAsync<InvalidOperationException>();
        }
        finally
        {
            await client.DeleteAsync<JsonElement>($"/api/v1/projects/{first.ProjectId}");
        }
    }

    /// <summary>End dates before start dates are rejected by the DTO validator.</summary>
    [Fact]
    public async Task Project_with_end_before_start_is_rejected()
    {
        var client = _fixture.SuperAdmin.Client;
        var department = await FirstDepartmentAsync(client);

        var result = await client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = $"BAD-{Guid.NewGuid().ToString("N")[..8]}",
            name = "Backwards Dates",
            description = "End before start.",
            category = "Monitoring",
            plannedStartDate = new DateTime(2026, 12, 31),
            plannedEndDate = new DateTime(2026, 1, 1),
            plannedBudget = 1000m,
            departmentId = department,
            departmentIds = new[] { department },
            projectManagerId = string.Empty,
            priority = "Medium",
        });

        result.Status.Should().Be(HttpStatusCode.BadRequest);
        result.ErrorCode.Should().Be("validation_failed");
    }

    /// <summary>A department head can run the wizard for a department they own.</summary>
    [Fact]
    public async Task Department_head_can_create_a_project_in_their_own_department()
    {
        var head = _fixture.DepartmentHead;
        var department = await DepartmentForCodeAsync(head.Client, "PWDC");

        var result = await new WizardBuilder(head.Client)
            .WithName("Department Head Project")
            .WithDepartments(department)
            .WithMilestone("Scoped Milestone", new DateTime(2026, 5, 31))
            .BuildAsync();

        try
        {
            result.ProjectId.Should().NotBeEmpty();
            var project = await head.Client.GetAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
            project.Status.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            await head.Client.DeleteAsync<JsonElement>($"/api/v1/projects/{result.ProjectId}");
        }
    }

    /// <summary>A viewer cannot create anything - the wizard must be refused outright.</summary>
    [Fact]
    public async Task Viewer_cannot_create_a_project()
    {
        var department = await FirstDepartmentAsync(_fixture.Viewer.Client);

        var attempt = await _fixture.Viewer.Client.PostAsync<JsonElement>("/api/v1/projects", new
        {
            projectCode = $"VW-{Guid.NewGuid().ToString("N")[..8]}",
            name = "Viewer Should Not Create This",
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

        attempt.Status.Should().Be(HttpStatusCode.Forbidden);
    }

    internal static async Task<Guid> FirstDepartmentAsync(ApiClient client)
    {
        var departments = await client.GetAsync<JsonElement>("/api/v1/departments?page=1&pageSize=500");
        departments.Status.Should().Be(HttpStatusCode.OK);
        var items = departments.Data!.GetProperty("items");
        items.GetArrayLength().Should().BeGreaterThan(0, "the seeder must create departments");
        return items[0].GetGuid("id");
    }

    internal static async Task<Guid> DepartmentForCodeAsync(ApiClient client, string code)
    {
        var departments = await client.GetAsync<JsonElement>("/api/v1/departments?page=1&pageSize=500");
        var match = departments.Data!.GetProperty("items").EnumerateArray()
            .FirstOrDefault(d => d.GetString("code").Equals(code, StringComparison.OrdinalIgnoreCase));

        match.ValueKind.Should().NotBe(JsonValueKind.Undefined, $"department '{code}' must be seeded");
        return match.GetGuid("id");
    }
}
