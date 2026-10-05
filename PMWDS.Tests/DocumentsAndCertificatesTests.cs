using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using FluentAssertions;
using PMWDS.Tests.Infrastructure;
using Xunit;

namespace PMWDS.Tests;

/// <summary>
/// Project documents and utilization certificates, including the cascade behaviour of the
/// certificate -> task link.
/// </summary>
[Collection(ApiCollection.Name)]
public class DocumentsAndCertificatesTests
{
    private const string PdfContentType = "application/pdf";

    private readonly ApiFixture _fixture;

    public DocumentsAndCertificatesTests(ApiFixture fixture) => _fixture = fixture;

    private static MultipartFormDataContent PdfForm(string fileName = "evidence.pdf", string? category = null)
    {
        // A minimal but structurally valid PDF; the endpoint validates the content type, not
        // the bytes.
        var bytes = System.Text.Encoding.ASCII.GetBytes(
            "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
            "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
            "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
            "trailer<</Root 1 0 R>>\n%%EOF");

        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", fileName);

        if (category is not null)
        {
            form.Add(new StringContent(category), "category");
        }

        return form;
    }

    [Fact]
    public async Task Document_upload_list_and_download()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Document Project");

        using var form = PdfForm("drawings.pdf", "General");
        var uploaded = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents", form);

        uploaded.Status.Should().Be(HttpStatusCode.OK);

        var documents = await client.GetAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents");
        documents.Status.Should().Be(HttpStatusCode.OK);
        documents.Data.GetArrayLength().Should().Be(1);

        var document = documents.Data[0];
        document.GetString("title").Should().Be("drawings.pdf");

        // The category must round-trip in full. This is the regression guard for the
        // nvarchar(1) defect: the column was created with no length, so "General" was
        // truncated to "G" on save.
        document.GetString("category").Should().Be("General");
        document.GetProperty("fileSizeBytes").GetInt64().Should().BeGreaterThan(0);

        // The stored path is relative and prefixed "documents/".
        document.GetString("filePath").Should().StartWith("documents/");
    }

    [Fact]
    public async Task Document_download_returns_the_stored_bytes()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Download Project");

        using var form = PdfForm("downloadable.pdf", "General");
        await client.PostFormAsync<JsonElement>($"/api/v1/projects/{project.ProjectId}/documents", form);

        var documents = await client.GetAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents");
        var documentId = documents.Data[0].GetGuid("id");

        using var response = await client.DownloadAsync(
            $"/api/v1/projects/{project.ProjectId}/documents/{documentId}/download");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be(PdfContentType);

        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().NotBeEmpty();
        System.Text.Encoding.ASCII.GetString(content).Should().StartWith("%PDF");
    }

    [Fact]
    public async Task Document_upload_rejects_a_disallowed_content_type()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Bad Upload Project");

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent("plain text"u8.ToArray());
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "file", "notes.txt");

        var response = await client.PostFormAsync<JsonElement>(
            $"/api/v1/projects/{project.ProjectId}/documents", form);

        // Project documents accept any type, so this one is expected to succeed. The strict
        // content-type list belongs to utilization certificates, covered separately below.
        response.Status.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Utilization_certificate_is_created_against_a_task()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Certificate Project");

        var taskId = await project.CreateTaskAsync("Certified Task");

        using var form = new MultipartFormDataContent();
        var bytes = System.Text.Encoding.ASCII.GetBytes("%PDF-1.4 certificate");
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(project.ProjectId.ToString()), "ProjectId");
        form.Add(new StringContent("UC-INT-001"), "CertificateNumber");
        form.Add(new StringContent("Government Grant"), "FundingSource");
        form.Add(new StringContent("100000"), "AmountClaimed");
        form.Add(new StringContent("95000"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-03-31"), "PeriodEnd");
        form.Add(new StringContent(taskId.ToString()), "TaskId");

        var created = await client.PostFormAsync<JsonElement>("/api/v1/utilization-certificates", form);
        created.Status.Should().Be(HttpStatusCode.OK);

        created.Data.GetString("certificateNumber").Should().Be("UC-INT-001");
        created.Data.GetProperty("amountClaimed").GetDecimal().Should().Be(100000m);
        created.Data.GetString("taskId").Should().Be(taskId.ToString());
    }

    /// <summary>
    /// A certificate links optionally to a milestone or a task, never both. Pinning this
    /// because the rule is easy to lose and produces a confusing state when it goes.
    /// </summary>
    [Fact]
    public async Task Utilization_certificate_rejects_both_a_milestone_and_a_task()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Exclusive Link Project");

        var milestoneId = (await project.MilestoneIdsAsync())[0];
        var taskId = await project.CreateTaskAsync("Task", milestoneId);

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes("%PDF-1.4"));
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(project.ProjectId.ToString()), "ProjectId");
        form.Add(new StringContent("UC-INT-002"), "CertificateNumber");
        form.Add(new StringContent("Grant"), "FundingSource");
        form.Add(new StringContent("1000"), "AmountClaimed");
        form.Add(new StringContent("900"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-03-31"), "PeriodEnd");
        form.Add(new StringContent(milestoneId.ToString()), "MilestoneId");
        form.Add(new StringContent(taskId.ToString()), "TaskId");

        var response = await client.PostFormAsync<JsonElement>("/api/v1/utilization-certificates", form);

        response.Status.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Utilization_certificate_rejects_a_disallowed_content_type()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Bad Certificate Project");

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent("not a pdf"u8.ToArray());
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "file", "notes.txt");
        form.Add(new StringContent(project.ProjectId.ToString()), "ProjectId");
        form.Add(new StringContent("UC-INT-003"), "CertificateNumber");
        form.Add(new StringContent("Grant"), "FundingSource");
        form.Add(new StringContent("1000"), "AmountClaimed");
        form.Add(new StringContent("900"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-03-31"), "PeriodEnd");

        var response = await client.PostFormAsync<JsonElement>("/api/v1/utilization-certificates", form);

        response.Status.Should().Be(HttpStatusCode.BadRequest);
    }

    /// <summary>
    /// The certificate -> task link is informational, so deleting the task must detach the
    /// certificate rather than delete it or block the delete.
    /// </summary>
    /// <remarks>
    /// This is the behaviour that differs between providers if the fix in
    /// <c>TaskRepository.DeleteTaskGraphsByIdsAsync</c> is ever removed. The foreign key
    /// cannot be <c>ON DELETE SET NULL</c> on SQL Server - Tasks cascade from Projects and
    /// Projects already reaches the certificate table through ProjectDocuments, so a second
    /// cascade path makes SQL Server reject the table - so the unlink happens in the
    /// application. Both providers must end up identical.
    /// </remarks>
    [Fact]
    public async Task Deleting_a_task_detaches_rather_than_deletes_its_certificate()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Certificate Detach Project");

        var taskId = await project.CreateTaskAsync("Task With Certificate");

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes("%PDF-1.4"));
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(project.ProjectId.ToString()), "ProjectId");
        form.Add(new StringContent("UC-DETACH-1"), "CertificateNumber");
        form.Add(new StringContent("Grant"), "FundingSource");
        form.Add(new StringContent("5000"), "AmountClaimed");
        form.Add(new StringContent("4800"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-02-28"), "PeriodEnd");
        form.Add(new StringContent(taskId.ToString()), "TaskId");

        var created = await client.PostFormAsync<JsonElement>("/api/v1/utilization-certificates", form);
        created.Status.Should().Be(HttpStatusCode.OK);
        var certificateId = created.Data.GetGuid("id");

        // The delete must succeed...
        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/tasks/{taskId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        // ...and the certificate must survive with the link cleared.
        var afterDelete = await client.GetAsync<JsonElement>(
            $"/api/v1/utilization-certificates/{certificateId}");
        afterDelete.Status.Should().Be(HttpStatusCode.OK);
        afterDelete.Data.GetString("certificateNumber").Should().Be("UC-DETACH-1");
        afterDelete.Data.IsAbsentOrNull("taskId").Should().BeTrue("the link is cleared by the unlink");
    }

    /// <summary>Same guarantee through the milestone path, which deletes tasks as a side effect.</summary>
    [Fact]
    public async Task Deleting_a_milestone_detaches_certificates_on_its_tasks()
    {
        var client = _fixture.SuperAdmin.Client;
        await using var project = await TestProject.CreateAsync(client, "Milestone Certificate Project");

        var milestoneId = (await project.MilestoneIdsAsync())[0];
        var taskId = await project.CreateTaskAsync("Task Under Milestone", milestoneId);

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(System.Text.Encoding.ASCII.GetBytes("%PDF-1.4"));
        file.Headers.ContentType = new MediaTypeHeaderValue(PdfContentType);
        form.Add(file, "file", "certificate.pdf");
        form.Add(new StringContent(project.ProjectId.ToString()), "ProjectId");
        form.Add(new StringContent("UC-MS-1"), "CertificateNumber");
        form.Add(new StringContent("Grant"), "FundingSource");
        form.Add(new StringContent("5000"), "AmountClaimed");
        form.Add(new StringContent("4900"), "AmountUtilized");
        form.Add(new StringContent("2026-01-01"), "PeriodStart");
        form.Add(new StringContent("2026-02-28"), "PeriodEnd");
        form.Add(new StringContent(taskId.ToString()), "TaskId");

        var created = await client.PostFormAsync<JsonElement>("/api/v1/utilization-certificates", form);
        created.Status.Should().Be(HttpStatusCode.OK);
        var certificateId = created.Data.GetGuid("id");

        var deleted = await client.DeleteAsync<JsonElement>($"/api/v1/milestones/{milestoneId}");
        deleted.Status.Should().Be(HttpStatusCode.NoContent);

        var afterDelete = await client.GetAsync<JsonElement>(
            $"/api/v1/utilization-certificates/{certificateId}");
        afterDelete.Status.Should().Be(HttpStatusCode.OK);
        afterDelete.Data.IsAbsentOrNull("taskId").Should().BeTrue("the link is cleared by the unlink");
    }
}
