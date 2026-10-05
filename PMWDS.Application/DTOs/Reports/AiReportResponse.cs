namespace PMWDS.Application.DTOs.Reports;

public record AiReportResponse(
    Guid Id,
    string ReportType,
    string Title,
    string Summary,
    List<ReportMetric> Metrics,
    List<ReportTable> Tables,
    List<ReportSection> Sections,
    List<string> Insights,
    List<string> Recommendations,
    DateTime GeneratedAt
);

public record ReportMetric(
    string Label,
    string Value,
    string Trend,
    string Icon,
    string Color
);

public record ReportTable(
    string Title,
    List<string> Columns,
    List<List<string>> Rows
);

public record ReportSection(
    string Title,
    string Content,
    string Type
);
