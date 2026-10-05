using PMWDS.Application.DTOs.Reports;
namespace PMWDS.Application.Interfaces.Services;

public interface IReportService
{
    // JSON-structured generation (for inline viewing)
    Task<AiReportResponse> GenerateProjectStatusReportJsonAsync(
        Guid projectId, CancellationToken ct = default);
    Task<AiReportResponse> GenerateBudgetVarianceReportJsonAsync(
        Guid projectId, CancellationToken ct = default);
    Task<AiReportResponse> GenerateTaskCompletionReportJsonAsync(
        ReportGenerateRequest filters, CancellationToken ct = default);
    Task<AiReportResponse> GenerateDepartmentWorkloadReportJsonAsync(
        Guid departmentId, DateRange dateRange, CancellationToken ct = default);
    Task<AiReportResponse> GenerateDelayAnalysisReportJsonAsync(
        ReportGenerateRequest filters, CancellationToken ct = default);

    // Binary download (PDF/Excel/CSV — backed by QuestPDF/ClosedXML)
    Task<byte[]> DownloadProjectStatusReportAsync(
        Guid projectId, string format = "pdf",
        CancellationToken ct = default);
    Task<byte[]> DownloadBudgetVarianceReportAsync(
        Guid projectId, string format = "pdf",
        CancellationToken ct = default);
    Task<byte[]> DownloadTaskCompletionReportAsync(
        ReportFilterDto filter, string format = "pdf",
        CancellationToken ct = default);
    Task<byte[]> DownloadDepartmentWorkloadReportAsync(
        Guid departmentId, DateRange dateRange,
        string format = "pdf",
        CancellationToken ct = default);
    Task<byte[]> DownloadDelayAnalysisReportAsync(
        ReportFilterDto filter, string format = "pdf",
        CancellationToken ct = default);
}
