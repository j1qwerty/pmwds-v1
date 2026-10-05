namespace PMWDS.Application.DTOs.Reports;

public record ReportGenerateRequest(
    Guid? ProjectId,
    Guid? DepartmentId,
    DateTime? StartDate,
    DateTime? EndDate,
    string? Status
);
