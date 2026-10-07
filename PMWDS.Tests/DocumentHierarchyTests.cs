using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// Project documents are hierarchical: a document hangs off the project, off one of its
/// milestones, or off one of its tasks. These tests pin the three levels, the rules that keep a
/// document from being linked to work it does not belong to, and the guarantee that removing a
/// milestone or task detaches its documents instead of destroying uploaded evidence.
/// </summary>
[Collection(ApiCollection.Name)]
public class DocumentHierarchyTests
{
    private const string PdfContentType = "application/pdf";

    private readonly ApiFixture _fixture;

    public DocumentHierarchyTests(ApiFixture fixture) => _fixture = fixture;

    private static MultipartFormDataContent DocumentForm(
        string fileName,
        Guid? milestoneId = null,
        Guid? taskId = null,
        string? category = null)
    {
        var bytes = System.Text.Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
            "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
            "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
            "trailer<</Root 1 0 R>>\n%%EOF");

        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", fileName);

        if (milestoneId.HasValue)
        {
            form.Add(new StringContent(milestoneId.Value.ToString()), "milestoneId");
        }

        if (taskId.HasValue)
        {
            form.Add(new StringContent(taskId.Value.ToString()), "taskId");
        }

        if (category is not null)
        {
            form.Add(new StringContent(category), "category");
        }

        return form;
    }

    private async Task<JsonElement> UploadDocumentAsync(
        Guid projectId,
        string fileName,
        Guid? milestoneId = null,
        Guid? taskId = null)
    {
        using var form = DocumentForm(fileName, milestoneId, taskId);
        var uploaded = await _fixture.SuperAdmin.Client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents",
            form);

        uploaded.Status.Should().Be(HttpStatusCode.OK);
        return uploaded.Data;
    }

    private async Task<IReadOnlyList<JsonElement>> ListDocumentsAsync(Guid projectId)
    {
        var response = await _fixture.SuperAdmin.Client.GetAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents");

        response.Status.Should().Be(HttpStatusCode.OK);
        return response.Data.EnumerateArray().ToList();
    }

    [Fact]
    public async Task Document_without_a_link_sits_at_the_project_level()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Project Level");

        var document = await UploadDocumentAsync(project.ProjectId, "project-level.pdf");

        document.GetString("level").Should().Be("Project");
        document.IsAbsentOrNull("milestoneId").Should().BeTrue();
        document.IsAbsentOrNull("taskId").Should().BeTrue();
    }

    [Fact]
    public async Task Document_against_a_milestone_sits_at_the_milestone_level()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Milestone Level");

        var milestoneId = (await project.MilestoneIdsAsync())[0];

        await UploadDocumentAsync(project.ProjectId, "milestone-level.pdf", milestoneId);

        // Read back through the list endpoint, which loads the milestone navigation.
        var document = (await ListDocumentsAsync(project.ProjectId)).Single();

        document.GetString("level").Should().Be("Milestone");
        document.GetGuid("milestoneId").Should().Be(milestoneId);
        document.GetString("milestoneName").Should().Be("Planning");
        document.IsAbsentOrNull("taskId").Should().BeTrue();
    }

    [Fact]
    public async Task Document_against_a_task_sits_at_the_task_level_and_inherits_the_milestone()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Task Level");

        var milestoneId = (await project.MilestoneIdsAsync())[1];
        var taskId = await project.CreateTaskAsync("Hierarchical Task", milestoneId);

        // The milestone is not sent: the endpoint has to derive it from the task.
        await UploadDocumentAsync(project.ProjectId, "task-level.pdf", taskId: taskId);

        var document = (await ListDocumentsAsync(project.ProjectId)).Single();

        document.GetString("level").Should().Be("Task");
        document.GetGuid("taskId").Should().Be(taskId);
        document.GetString("taskTitle").Should().Be("Hierarchical Task");
        document.GetGuid("milestoneId").Should().Be(milestoneId, "the task's milestone is resolved server-side");
    }

    /// <summary>
    /// A task does not have to sit under a milestone. Such a document is still a task-level
    /// document, so requiring the milestone link would reject a perfectly valid upload.
    /// </summary>
    [Fact]
    public async Task Document_against_a_task_without_a_milestone_is_still_a_task_document()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Standalone Task");

        var taskId = await project.CreateTaskAsync("Standalone Task");

        var document = await UploadDocumentAsync(project.ProjectId, "standalone-task.pdf", taskId: taskId);

        document.GetString("level").Should().Be("Task");
        document.GetGuid("taskId").Should().Be(taskId);
        document.IsAbsentOrNull("milestoneId").Should().BeTrue();
    }

    [Fact]
    public async Task Every_level_is_reported_together_in_the_document_list()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Mixed Levels");

        var milestoneId = (await project.MilestoneIdsAsync())[0];
        var taskId = await project.CreateTaskAsync("Mixed Level Task", milestoneId);

        await UploadDocumentAsync(project.ProjectId, "lvl-project.pdf");
        await UploadDocumentAsync(project.ProjectId, "lvl-milestone.pdf", milestoneId);
        await UploadDocumentAsync(project.ProjectId, "lvl-task.pdf", taskId: taskId);

        var levels = (await ListDocumentsAsync(project.ProjectId))
            .Select(document => document.GetString("level"))
            .ToList();

        levels.Should().BeEquivalentTo(new[] { "Project", "Milestone", "Task" });
    }

    [Fact]
    public async Task Document_upload_rejects_a_task_from_another_project()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Foreign Task");
        await using var other = await TestProject.CreateAsync(client, "Hierarchy Foreign Owner");

        var foreignTaskId = await other.CreateTaskAsync("Foreign Task");

        using var form = DocumentForm("cross-project.pdf", taskId: foreignTaskId);
        var response = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents",
            form);

        response.Status.Should().Be(HttpStatusCode.BadRequest);
        (await ListDocumentsAsync(project.ProjectId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Document_upload_rejects_a_milestone_from_another_project()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Foreign Milestone");
        await using var other = await TestProject.CreateAsync(client, "Hierarchy Foreign Milestone Owner");

        var foreignMilestoneId = (await other.MilestoneIdsAsync())[0];

        using var form = DocumentForm("cross-project-milestone.pdf", milestoneId: foreignMilestoneId);
        var response = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents",
            form);

        response.Status.Should().Be(HttpStatusCode.BadRequest);
        (await ListDocumentsAsync(project.ProjectId)).Should().BeEmpty();
    }

    [Fact]
    public async Task Document_upload_rejects_a_milestone_that_does_not_match_the_task()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Mismatched Milestone");

        var milestones = await project.MilestoneIdsAsync();
        var taskId = await project.CreateTaskAsync("Task Under First Milestone", milestones[0]);

        using var form = DocumentForm("mismatched.pdf", milestoneId: milestones[1], taskId: taskId);
        var response = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents",
            form);

        response.Status.Should().Be(HttpStatusCode.BadRequest);
        (await ListDocumentsAsync(project.ProjectId)).Should().BeEmpty();
    }

    /// <summary>
    /// Deleting a task must not take an uploaded document with it: the document is the evidence,
    /// the task link is only context.
    /// </summary>
    [Fact]
    public async Task Deleting_a_task_detaches_its_document_instead_of_deleting_it()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Task Detach");

        var milestoneId = (await project.MilestoneIdsAsync())[0];
        var taskId = await project.CreateTaskAsync("Task With Document", milestoneId);

        var document = await UploadDocumentAsync(project.ProjectId, "task-detach.pdf", taskId: taskId);
        var documentId = document.GetGuid("id");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var documents = await ListDocumentsAsync(project.ProjectId);
        documents.Should().HaveCount(1, "the uploaded document survives its task");

        var survivor = documents.Single(d => d.GetGuid("id") == documentId);
        survivor.IsAbsentOrNull("taskId").Should().BeTrue("the task link is cleared");
    }

    /// <summary>
    /// Same guarantee through the milestone path, which deletes its tasks as a side effect.
    /// This is the case the foreign-key rule has to cover.
    /// </summary>
    [Fact]
    public async Task Deleting_a_milestone_detaches_its_documents_instead_of_deleting_them()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Milestone Detach");

        var milestones = await project.MilestoneIdsAsync();
        var milestoneId = milestones[0];

        // One document hangs off the milestone itself, one off a task beneath it.
        await UploadDocumentAsync(project.ProjectId, "milestone-detach.pdf", milestoneId);
        var taskId = await project.CreateTaskAsync("Task Under Deleted Milestone", milestoneId);
        await UploadDocumentAsync(project.ProjectId, "task-under-milestone.pdf", taskId: taskId);

        (await ListDocumentsAsync(project.ProjectId)).Should().HaveCount(2);

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var remaining = await ListDocumentsAsync(project.ProjectId);
        remaining.Should().HaveCount(2, "deleting a milestone must not destroy uploaded documents");

        remaining.Should().OnlyContain(document => document.IsAbsentOrNull("milestoneId"));
        remaining.Should().OnlyContain(document => document.IsAbsentOrNull("taskId"));
    }

    [Fact]
    public async Task Deleting_a_project_still_removes_its_documents()
    {
        var client = _fixture.SuperAdmin.Client;
        var project = await TestProject.CreateAsync(client, "Hierarchy Project Cascade");

        var milestoneId = (await project.MilestoneIdsAsync())[0];
        var taskId = await project.CreateTaskAsync("Task In Cascaded Project", milestoneId);

        await UploadDocumentAsync(project.ProjectId, "cascade-project.pdf");
        await UploadDocumentAsync(project.ProjectId, "cascade-milestone.pdf", milestoneId);
        await UploadDocumentAsync(project.ProjectId, "cascade-task.pdf", taskId: taskId);

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // The project is gone, so its documents must be gone with it - the detach rule above is
        // scoped to milestones and tasks only.
        var afterDelete = await client.GetAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents");
        afterDelete.Status.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Document_capabilities_report_every_upload_level_for_a_super_admin()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Hierarchy Capabilities");

        var response = await client.GetAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents/capabilities");

        response.Status.Should().Be(HttpStatusCode.OK);
        response.Data.GetProperty("canUploadProject").GetBoolean().Should().BeTrue();
        response.Data.GetProperty("canUploadMilestone").GetBoolean().Should().BeTrue();
        response.Data.GetProperty("canUploadTask").GetBoolean().Should().BeTrue();
    }
}