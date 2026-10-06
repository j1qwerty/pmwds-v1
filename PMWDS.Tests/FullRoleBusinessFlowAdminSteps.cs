using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;

namespace PMWDS.Tests;

public sealed partial class FullRoleBusinessFlowTests
{
    private async Task ExecuteCertificateFlowAsync(
        Guid projectId,
        Guid taskId,
        ApiClient projectManager,
        ApiClient teamMember,
        ApiClient departmentHead,
        ApiClient director)
    {
        AssertUploadCapabilities(
            await teamMember.GetAsync<JsonElement>(
                $"/api/v1/utilization-certificates/project/{projectId}/capabilities"),
            false, false, true);
        AssertUploadCapabilities(
            await departmentHead.GetAsync<JsonElement>(
                $"/api/v1/utilization-certificates/project/{projectId}/capabilities"),
            false, true, true);
        AssertUploadCapabilities(
            await projectManager.GetAsync<JsonElement>(
                $"/api/v1/utilization-certificates/project/{projectId}/capabilities"),
            true, true, true);

        var taskCertificate = await teamMember.PostFormAsync<JsonElement>(
            "/api/v1/utilization-certificates",
            CertificateForm(projectId, "FLOW-UC-TASK-001", taskId));
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

        var projectCertificate = await projectManager.PostFormAsync<JsonElement>(
            "/api/v1/utilization-certificates",
            CertificateForm(projectId, "FLOW-UC-PROJECT-001"));
        projectCertificate.Status.Should().Be(HttpStatusCode.OK);
        var projectCertificateId = projectCertificate.Data.GetGuid("id");

        (await projectManager.PutAsync<JsonElement>(
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
            })).Status.Should().Be(HttpStatusCode.OK);

        (await projectManager.DeleteAsync<JsonElement>(
            $"/api/v1/utilization-certificates/{projectCertificateId}"))
            .Status.Should().Be(HttpStatusCode.NoContent);
    }

    private static async Task ExecuteAdministrationFlowAsync(ApiClient director, Guid projectId)
    {
        // Director exercises project edit/status while the same project is still live.
        var editedProject = await director.PutAsync<JsonElement>($"/api/v1/projects/{projectId}", new
        {
            name = "Full Role Flow - Director Updated",
            description = "Updated by Director during the end-to-end lifecycle.",
            category = "Monitoring",
            plannedStartDate = new DateTime(2026, 1, 1),
            plannedEndDate = new DateTime(2026, 12, 31),
            plannedBudget = 1_250_000m,
            departmentId = await WizardFlowTests.DepartmentForCodeAsync(director, "PWD"),
            projectManagerId = string.Empty,
            priority = "High",
        });
        editedProject.Status.Should().Be(HttpStatusCode.OK);
        editedProject.Data.GetString("name").Should().Be("Full Role Flow - Director Updated");

        var status = await director.PatchAsync<JsonElement>(
            $"/api/v1/projects/{projectId}/status",
            new { newStatus = "InProgress", justification = "Director started execution." });
        status.Status.Should().Be(HttpStatusCode.OK);

        var adminDepartment = await director.PostAsync<JsonElement>("/api/v1/departments", new
        {
            name = "Flow Administration",
            code = $"FLOW{Guid.NewGuid():N}"[..10].ToUpperInvariant(),
            description = "Temporary full-flow test department.",
            maxCapacity = 8,
        });
        adminDepartment.Status.Should().Be(HttpStatusCode.Created);
        var departmentId = adminDepartment.Data.GetGuid("id");

        try
        {
            (await director.PutAsync<JsonElement>($"/api/v1/departments/{departmentId}", new
            {
                name = "Flow Administration Updated",
                code = adminDepartment.Data.GetString("code"),
                description = "Updated by Director.",
                maxCapacity = 12,
            })).Status.Should().Be(HttpStatusCode.OK);

            var permissions = await director.GetAsync<JsonElement>("/api/v1/roles/permissions");
            permissions.Status.Should().Be(HttpStatusCode.OK);
            var projectManagePermissionId = permissions.Data.EnumerateArray()
                .First(permission => permission.GetString("code") == "PROJECT_ALL_MANAGE")
                .GetGuid("id");

            var permission = await director.PostAsync<JsonElement>("/api/v1/roles/permissions", new
            {
                code = $"FLOW.TEST.{Guid.NewGuid():N}"[..24].ToUpperInvariant(),
                name = "Flow Test Permission",
                description = "Temporary permission.",
                module = "Projects",
                isGlobal = false,
            });
            permission.Status.Should().Be(HttpStatusCode.Created);
            var permissionId = permission.Data.GetGuid("id");

            try
            {
                var role = await director.PostAsync<JsonElement>("/api/v1/roles", new
                {
                    name = $"Flow Test Role {Guid.NewGuid():N}"[..24],
                    description = "Temporary role.",
                    permissionLevel = 20,
                    paginationPageSize = 10,
                    permissionIds = new[] { projectManagePermissionId },
                });
                role.Status.Should().Be(HttpStatusCode.Created);
                var roleId = role.Data.GetGuid("id");

                try
                {
                    (await director.PutAsync<JsonElement>(
                        $"/api/v1/roles/permissions/{permissionId}",
                        new
                        {
                            name = "Flow Test Permission Updated",
                            description = "Updated temporary permission.",
                            module = "Testing",
                            isGlobal = false,
                        })).Status.Should().Be(HttpStatusCode.OK);

                    (await director.PutAsync<JsonElement>(
                        $"/api/v1/roles/{roleId}",
                        new
                        {
                            name = role.Data.GetString("name"),
                            description = "Updated temporary role.",
                            permissionLevel = 20,
                            paginationPageSize = 20,
                            permissionIds = new[] { permissionId },
                        })).Status.Should().Be(HttpStatusCode.OK);
                }
                finally
                {
                    (await director.DeleteAsync<JsonElement>($"/api/v1/roles/{roleId}"))
                        .Status.Should().Be(HttpStatusCode.NoContent);
                }
            }
            finally
            {
                (await director.DeleteAsync<JsonElement>($"/api/v1/roles/permissions/{permissionId}"))
                    .Status.Should().Be(HttpStatusCode.NoContent);
            }
        }
        finally
        {
            (await director.DeleteAsync<JsonElement>($"/api/v1/departments/{departmentId}"))
                .Status.Should().Be(HttpStatusCode.NoContent);
        }
    }

    private static MultipartFormDataContent CertificateForm(Guid projectId, string number, Guid? taskId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4 certificate"));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(projectId.ToString()), "ProjectId");
        form.Add(new StringContent(number), "CertificateNumber");
        form.Add(new StringContent("Government Grant"), "FundingSource");
        form.Add(new StringContent("100000"), "AmountClaimed");
        form.Add(new StringContent("95000"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-12-31"), "PeriodEnd");
        form.Add(new StringContent("Operational project delivery"), "Purpose");

        if (taskId.HasValue)
            form.Add(new StringContent(taskId.Value.ToString()), "TaskId");

        return form;
    }
}
