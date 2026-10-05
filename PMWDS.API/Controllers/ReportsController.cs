using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Reports;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using System.Text;
using System.Text.Json;

namespace PMWDS.API.Controllers;

public class ReportsController : BaseApiController
{
    private readonly IReportService _reports;
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly RoleScopeService _scope;

    public ReportsController(
        IMediator mediator,
        IReportService reports,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        RoleScopeService scope) : base(mediator)
    {
        _reports = reports;
        _uow = uow;
        _currentUser = currentUser;
        _scope = scope;
    }

    // ──────────────────────────────────────────────
    //  JSON generation endpoints (inline viewing)
    // ──────────────────────────────────────────────

    [HttpPost("project-status/generate")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<ActionResult<AiReportResponse>> GenerateProjectStatus(
        [FromBody] ReportGenerateRequest req,
        CancellationToken ct = default)
    {
        if (!req.ProjectId.HasValue)
            return BadRequest(new { message = "ProjectId is required." });
        if (!await _scope.CanAccessProjectAsync(req.ProjectId.Value, ct))
            return Forbid();

        var report = await _reports.GenerateProjectStatusReportJsonAsync(req.ProjectId.Value, ct);
        return Ok(report);
    }

    [HttpPost("budget-variance/generate")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<ActionResult<AiReportResponse>> GenerateBudgetVariance(
        [FromBody] ReportGenerateRequest req,
        CancellationToken ct = default)
    {
        if (!req.ProjectId.HasValue)
            return BadRequest(new { message = "ProjectId is required." });
        if (!await _scope.CanAccessProjectAsync(req.ProjectId.Value, ct))
            return Forbid();

        var report = await _reports.GenerateBudgetVarianceReportJsonAsync(req.ProjectId.Value, ct);
        return Ok(report);
    }

    [HttpPost("task-completion/generate")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<ActionResult<AiReportResponse>> GenerateTaskCompletion(
        [FromBody] ReportGenerateRequest req,
        CancellationToken ct = default)
    {
        if (req.ProjectId.HasValue && !await _scope.CanAccessProjectAsync(req.ProjectId.Value, ct))
            return Forbid();
        if (req.DepartmentId.HasValue && !await _scope.CanAccessDepartmentAsync(req.DepartmentId.Value, ct))
            return Forbid();

        var report = await _reports.GenerateTaskCompletionReportJsonAsync(req, ct);
        return Ok(report);
    }

    [HttpPost("department-workload/generate")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<ActionResult<AiReportResponse>> GenerateDepartmentWorkload(
        [FromBody] DepartmentWorkloadRequest req,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessDepartmentAsync(req.DepartmentId, ct))
            return Forbid();

        var report = await _reports.GenerateDepartmentWorkloadReportJsonAsync(
            req.DepartmentId, new DateRange(req.StartDate, req.EndDate), ct);
        return Ok(report);
    }

    [HttpPost("delay-analysis/generate")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<ActionResult<AiReportResponse>> GenerateDelayAnalysis(
        [FromBody] ReportGenerateRequest req,
        CancellationToken ct = default)
    {
        if (req.ProjectId.HasValue && !await _scope.CanAccessProjectAsync(req.ProjectId.Value, ct))
            return Forbid();
        if (req.DepartmentId.HasValue && !await _scope.CanAccessDepartmentAsync(req.DepartmentId.Value, ct))
            return Forbid();

        var report = await _reports.GenerateDelayAnalysisReportJsonAsync(req, ct);
        return Ok(report);
    }

    // ──────────────────────────────────────────────
    //  Binary download endpoints (PDF/Excel/CSV)
    // ──────────────────────────────────────────────

    [HttpGet("project-status/{projectId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DownloadProjectStatus(
        Guid projectId,
        [FromQuery] string format = "pdf",
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
            return Forbid();

        var bytes = await _reports.DownloadProjectStatusReportAsync(projectId, format, ct);
        return File(bytes, GetContentType(format), $"project-status.{format}");
    }

    [HttpPost("task-completion")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DownloadTaskCompletion(
        [FromBody] ReportFilterDto filter,
        [FromQuery] string format = "pdf",
        CancellationToken ct = default)
    {
        if (!await CanAccessReportFilterAsync(filter, ct))
            return Forbid();

        var bytes = await _reports.DownloadTaskCompletionReportAsync(filter, format, ct);
        return File(bytes, GetContentType(format), $"task-completion.{format}");
    }

    [HttpPost("department-workload")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DownloadDepartmentWorkload(
        [FromBody] DepartmentWorkloadRequest req,
        [FromQuery] string format = "pdf",
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessDepartmentAsync(req.DepartmentId, ct))
            return Forbid();

        var bytes = await _reports.DownloadDepartmentWorkloadReportAsync(
            req.DepartmentId, new DateRange(req.StartDate, req.EndDate), format, ct);
        return File(bytes, GetContentType(format), $"department-workload.{format}");
    }

    [HttpGet("budget-variance/{projectId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DownloadBudgetVariance(
        Guid projectId,
        [FromQuery] string format = "pdf",
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
            return Forbid();

        var bytes = await _reports.DownloadBudgetVarianceReportAsync(projectId, format, ct);
        return File(bytes, GetContentType(format), $"budget-variance.{format}");
    }

    [HttpPost("delay-analysis")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DownloadDelayAnalysis(
        [FromBody] ReportFilterDto filter,
        [FromQuery] string format = "pdf",
        CancellationToken ct = default)
    {
        if (!await CanAccessReportFilterAsync(filter, ct))
            return Forbid();

        var bytes = await _reports.DownloadDelayAnalysisReportAsync(filter, format, ct);
        return File(bytes, GetContentType(format), $"delay-analysis.{format}");
    }

    // ──────────────────────────────────────────────
    //  Stored reports CRUD
    // ──────────────────────────────────────────────

    [HttpGet("stored")]
    public async Task<IActionResult> GetStoredReports(CancellationToken ct)
        => Ok((await _uow.Reports.GetAllAsync(ct)).OrderByDescending(r => r.GeneratedDate).Select(MapReport));

    [HttpGet("stored/{id:guid}")]
    public async Task<IActionResult> GetStoredReport(Guid id, CancellationToken ct)
    {
        var report = await _uow.Reports.GetByIdAsync(id, ct);
        if (report == null)
            return NotFound();

        var schedules = (await _uow.ReportSchedules.FindAsync(s => s.ReportId == id, ct))
            .Select(MapSchedule).ToList();
        return Ok(new StoredReportDetailResponse(MapReport(report), schedules));
    }

    [HttpGet("stored/{id:guid}/download")]
    public async Task<IActionResult> DownloadStoredReport(Guid id, CancellationToken ct)
    {
        var report = await _uow.Reports.GetByIdAsync(id, ct);
        return report == null
            ? NotFound()
            : File(report.Data, GetContentType(report.Format), $"{report.Name}.{report.Format}");
    }

    [HttpPost("stored")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> CreateStoredReport([FromBody] UpsertStoredReportRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
            return Unauthorized();

        var data = string.IsNullOrWhiteSpace(req.ContentBase64)
            ? Encoding.UTF8.GetBytes(JsonSerializer.Serialize(req.Parameters))
            : Convert.FromBase64String(req.ContentBase64);

        var report = Report.Create(req.Name, req.ReportType, req.Parameters, req.Format, data, userId);
        report.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.Reports.AddAsync(report, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetStoredReport), new { id = report.Id }, MapReport(report));
    }

    [HttpPut("stored/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> UpdateStoredReport(Guid id, [FromBody] UpsertStoredReportRequest req, CancellationToken ct)
    {
        var report = await _uow.Reports.GetByIdAsync(id, ct);
        if (report == null)
            return NotFound();

        report.UpdateMetadata(req.Name, req.ReportType, req.Parameters, req.Format);
        if (!string.IsNullOrWhiteSpace(req.ContentBase64))
            report.ReplaceData(Convert.FromBase64String(req.ContentBase64));

        await _uow.Reports.UpdateAsync(report, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapReport(report));
    }

    [HttpDelete("stored/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DeleteStoredReport(Guid id, CancellationToken ct)
    {
        await _uow.Reports.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    // ──────────────────────────────────────────────
    //  Schedules
    // ──────────────────────────────────────────────

    [HttpGet("schedules")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetSchedules(CancellationToken ct)
        => Ok((await _uow.ReportSchedules.GetAllAsync(ct)).OrderBy(s => s.NextRun).Select(MapSchedule));

    [HttpPost("schedules")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> CreateSchedule([FromBody] UpsertReportScheduleRequest req, CancellationToken ct)
    {
        var report = await _uow.Reports.GetByIdAsync(req.ReportId, ct);
        if (report == null)
            return NotFound(new { message = "Report not found." });

        var schedule = ReportSchedule.Create(req.ReportId, req.Frequency, req.NextRun, req.Recipients, req.DeliveryOptions, req.IsActive);
        schedule.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.ReportSchedules.AddAsync(schedule, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetSchedules), new { id = schedule.Id }, MapSchedule(schedule));
    }

    [HttpPut("schedules/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> UpdateSchedule(Guid id, [FromBody] UpsertReportScheduleRequest req, CancellationToken ct)
    {
        var schedule = await _uow.ReportSchedules.GetByIdAsync(id, ct);
        if (schedule == null)
            return NotFound();

        schedule.Update(req.Frequency, req.NextRun, req.Recipients, req.DeliveryOptions, req.IsActive);
        await _uow.ReportSchedules.UpdateAsync(schedule, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapSchedule(schedule));
    }

    [HttpDelete("schedules/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> DeleteSchedule(Guid id, CancellationToken ct)
    {
        await _uow.ReportSchedules.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    // ──────────────────────────────────────────────
    //  Mappers & helpers
    // ──────────────────────────────────────────────

    private static StoredReportResponse MapReport(Report report)
        => new(
            report.Id,
            report.Name,
            report.ReportType,
            JsonSerializer.Deserialize<Dictionary<string, object>>(report.ParametersJson) ?? new(),
            report.GeneratedDate,
            report.Format,
            report.GeneratedByUserId,
            report.Data.Length);

    private async Task<bool> CanAccessReportFilterAsync(ReportFilterDto filter, CancellationToken ct)
    {
        if (filter.ProjectId.HasValue && !await _scope.CanAccessProjectAsync(filter.ProjectId.Value, ct))
            return false;

        if (filter.DepartmentId.HasValue && !await _scope.CanAccessDepartmentAsync(filter.DepartmentId.Value, ct))
            return false;

        return true;
    }

    private static ReportScheduleResponse MapSchedule(ReportSchedule schedule)
        => new(
            schedule.Id,
            schedule.ReportId,
            schedule.Frequency,
            schedule.NextRun,
            schedule.LastRun,
            JsonSerializer.Deserialize<List<string>>(schedule.RecipientsJson) ?? new(),
            JsonSerializer.Deserialize<Dictionary<string, object>>(schedule.DeliveryOptionsJson) ?? new(),
            schedule.IsActive);

    private static string GetContentType(string format)
        => format.ToLower() switch
        {
            "pdf" => "application/pdf",
            "excel" or "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv" => "text/csv",
            "json" => "application/json",
            "txt" => "text/plain",
            _ => "application/octet-stream"
        };
}
