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

        var pwd = await WizardFlowTests.DepartmentForCodeAsync(projectManager, "PWD");
        var pwdc = await WizardFlowTests.DepartmentForCodeAsync(projectManager, "PWDC");

        // Role hand-off starts with ProjectManager creating the shared project.
        var project = await new WizardBuilder(projectManager)
            .WithName($"Full Role Flow {Guid.NewGuid():N}"[..24])
            .WithDepartments(pwd, pwdc)
            .BuildAsync();

        try
        {
            project.ProjectId.Should().NotBeEmpty();

            await AssertProjectVisibilityAsync(project.ProjectId, departmentHead, viewer);
            var flow = await ExecuteProjectWorkAsync(
                project.ProjectId, pwd, pwdc, projectManager, departmentHead, teamMember, viewer);

            await ExecuteDocumentFlowAsync(
                project.ProjectId, flow.MilestoneId, flow.TaskId,
                projectManager, departmentHead, teamMember, viewer);

            await ExecuteCertificateFlowAsync(
                project.ProjectId, flow.TaskId,
                projectManager, teamMember, departmentHead, director);

            await ExecuteAdministrationFlowAsync(director);

            // Both administrative roles retain access to the complete graph before cleanup.
            (await director.GetAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}"))
                .Status.Should().Be(HttpStatusCode.OK);
            (await superAdmin.GetAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}"))
                .Status.Should().Be(HttpStatusCode.OK);

            // SuperAdmin performs the final destructive operation.
            var deleted = await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            deleted.Status.Should().Be(HttpStatusCode.NoContent);
            (await superAdmin.GetAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}"))
                .Status.Should().Be(HttpStatusCode.NotFound);
        }
        catch
        {
            await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            throw;
        }
    }

    private static async Task AssertProjectVisibilityAsync(
        Guid projectId,
        ApiClient departmentHead,
        ApiClient viewer)
    {
        (await departmentHead.GetAsync<JsonElement>($"/api/v1/projects/{projectId}"))
            .Status.Should().Be(HttpStatusCode.OK);

        (await viewer.GetAsync<JsonElement>($"/api/v1/projects/{projectId}"))
            .Status.Should().Be(HttpStatusCode.OK);
    }

    private sealed record FlowIds(Guid MilestoneId, Guid ManagementMilestoneId, Guid TaskId, Guid SecondTaskId);
}
