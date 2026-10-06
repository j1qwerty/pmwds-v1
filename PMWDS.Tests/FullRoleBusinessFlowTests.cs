using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// One realistic end-to-end business flow across every seeded role.
/// This is intentionally one test: a failure tells us which hand-off in the lifecycle broke,
/// instead of proving the same endpoints in disconnected fixtures.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class FullRoleBusinessFlowTests
{
    private const string PdfContentType = "application/pdf";
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

        // 1. The project-manager role creates the project in its primary department and
        //    explicitly assigns the engineering department. No milestone exists yet.
        var project = await new WizardBuilder(projectManager)
            .WithName($"Full Role Flow {Guid.NewGuid():N}"[..24])
            .WithDepartments(pwd, pwdc)
            .BuildAsync();

        try
        {
            project.ProjectId.Should().NotBeEmpty();

            // 2. Cross-role hand-off: the assigned department can see the project, but the
            //    department head can only create children in its own department.
            var headProject = await departmentHead.Client.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}");
            headProject.Status.Should().Be(HttpStatusCode.OK);

            var viewerProject = await viewer.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}");
            viewerProject.Status.Should().Be(HttpStatusCode.OK);

            var viewerCannotCreate = await viewer.PostAsync<JsonElement>("/api/v1/milestones", new
            {
                projectId = project.ProjectId,
                name = "Viewer Must Not Create",
                description = "Authorization boundary.",
                dueDate = new DateTime(2026, 4, 30),
                order = 0,
                isCritical = false,
                departmentId = pwd,
            });
            viewerCannotCreate.Status.Should().Be(HttpStatusCode.Forbidden);

            // DepartmentHead owns PWDC, so this milestone is the department's hand-off point.
            var milestone = await departmentHead.PostAsync<JsonElement>("/api/v1/milestones", new
            {
                projectId = project.ProjectId,
                name = "Engineering Execution",
                description = "Created by the department head.",
                dueDate = new DateTime(2026, 8, 31),
                order = 0,
                isCritical = true,
                departmentId = pwdc,
            });
            milestone.Status.Should().Be(HttpStatusCode.Created);
            var milestoneId = milestone.Data.GetGuid("id");

            // 3. ProjectManager has ALL scope, so it can create a second milestone and task,
            //    then assign the task to the team member who will execute it.
            var managementMilestone = await projectManager.PostAsync<JsonElement>("/api/v1/milestones", new
            {
                projectId = project.ProjectId,
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
                projectId = project.ProjectId,
                milestoneId = milestoneId,
                assignedToUserId = _fixture.TeamMember.UserId,
                assignedToUserIds = new[] { _fixture.TeamMember.UserId },
                priority = "High",
            });
            task.Status.Should().Be(HttpStatusCode.Created);
            var taskId = task.Data.GetGuid("id");

            // Task comments, subtasks and dependencies are part of the same execution flow.
            var subtask = await teamMember.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/subtasks", new
            {
                title = "Prepare supporting evidence",
                description = "Team member creates the execution subtask.",
                startDate = new DateTime(2026, 2, 2),
                dueDate = new DateTime(2026, 6, 30),
                estimatedHours = 4f,
                projectId = project.ProjectId,
                priority = "Medium",
            });
            subtask.Status.Should().Be(HttpStatusCode.Created);
            var subtaskId = subtask.Data.GetGuid("id");

            var comment = await teamMember.PostAsync<JsonElement>($"/api/v1/tasks/{taskId}/comments", new
            {
                comment = "Evidence package is in progress.",
            });
            comment.Status.Should().Be(HttpStatusCode.OK);

            var secondTask = await projectManager.PostAsync<JsonElement>("/api/v1/tasks", new
            {
                title = "Management sign-off",
                description = "Second task for dependency coverage.",
                startDate = new DateTime(2026, 2, 1),
                dueDate = new DateTime(2026, 8, 15),
                estimatedHours = 8f,
                projectId = project.ProjectId,
                milestoneId = managementMilestoneId,
                priority = "Medium",
            });
            secondTask.Status.Should().Be(HttpStatusCode.Created);
            var secondTaskId = secondTask.Data.GetGuid("id");

            var taskDependency = await projectManager.PostAsync<JsonElement>(
                $"/api/v1/tasks/{taskId}/dependencies",
                new
                {
                    predecessorTaskId = taskId,
                    successorTaskId = secondTaskId,
                    type = "FinishToStart",
                    lagDays = 1,
                });
            taskDependency.Status.Should().Be(HttpStatusCode.OK);

            // 4. TeamMember executes the assigned task but cannot create another task.
            var taskRead = await teamMember.GetAsync<JsonElement>($"/api/v1/tasks/{taskId}");
            taskRead.Status.Should().Be(HttpStatusCode.OK);

            var taskProgress = await teamMember.PatchAsync<JsonElement>(
                $"/api/v1/tasks/{taskId}/progress",
                new { progressPercentage = 60d, notes = "Execution underway." });
            taskProgress.Status.Should().Be(HttpStatusCode.OK);

            var forbiddenTask = await teamMember.PostAsync<JsonElement>("/api/v1/tasks", new
            {
                title = "Team member must not create sibling task",
                description = "Authorization boundary.",
                startDate = new DateTime(2026, 3, 1),
                dueDate = new DateTime(2026, 3, 31),
                estimatedHours = 2f,
                projectId = project.ProjectId,
                milestoneId = milestoneId,
                priority = "Low",
            });
            forbiddenTask.Status.Should().Be(HttpStatusCode.Forbidden);

            var subtaskProgress = await teamMember.PatchAsync<JsonElement>(
                $"/api/v1/tasks/subtasks/{subtaskId}/progress",
                new { progressPercentage = 50d });
            subtaskProgress.Status.Should().Be(HttpStatusCode.OK);

            // 5. Verify upload-level capabilities before exercising the document hierarchy.
            AssertUploadCapabilities(
                await projectManager.GetAsync<JsonElement>(
                    $"/api/v1/projects/{project.ProjectId}/documents/capabilities"),
                canProject: true, canMilestone: true, canTask: true);

            AssertUploadCapabilities(
                await departmentHead.GetAsync<JsonElement>(
                    $"/api/v1/projects/{project.ProjectId}/documents/capabilities"),
                canProject: false, canMilestone: true, canTask: true);

            AssertUploadCapabilities(
                await teamMember.GetAsync<JsonElement>(
                    $"/api/v1/projects/{project.ProjectId}/documents/capabilities"),
                canProject: false, canMilestone: false, canTask: true);

            AssertUploadCapabilities(
                await viewer.GetAsync<JsonElement>(
                    $"/api/v1/projects/{project.ProjectId}/documents/capabilities"),
                canProject: false, canMilestone: false, canTask: false);

            // Project-level document -> ProjectManager.
            var projectDocument = await projectManager.PostFormAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents",
                PdfForm("project-plan.pdf"));
            projectDocument.Status.Should().Be(HttpStatusCode.OK);
            var projectDocumentId = projectDocument.Data.GetGuid("id");

            // Milestone-level document -> DepartmentHead.
            var milestoneDocument = await departmentHead.PostFormAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents",
                PdfForm("milestone-evidence.pdf", milestoneId));
            milestoneDocument.Status.Should().Be(HttpStatusCode.OK);

            // Task-level document -> TeamMember.
            var taskDocument = await teamMember.PostFormAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents",
                PdfForm("task-evidence.pdf", milestoneId, taskId));
            taskDocument.Status.Should().Be(HttpStatusCode.OK);

            var allDocuments = await projectManager.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents");
            allDocuments.Status.Should().Be(HttpStatusCode.OK);
            allDocuments.Data.GetArrayLength().Should().Be(3);

            var departmentDocuments = await departmentHead.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents");
            departmentDocuments.Status.Should().Be(HttpStatusCode.OK);
            departmentDocuments.Data.EnumerateArray()
                .Should().OnlyContain(doc =>
                    doc.GetString("level") is "Milestone" or "Task");

            var viewerDocuments = await viewer.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents");
            viewerDocuments.Status.Should().Be(HttpStatusCode.OK);
            viewerDocuments.Data.EnumerateArray()
                .Should().OnlyContain(doc => doc.GetString("level") == "Project");

            // ProjectManager exercises document edit/delete; the DepartmentHead edits its
            // milestone document while the TeamMember remains task-upload-only.
            var editedProjectDocument = await projectManager.PutAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents/{projectDocumentId}",
                new { title = "project-plan-final.pdf", description = "Approved plan.", category = "General" });
            editedProjectDocument.Status.Should().Be(HttpStatusCode.OK);

            var editedMilestoneDocumentId = milestoneDocument.Data.GetGuid("id");
            var editedMilestoneDocument = await departmentHead.PutAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents/{editedMilestoneDocumentId}",
                new { title = "milestone-evidence-final.pdf", description = "Reviewed.", category = "General" });
            editedMilestoneDocument.Status.Should().Be(HttpStatusCode.OK);

            // 6. TeamMember creates a task-level UC and submits it; Director performs the
            //    financial approval for the project's primary department.
            AssertUploadCapabilities(
                await teamMember.GetAsync<JsonElement>(
                    $"/api/v1/utilization-certificates/project/{project.ProjectId}/capabilities"),
                canProject: false, canMilestone: false, canTask: true);

            AssertUploadCapabilities(
                await departmentHead.GetAsync<JsonElement>(
                    $"/api/v1/utilization-certificates/project/{project.ProjectId}/capabilities"),
                canProject: false, canMilestone: true, canTask: true);

            AssertUploadCapabilities(
                await projectManager.GetAsync<JsonElement>(
                    $"/api/v1/utilization-certificates/project/{project.ProjectId}/capabilities"),
                canProject: true, canMilestone: true, canTask: true);

            var taskCertificate = await teamMember.PostFormAsync<JsonElement>(
                "/api/v1/utilization-certificates",
                CertificateForm(project.ProjectId, "FLOW-UC-TASK-001", taskId));
            taskCertificate.Status.Should().Be(HttpStatusCode.OK);
            var taskCertificateId = taskCertificate.Data.GetGuid("id");

            var submitted = await teamMember.PostAsync<JsonElement>(
                $"/api/v1/utilization-certificates/{taskCertificateId}/submit");
            submitted.Status.Should().Be(HttpStatusCode.OK);
            submitted.Data.GetString("status").Should().Be("Submitted");

            var approved = await director.PostAsync<JsonElement>(
                $"/api/v1/utilization-certificates/{taskCertificateId}/review",
                new { approve = true, notes = "Approved in full-role flow." });
            approved.Status.Should().Be(HttpStatusCode.OK);
            approved.Data.GetString("status").Should().Be("Approved");

            // Project-level UC -> ProjectManager exercises create/edit/delete on a second
            // certificate without disturbing the approved certificate.
            var projectCertificate = await projectManager.PostFormAsync<JsonElement>(
                "/api/v1/utilization-certificates",
                CertificateForm(project.ProjectId, "FLOW-UC-PROJECT-001"));
            projectCertificate.Status.Should().Be(HttpStatusCode.OK);
            var projectCertificateId = projectCertificate.Data.GetGuid("id");

            var editedCertificate = await projectManager.PutAsync<JsonElement>(
                $"/api/v1/utilization-certificates/{projectCertificateId}",
                new
                {
                    certificateNumber = "FLOW-UC-PROJECT-002",
                    fundingSource = "Government Grant",
                    amountClaimed = 125000m,
                    amountUtilized = 120000m,
                    periodStart = "2026-01-01",
                    periodEnd = "2026-12-31",
                    milestoneId = (Guid?)null,
                    taskId = (Guid?)null,
                    purpose = "Updated project-level certificate.",
                });
            editedCertificate.Status.Should().Be(HttpStatusCode.OK);

            var deletedCertificate = await projectManager.DeleteAsync<JsonElement>(
                $"/api/v1/utilization-certificates/{projectCertificateId}");
            deletedCertificate.Status.Should().Be(HttpStatusCode.NoContent);

            // 7. Director/SuperAdmin exercise administration while the workflow is live:
            //    department CRUD plus role/permission CRUD.
            var adminDepartment = await director.PostAsync<JsonElement>("/api/v1/departments", new
            {
                name = "Flow Administration",
                code = $"FLOW{Guid.NewGuid():N}"[..10].ToUpperInvariant(),
                description = "Temporary full-flow test department.",
                maxCapacity = 8,
            });
            adminDepartment.Status.Should().Be(HttpStatusCode.Created);
            var adminDepartmentId = adminDepartment.Data.GetGuid("id");

            var updatedDepartment = await director.PutAsync<JsonElement>(
                $"/api/v1/departments/{adminDepartmentId}",
                new
                {
                    name = "Flow Administration Updated",
                    code = adminDepartment.Data.GetString("code"),
                    description = "Updated by Director.",
                    maxCapacity = 12,
                });
            updatedDepartment.Status.Should().Be(HttpStatusCode.OK);

            var permissions = await director.GetAsync<JsonElement>("/api/v1/roles/permissions");
            permissions.Status.Should().Be(HttpStatusCode.OK);

            var customPermission = await director.PostAsync<JsonElement>("/api/v1/roles/permissions", new
            {
                code = $"FLOW.TEST.{Guid.NewGuid():N}"[..24].ToUpperInvariant(),
                name = "Flow Test Permission",
                description = "Temporary permission used by the full-flow test.",
                module = "Testing",
                isGlobal = false,
            });
            customPermission.Status.Should().Be(HttpStatusCode.Created);
            var customPermissionId = customPermission.Data.GetGuid("id");

            var customRole = await director.PostAsync<JsonElement>("/api/v1/roles", new
            {
                name = $"Flow Test Role {Guid.NewGuid():N}"[..24],
                description = "Temporary role used by the full-flow test.",
                permissionLevel = 20,
                paginationPageSize = 10,
                permissionIds = new[] { customPermissionId },
            });
            customRole.Status.Should().Be(HttpStatusCode.Created);
            var customRoleId = customRole.Data.GetGuid("id");

            var updatedPermission = await director.PutAsync<JsonElement>(
                $"/api/v1/roles/permissions/{customPermissionId}",
                new
                {
                    name = "Flow Test Permission Updated",
                    description = "Updated temporary permission.",
                    module = "Testing",
                    isGlobal = false,
                });
            updatedPermission.Status.Should().Be(HttpStatusCode.OK);

            var updatedRole = await director.PutAsync<JsonElement>(
                $"/api/v1/roles/{customRoleId}",
                new
                {
                    name = customRole.Data.GetString("name"),
                    description = "Updated temporary role.",
                    permissionLevel = 20,
                    paginationPageSize = 20,
                    permissionIds = new[] { customPermissionId },
                });
            updatedRole.Status.Should().Be(HttpStatusCode.OK);

            var deletedRole = await director.DeleteAsync<JsonElement>($"/api/v1/roles/{customRoleId}");
            deletedRole.Status.Should().Be(HttpStatusCode.NoContent);

            var deletedPermission = await director.DeleteAsync<JsonElement>(
                $"/api/v1/roles/permissions/{customPermissionId}");
            deletedPermission.Status.Should().Be(HttpStatusCode.NoContent);

            var deletedDepartment = await director.DeleteAsync<JsonElement>(
                $"/api/v1/departments/{adminDepartmentId}");
            deletedDepartment.Status.Should().Be(HttpStatusCode.NoContent);

            // 8. Admin visibility remains complete after all hand-offs; SuperAdmin can still
            //    resolve the same project and perform the final delete.
            var directorProject = await director.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}");
            directorProject.Status.Should().Be(HttpStatusCode.OK);

            var superProject = await superAdmin.GetAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}");
            superProject.Status.Should().Be(HttpStatusCode.OK);

            var deletedProjectDocument = await projectManager.DeleteAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents/{projectDocumentId}");
            deletedProjectDocument.Status.Should().Be(HttpStatusCode.NoContent);

            var deletedMilestoneDocument = await departmentHead.DeleteAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}/documents/{editedMilestoneDocumentId}");
            deletedMilestoneDocument.Status.Should().Be(HttpStatusCode.NoContent);

            var deletedProject = await superAdmin.DeleteAsync<JsonElement>(
                $"/api/v1/projects/{project.ProjectId}");
            deletedProject.Status.Should().Be(HttpStatusCode.NoContent);

            var gone = await superAdmin.GetAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            gone.Status.Should().Be(HttpStatusCode.NotFound);
        }
        catch
        {
            // The explicit final delete below is best-effort in case the failure happened
            // before the normal cleanup path.
            await superAdmin.DeleteAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}");
            throw;
        }
    }

    private static void AssertUploadCapabilities(
        Result<JsonElement> response,
        bool canProject,
        bool canMilestone,
        bool canTask)
    {
        response.Status.Should().Be(HttpStatusCode.OK);
        response.Data.GetProperty("canProjectUpload").GetBoolean().Should().Be(canProject);
        response.Data.GetProperty("canMilestoneUpload").GetBoolean().Should().Be(canMilestone);
        response.Data.GetProperty("canTaskUpload").GetBoolean().Should().Be(canTask);
    }

    private static MultipartFormDataContent PdfForm(
        string fileName,
        Guid? milestoneId = null,
        Guid? taskId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
            "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
            "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
            "trailer<</Root 1 0 R>>\n%%EOF"));
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

        return form;
    }

    private static MultipartFormDataContent CertificateForm(
        Guid projectId,
        string certificateNumber,
        Guid? taskId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4 certificate"));
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(projectId.ToString()), "ProjectId");
        form.Add(new StringContent(certificateNumber), "CertificateNumber");
        form.Add(new StringContent("Government Grant"), "FundingSource");
        form.Add(new StringContent("100000"), "AmountClaimed");
        form.Add(new StringContent("95000"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-12-31"), "PeriodEnd");
        form.Add(new StringContent("Operational project delivery"), "Purpose");

        if (taskId.HasValue)
        {
            form.Add(new StringContent(taskId.Value.ToString()), "TaskId");
        }

        return form;
    }
}
