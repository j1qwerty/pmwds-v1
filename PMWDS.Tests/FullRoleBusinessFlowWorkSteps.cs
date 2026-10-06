using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;

namespace PMWDS.Tests;

public sealed partial class FullRoleBusinessFlowTests
{
    private async Task<FlowIds> ExecuteProjectWorkAsync(
        Guid projectId,
        Guid pwd,
        Guid pwdc,
        ApiClient projectManager,
        ApiClient departmentHead,
        ApiClient teamMember,
        ApiClient viewer)
    {
        var forbiddenMilestone = await viewer.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId,
            name = "Viewer Must Not Create",
            description = "Authorization boundary.",
            dueDate = new DateTime(2026, 4, 30),
            order = 0,
            isCritical = false,
            departmentId = pwd,
        });
        forbiddenMilestone.Status.Should().Be(HttpStatusCode.Forbidden);

        var milestone = await departmentHead.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId,
            name = "Engineering Execution",
            description = "Created by DepartmentHead.",
            dueDate = new DateTime(2026, 8, 31),
            order = 0,
            isCritical = true,
            departmentId = pwdc,
        });
        milestone.Status.Should().Be(HttpStatusCode.Created);
        var milestoneId = milestone.Data.GetGuid("id");

        var managementMilestone = await projectManager.PostAsync<JsonElement>("/api/v1/milestones", new
        {
            projectId,
            name = "Management Review",
            description = "Created by ProjectManager.",
            dueDate = new DateTime(2026, 10, 31),
            order = 1,
            isCritical = false,
            departmentId = pwd,
        });
        managementMilestone.Status.Should().Be(HttpStatusCode.Created);
        var managementMilestoneId = managementMilestone.Data.GetGuid("id");

        var task = await projectManager.PostAsync<JsonElement>("/api/v1/tasks", new
        {
            title = "Complete engineering package",
            description = "End-to-end role flow task.",
            startDate = new DateTime(2026, 2, 1),
            dueDate = new DateTime(2026, 7, 31),
            estimatedHours = 16f,
            projectId,
            milestoneId,
            assignedToUserId = _fixture.TeamMember.UserId,
            assignedToUserIds = new[] { _fixture.TeamMember.UserId },
            priority = "High",
        });
        task.Status.Should().Be(HttpStatusCode.Created);
        var taskId = task.Data.GetGuid("id");

        var subtask = await teamMember.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/subtasks", new
        {
            title = "Prepare supporting evidence",
            description = "Team member creates the execution subtask.",
            startDate = new DateTime(2026, 2, 2),
            dueDate = new DateTime(2026, 6, 30),
            estimatedHours = 4f,
            projectId,
            priority = "Medium",
        });
        subtask.Status.Should().Be(HttpStatusCode.Created);
        var subtaskId = subtask.Data.GetGuid("id");

        (await teamMember.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments", new
        {
            comment = "Evidence package is in progress.",
        })).Status.Should().Be(HttpStatusCode.OK);

        var secondTask = await projectManager.PostAsync<JsonElement>("/api/v1/tasks", new
        {
            title = "Management sign-off",
            description = "Second task for dependency coverage.",
            startDate = new DateTime(2026, 2, 1),
            dueDate = new DateTime(2026, 8, 15),
            estimatedHours = 8f,
            projectId,
            milestoneId = managementMilestoneId,
            priority = "Medium",
        });
        secondTask.Status.Should().Be(HttpStatusCode.Created);
        var secondTaskId = secondTask.Data.GetGuid("id");

        (await projectManager.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/dependencies", new
        {
            predecessorTaskId = taskId,
            successorTaskId = secondTaskId,
            type = "FinishToStart",
            lagDays = 1,
        })).Status.Should().Be(HttpStatusCode.OK);

        (await teamMember.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}"))
            .Status.Should().Be(HttpStatusCode.OK);

        (await teamMember.PatchAsync<JsonElement>(
            $"/api/v1/tasks/{taskId}/progress",
            new { progressPercentage = 60d, notes = "Execution underway." }))
            .Status.Should().Be(HttpStatusCode.OK);

        (await teamMember.PatchAsync<JsonElement>(
            $"/api/v1/tasks/subtasks/{subtaskId}/progress",
            new { progressPercentage = 50d }))
            .Status.Should().Be(HttpStatusCode.OK);

        // The PWD milestone created by ProjectManager brings the PWD Viewer into the
        // project scope without granting the viewer access to PWDC-owned work.
        (await viewer.GetAsync<JsonElement>($"/api/v1/projects/{projectId}"))
            .Status.Should().Be(HttpStatusCode.OK);

        var forbiddenTask = await teamMember.PostAsync<JsonElement>("/api/v1/tasks", new
        {
            title = "Team member must not create sibling task",
            description = "Authorization boundary.",
            startDate = new DateTime(2026, 3, 1),
            dueDate = new DateTime(2026, 3, 31),
            estimatedHours = 2f,
            projectId,
            milestoneId,
            priority = "Low",
        });
        forbiddenTask.Status.Should().Be(HttpStatusCode.Forbidden);

        return new FlowIds(milestoneId, managementMilestoneId, taskId, secondTaskId);
    }

    private async Task ExecuteDocumentFlowAsync(
        Guid projectId,
        Guid milestoneId,
        Guid managementMilestoneId,
        Guid taskId,
        ApiClient projectManager,
        ApiClient departmentHead,
        ApiClient teamMember,
        ApiClient viewer)
    {
        AssertUploadCapabilities(
            await projectManager.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents/capabilities"),
            true, true, true);
        AssertUploadCapabilities(
            await departmentHead.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents/capabilities"),
            false, true, true);
        AssertUploadCapabilities(
            await teamMember.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents/capabilities"),
            false, false, true);
        AssertUploadCapabilities(
            await viewer.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents/capabilities"),
            false, false, false);

        var projectDocument = await projectManager.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents", PdfForm("project-plan.pdf"));
        projectDocument.Status.Should().Be(HttpStatusCode.OK);
        var projectDocumentId = projectDocument.Data.GetGuid("id");

        var milestoneDocument = await departmentHead.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents", PdfForm("milestone-evidence.pdf", milestoneId));
        milestoneDocument.Status.Should().Be(HttpStatusCode.OK);
        var milestoneDocumentId = milestoneDocument.Data.GetGuid("id");

        var managementDocument = await projectManager.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents", PdfForm("management-evidence.pdf", managementMilestoneId));
        managementDocument.Status.Should().Be(HttpStatusCode.OK);

        var taskDocument = await teamMember.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents", PdfForm("task-evidence.pdf", milestoneId, taskId));
        taskDocument.Status.Should().Be(HttpStatusCode.OK);

        var all = await projectManager.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents");
        all.Status.Should().Be(HttpStatusCode.OK);
        all.Data.GetArrayLength().Should().Be(4);

        var head = await departmentHead.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents");
        head.Status.Should().Be(HttpStatusCode.OK);
        head.Data.GetArrayLength().Should().Be(2);
        head.Data.EnumerateArray().Should().OnlyContain(
            doc => doc.GetString("level") == "Milestone" || doc.GetString("level") == "Task");

        var visibleToViewer = await viewer.GetAsync<JsonElement>($"/api/v1/projects/{projectId}/documents");
        visibleToViewer.Status.Should().Be(HttpStatusCode.OK);
        visibleToViewer.Data.GetArrayLength().Should().Be(2);
        visibleToViewer.Data.EnumerateArray().Select(doc => doc.GetString("title")!).Should()
            .BeEquivalentTo("project-plan.pdf", "management-evidence.pdf");

        (await projectManager.PutAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents/{projectDocumentId}",
            new { title = "project-plan-final.pdf", description = "Approved plan.", category = "General" }))
            .Status.Should().Be(HttpStatusCode.OK);

        (await departmentHead.PutAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents/{milestoneDocumentId}",
            new { title = "milestone-evidence-final.pdf", description = "Reviewed.", category = "General" }))
            .Status.Should().Be(HttpStatusCode.OK);

        (await projectManager.DeleteAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents/{projectDocumentId}"))
            .Status.Should().Be(HttpStatusCode.NoContent);

        (await _fixture.Admin.Client.DeleteAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/documents/{milestoneDocumentId}"))
            .Status.Should().Be(HttpStatusCode.NoContent);
    }

    private static void AssertUploadCapabilities(Result<JsonElement> response, bool project, bool milestone, bool task)
    {
        response.Status.Should().Be(HttpStatusCode.OK);
        response.Data.GetProperty("canProjectUpload").GetBoolean().Should().Be(project);
        response.Data.GetProperty("canMilestoneUpload").GetBoolean().Should().Be(milestone);
        response.Data.GetProperty("canTaskUpload").GetBoolean().Should().Be(task);
    }

    private static MultipartFormDataContent PdfForm(string fileName, Guid? milestoneId = null, Guid? taskId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
            "trailer<</Root 1 0 R>>\n%%EOF"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", fileName);

        if (milestoneId.HasValue)
            form.Add(new StringContent(milestoneId.Value.ToString()), "milestoneId");
        if (taskId.HasValue)
            form.Add(new StringContent(taskId.Value.ToString()), "taskId");

        return form;
    }
}
