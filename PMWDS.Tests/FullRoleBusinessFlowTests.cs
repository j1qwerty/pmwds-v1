using System.Net;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

[Collection(ApiCollection.Name)]
public sealed partial class FullRoleBusinessFlowTests
{
    private readonly ApiFixture _fixture;

    public FullRoleBusinessFlowTests(ApiFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Complete_role_flow_creates_and_executes_project_across_all_roles()
    {
        var projectManager = _fixture.ProjectManager.Client;
        var departmentHead = _fixture.DepartmentHead.Client;
        var teamMember = _fixture.TeamMember.Client;
        var viewer = _fixture.Viewer.Client;
        var director = _fixture.Admin.Client;
        var superAdmin = _fixture.SuperAdmin.Client;

        var pwd = await WizardFlowTests.DepartmentForCodeAsync(director, "PWD");
        var pwdc = await WizardFlowTests.DepartmentForCodeAsync(director, "PWDC");

        // Organization-admin hand-off starts with Director creating the shared project.
        var project = await new WizardBuilder(director)
            .WithName($"Full Role Flow {Guid.NewGuid():N}"[..24])
            .WithDepartments(pwd, pwdc)
            .BuildAsync();

        try
        {
            project.ProjectId.Should().NotBeEmpty();

            await AssertInitialProjectVisibilityAsync(
                project.ProjectId, projectManager, departmentHead, teamMember, viewer);

            var flow = await ExecuteProjectWorkAsync(
                project.ProjectId, pwd, pwdc, projectManager, departmentHead, teamMember, viewer);

            await ExecuteDocumentFlowAsync(
                project.ProjectId, flow.MilestoneId, flow.ManagementMilestoneId, flow.TaskId,
                projectManager, departmentHead, teamMember, viewer);

            await ExecuteCertificateFlowAsync(
                project.ProjectId, flow.TaskId,
                projectManager, teamMember, departmentHead, director);

            await ExecuteAdministrationFlowAsync(director, project.ProjectId);

            // Both administrative roles retain list visibility before cleanup.
            await AssertProjectListedAsync(project.ProjectId, director);
            await AssertProjectListedAsync(project.ProjectId, superAdmin);

            // SuperAdmin performs the final destructive operation.
            var deleted = await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);
            await AssertProjectNotListedAsync(project.ProjectId, superAdmin);
        }
        catch
        {
            await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            throw;
        }
    }

    private static async Task AssertInitialProjectVisibilityAsync(
        Guid projectId,
        ApiClient projectManager,
        ApiClient departmentHead,
        ApiClient teamMember,
        ApiClient viewer)
    {
        await AssertProjectListedAsync(projectId, projectManager);
        await AssertProjectListedAsync(projectId, departmentHead);
        await AssertProjectListedAsync(projectId, teamMember);
        await AssertProjectListedAsync(projectId, viewer);
    }

    private static async Task AssertProjectListedAsync(Guid projectId, ApiClient client)
    {
        var response = await client.GetAsync<JsonElement>("/api/v1/projects?page=1&pageSize=100");
        response.Status.Should().Be(HttpStatusCode.OK);
        response.Data.GetProperty("items").EnumerateArray()
            .Any(project => project.GetGuid("id") == projectId)
            .Should().BeTrue();
    }

    private static async Task AssertProjectNotListedAsync(Guid projectId, ApiClient client)
    {
        var response = await client.GetAsync<JsonElement>("/api/v1/projects?page=1&pageSize=100");
        response.Status.Should().Be(HttpStatusCode.OK);
        response.Data.GetProperty("items").EnumerateArray()
            .Any(project => project.GetGuid("id") == projectId)
            .Should().BeFalse();
    }

    private sealed record FlowIds(Guid MilestoneId, Guid ManagementMilestoneId, Guid TaskId, Guid SecondTaskId);
}
