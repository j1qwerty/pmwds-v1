namespace PMWDS.Application.DTOs.Reports;
public record ReportFilterDto(
    DateTime? StartDate,
    DateTime? EndDate,
    Guid? DepartmentId,
    string? EmployeeId,
    Guid? ProjectId,
    string? Status
);

public record DateRange(DateTime Start, DateTime End);

public record CustomReportDto(
    string ReportName,
    List<string> Columns,
    ReportFilterDto Filters,
    string GroupBy,
    string SortBy,
    bool SortDescending,
    string Format // pdf, excel, csv
);

public record ScheduledReportDto(
    Guid ReportId,
    string ReportType,
    string Frequency, // Daily, Weekly, Monthly
    string RecipientEmails, // Comma-separated
    ReportFilterDto Filters,
    string Format
);