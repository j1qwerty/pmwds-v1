using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using PMWDS.Application.DTOs.Reports;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.Infrastructure.Services;

public class ReportService : IReportService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    private readonly IProjectHealthService _ai;
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IReportPdfRenderer _pdfRenderer;
    private readonly IReportExcelRenderer _excelRenderer;
    private readonly ILogger<ReportService> _logger;

    public ReportService(
        IProjectHealthService ai,
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        IReportPdfRenderer pdfRenderer,
        IReportExcelRenderer excelRenderer,
        ILogger<ReportService> logger)
    {
        _ai = ai;
        _uow = uow;
        _currentUser = currentUser;
        _pdfRenderer = pdfRenderer;
        _excelRenderer = excelRenderer;
        _logger = logger;
    }

    // ──────────────────────────────────────────────
    //  JSON generation (inline viewing)
    // ──────────────────────────────────────────────

    public async Task<AiReportResponse> GenerateProjectStatusReportJsonAsync(
        Guid projectId, CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(projectId, ct)
            ?? throw new InvalidOperationException($"Project {projectId} not found.");

        var tasks = project.Tasks.ToList();
        var milestones = project.Milestones.ToList();

        var context = new
        {
            Project = new
            {
                project.Name,
                project.ProjectCode,
                project.Status,
                project.Priority,
                project.ProgressPercentage,
                project.PlannedStartDate,
                project.PlannedEndDate,
                project.ActualStartDate,
                project.ActualEndDate,
                project.PlannedBudget,
                project.ActualCost,
                BudgetVariance = project.GetBudgetVariance(),
                DelayDays = project.GetDelayDays(),
                project.AIHealthScore,
                project.AIDelayRiskScore,
                project.AIBudgetRiskScore,
            },
            Tasks = new
            {
                Total = tasks.Count,
                Completed = tasks.Count(t => t.Status == Domain.Enums.TaskStatus.Completed),
                InProgress = tasks.Count(t => t.Status == Domain.Enums.TaskStatus.InProgress),
                NotStarted = tasks.Count(t => t.Status == Domain.Enums.TaskStatus.NotStarted),
                Overdue = tasks.Count(t => t.IsOverdue()),
                Escalated = tasks.Count(t => t.IsEscalated),
                HighRisk = tasks.Count(t => t.AIDelayProbability >= 0.7),
                AvgProgress = tasks.Count > 0 ? tasks.Average(t => t.ProgressPercentage) : 0,
            },
            Milestones = new
            {
                Total = milestones.Count,
                Completed = milestones.Count(m => m.Status == Domain.Enums.MilestoneStatus.Completed),
                Delayed = milestones.Count(m => m.Status == Domain.Enums.MilestoneStatus.Delayed),
                Critical = milestones.Count(m => m.IsCritical),
            }
        };

        return await GenerateReportAsync(
            "project-status",
            "You are a project status analyst. Analyze the following project data and return a structured JSON report.",
            "Generate a comprehensive Project Status Report with metrics for health, progress, task completion, milestone tracking, and risks.",
            context, ct);
    }

    public async Task<AiReportResponse> GenerateBudgetVarianceReportJsonAsync(
        Guid projectId, CancellationToken ct = default)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(projectId, ct)
            ?? throw new InvalidOperationException($"Project {projectId} not found.");

        var tasks = project.Tasks.ToList();
        var budgetUtilization = tasks
            .GroupBy(t => t.Status)
            .ToDictionary(g => g.Key.ToString(), g => new
            {
                Count = g.Count(),
                TotalEstimatedHours = g.Sum(t => t.EstimatedHours),
                TotalActualHours = g.Sum(t => t.ActualHours)
            });

        var context = new
        {
            Project = new
            {
                project.Name,
                project.ProjectCode,
                project.PlannedBudget,
                project.ActualCost,
                BudgetVariance = project.GetBudgetVariance(),
                VariancePercent = project.PlannedBudget > 0
                    ? Math.Round((double)((project.ActualCost - project.PlannedBudget) / project.PlannedBudget * 100), 2)
                    : 0,
                project.AIBudgetRiskScore,
            },
            BudgetUtilization = budgetUtilization,
            TotalEstimatedHours = tasks.Sum(t => t.EstimatedHours),
            TotalActualHours = tasks.Sum(t => t.ActualHours),
        };

        return await GenerateReportAsync(
            "budget-variance",
            "You are a budget analyst. Analyze the following budget and spending data and return a structured JSON report.",
            "Generate a detailed Budget Variance Report with cost metrics, variance analysis, spending patterns, and recommendations.",
            context, ct);
    }

    public async Task<AiReportResponse> GenerateTaskCompletionReportJsonAsync(
        ReportGenerateRequest filters, CancellationToken ct = default)
    {
        var query = await _uow.Tasks.GetAllAsync(ct);
        var tasks = query.AsEnumerable();

        if (filters.ProjectId.HasValue)
            tasks = tasks.Where(t => t.ProjectId == filters.ProjectId.Value);
        if (filters.DepartmentId.HasValue)
            tasks = tasks.Where(t => t.Project?.DepartmentId == filters.DepartmentId.Value);
        if (filters.StartDate.HasValue)
            tasks = tasks.Where(t => t.CreatedDate >= filters.StartDate.Value);
        if (filters.EndDate.HasValue)
            tasks = tasks.Where(t => t.CreatedDate <= filters.EndDate.Value);
        if (!string.IsNullOrWhiteSpace(filters.Status))
            tasks = tasks.Where(t => t.Status.ToString().Equals(filters.Status, StringComparison.OrdinalIgnoreCase));

        var taskList = tasks.ToList();

        var byStatus = taskList
            .GroupBy(t => t.Status)
            .ToDictionary(g => g.Key.ToString(), g => g.Count());

        var byAssignee = taskList
            .Where(t => t.AssignedToUserId != null)
            .GroupBy(t => t.AssignedToUserId!.Value)
            .ToDictionary(g => g.Key.ToString(), g => new
            {
                Total = g.Count(),
                Completed = g.Count(t => t.Status == Domain.Enums.TaskStatus.Completed),
                Overdue = g.Count(t => t.IsOverdue())
            });

        var context = new
        {
            TotalTasks = taskList.Count,
            ByStatus = byStatus,
            ByAssignee = byAssignee,
            Completed = taskList.Count(t => t.Status == Domain.Enums.TaskStatus.Completed),
            Overdue = taskList.Count(t => t.IsOverdue()),
            InProgress = taskList.Count(t => t.Status == Domain.Enums.TaskStatus.InProgress),
            AvgProgress = taskList.Count > 0 ? taskList.Average(t => t.ProgressPercentage) : 0,
            AvgCompletionHours = taskList
                .Where(t => t.Status == Domain.Enums.TaskStatus.Completed && t.ActualHours > 0)
                .Select(t => t.ActualHours)
                .DefaultIfEmpty(0)
                .Average(),
        };

        return await GenerateReportAsync(
            "task-completion",
            "You are a task productivity analyst. Analyze the following task completion data and return a structured JSON report.",
            "Generate a Task Completion Report with productivity metrics, completion rates, assignee performance, and efficiency analysis.",
            context, ct);
    }

    public async Task<AiReportResponse> GenerateDepartmentWorkloadReportJsonAsync(
        Guid departmentId, DateRange dateRange, CancellationToken ct = default)
    {
        var department = await _uow.Departments.GetByIdAsync(departmentId, ct)
            ?? throw new InvalidOperationException($"Department {departmentId} not found.");

        var users = (await _uow.Users.GetByDepartmentWithSkillsAsync(departmentId, ct)).ToList();

        var allTasks = await _uow.Tasks.GetAllAsync(ct);
        var relevantTasks = allTasks
            .Where(t => t.Project?.DepartmentId == departmentId ||
                        (t.AssignedToUserId != null && users.Any(u => u.Id == t.AssignedToUserId)))
            .ToList();

        var userWorkloads = users.Select(u => new
        {
            u.FullName,
            u.JobTitle,
            u.AvailabilityPercentage,
            u.AIWorkloadScore,
            u.AIBurnoutRiskScore,
            u.AIPerformanceScore,
            ActiveTasks = relevantTasks.Count(t =>
                t.AssignedToUserId == u.Id &&
                t.Status != Domain.Enums.TaskStatus.Completed),
            CompletedTasks = relevantTasks.Count(t =>
                t.AssignedToUserId == u.Id &&
                t.Status == Domain.Enums.TaskStatus.Completed),
        }).ToList();

        var context = new
        {
            Department = new
            {
                department.Name,
                department.Code,
                department.MaxCapacity,
                CapacityUtilization = department.CalculateCapacityUtilization(),
            },
            TotalMembers = users.Count,
            AverageWorkload = users.Count > 0 ? users.Average(u => u.AIWorkloadScore) : 0,
            AverageBurnoutRisk = users.Count > 0 ? users.Average(u => u.AIBurnoutRiskScore) : 0,
            HighRiskMembers = users.Count(u => u.AIBurnoutRiskScore > 0.7),
            AvailableCount = users.Count(u => u.AvailabilityPercentage >= 80),
            OverloadedCount = users.Count(u => u.AIWorkloadScore > 80),
            UserWorkloads = userWorkloads,
        };

        return await GenerateReportAsync(
            "department-workload",
            "You are a workforce analyst. Analyze the following department workload data and return a structured JSON report.",
            "Generate a Department Workload Report with capacity metrics, workload distribution, burnout risk, and rebalancing recommendations.",
            context, ct);
    }

    public async Task<AiReportResponse> GenerateDelayAnalysisReportJsonAsync(
        ReportGenerateRequest filters, CancellationToken ct = default)
    {
        var overdueTasks = await _uow.Tasks.GetOverdueTasksAsync(ct);
        var highRiskTasks = await _uow.Tasks.GetHighRiskTasksAsync(0.7, ct);

        var allOverdue = overdueTasks.AsEnumerable();
        var allHighRisk = highRiskTasks.AsEnumerable();

        if (filters.ProjectId.HasValue)
        {
            allOverdue = allOverdue.Where(t => t.ProjectId == filters.ProjectId.Value);
            allHighRisk = allHighRisk.Where(t => t.ProjectId == filters.ProjectId.Value);
        }

        var overdueList = allOverdue.ToList();
        var highRiskList = allHighRisk.ToList();

        var context = new
        {
            OverdueTasks = new
            {
                Total = overdueList.Count,
                Items = overdueList
                    .OrderByDescending(t => t.DueDate)
                    .Take(10)
                    .Select(t => new
                    {
                        t.Title,
                        t.DueDate,
                        t.ProgressPercentage,
                        t.AIDelayProbability,
                        t.Priority,
                        AssignedTo = t.AssignedToUserId?.ToString() ?? "Unassigned",
                        ProjectName = t.Project?.Name ?? "Unknown"
                    })
            },
            HighRiskTasks = new
            {
                Total = highRiskList.Count,
                Items = highRiskList
                    .OrderByDescending(t => t.AIDelayProbability)
                    .Take(10)
                    .Select(t => new
                    {
                        t.Title,
                        t.AIDelayProbability,
                        t.AIRiskFactors,
                        t.DueDate,
                        t.Priority,
                        ProjectName = t.Project?.Name ?? "Unknown"
                    })
            },
            TotalEscalated = overdueList.Count(t => t.IsEscalated) + highRiskList.Count(t => t.IsEscalated),
            AverageDelayProbability = highRiskList.Count > 0
                ? highRiskList.Average(t => t.AIDelayProbability)
                : 0,
        };

        return await GenerateReportAsync(
            "delay-analysis",
            "You are a delay and risk analyst. Analyze the following delay and risk data and return a structured JSON report.",
            "Generate a Delay Analysis Report with delay metrics, root cause analysis, risk assessment, critical path impact, and mitigation strategies.",
            context, ct);
    }

    // ──────────────────────────────────────────────
    //  Binary download (PDF/Excel)
    // ──────────────────────────────────────────────

    public async Task<byte[]> DownloadProjectStatusReportAsync(
        Guid projectId, string format = "pdf", CancellationToken ct = default)
    {
        var report = await GenerateProjectStatusReportJsonAsync(projectId, ct);
        return await RenderToFormatAsync(report, format, ct);
    }

    public async Task<byte[]> DownloadBudgetVarianceReportAsync(
        Guid projectId, string format = "pdf", CancellationToken ct = default)
    {
        var report = await GenerateBudgetVarianceReportJsonAsync(projectId, ct);
        return await RenderToFormatAsync(report, format, ct);
    }

    public async Task<byte[]> DownloadTaskCompletionReportAsync(
        ReportFilterDto filter, string format = "pdf", CancellationToken ct = default)
    {
        var genFilter = new ReportGenerateRequest(filter.ProjectId, filter.DepartmentId, filter.StartDate, filter.EndDate, filter.Status);
        var report = await GenerateTaskCompletionReportJsonAsync(genFilter, ct);
        return await RenderToFormatAsync(report, format, ct);
    }

    public async Task<byte[]> DownloadDepartmentWorkloadReportAsync(
        Guid departmentId, DateRange dateRange, string format = "pdf", CancellationToken ct = default)
    {
        var report = await GenerateDepartmentWorkloadReportJsonAsync(departmentId, dateRange, ct);
        return await RenderToFormatAsync(report, format, ct);
    }

    public async Task<byte[]> DownloadDelayAnalysisReportAsync(
        ReportFilterDto filter, string format = "pdf", CancellationToken ct = default)
    {
        var genFilter = new ReportGenerateRequest(filter.ProjectId, filter.DepartmentId, filter.StartDate, filter.EndDate, filter.Status);
        var report = await GenerateDelayAnalysisReportJsonAsync(genFilter, ct);
        return await RenderToFormatAsync(report, format, ct);
    }

    // ──────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────

    private async Task<AiReportResponse> GenerateReportAsync(
        string reportType,
        string systemRole,
        string taskDescription,
        object contextData,
        CancellationToken ct)
    {
        var reportId = Guid.NewGuid();

        try
        {
            var systemPrompt = systemRole + @"

You MUST respond with ONLY valid JSON matching this schema:
{
  ""title"": ""string (report title)"",
  ""summary"": ""string (2-3 sentence executive summary)"",
  ""metrics"": [
    {
      ""label"": ""string (max 28 characters)"",
      ""value"": ""string (max 16 characters, keep units short)"",
      ""trend"": ""up"" | ""down"" | ""neutral"",
      ""icon"": ""one of: analytics, insights, monitoring, percent, calculate, payments, account_balance, savings, receipt_long, wallet, task_alt, checklist, check_circle, assignment, groups, person, engineering, construction, architecture, flag, emoji_events, verified, schedule, timer, warning, error, speed, inventory_2, lightbulb, report, description, summarize"",
      ""color"": ""one of: indigo, emerald, amber, red, violet, blue, cyan, orange""
    }
  ],
  ""tables"": [
    {
      ""title"": ""string"",
      ""columns"": [""string""],
      ""rows"": [[""string""]]
    }
  ],
  ""sections"": [
    {
      ""title"": ""string"",
      ""content"": ""string (paragraph)"",
      ""type"": ""analysis"" | ""detail"" | ""recommendation""
    }
  ],
  ""insights"": [""string""],
  ""recommendations"": [""string""]
}

" + taskDescription;

            var userContext = JsonSerializer.Serialize(contextData, JsonOptions);
            var responseText = await _ai.GenerateStructuredReportAsync(systemPrompt, userContext, ct);
            var parsed = ParseReportResponse(responseText, reportType);

            var report = new AiReportResponse(
                reportId,
                reportType,
                parsed.title,
                parsed.summary,
                parsed.metrics,
                parsed.tables,
                parsed.sections,
                parsed.insights,
                parsed.recommendations,
                DateTime.UtcNow);

            await StoreReportAsync(reportType, report, ct);
            return report;
        }
        catch (Exception ex)
        {
            // Log the provider error instead of silently degrading, so a wrong
            // provider/model pairing stays diagnosable.
            _logger.LogError(ex, "AI report generation failed for report type {ReportType}", reportType);
            var fallback = BuildFallbackReport(reportId, reportType, ex);
            await StoreReportAsync(reportType, fallback, ct);
            return fallback;
        }
    }

    private (string title, string summary, List<ReportMetric> metrics, List<ReportTable> tables,
             List<ReportSection> sections, List<string> insights, List<string> recommendations)
        ParseReportResponse(string responseText, string reportType)
    {
        try
        {
            var json = ExtractJson(responseText);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var title = root.TryGetProperty("title", out var t) ? t.GetString() ?? ReportTitle(reportType) : ReportTitle(reportType);
            var summary = root.TryGetProperty("summary", out var s) ? s.GetString() ?? "" : "";

            var metrics = new List<ReportMetric>();
            if (root.TryGetProperty("metrics", out var metricsEl) && metricsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in metricsEl.EnumerateArray())
                {
                    metrics.Add(new ReportMetric(
                        m.GetProperty("label").GetString() ?? "",
                        m.GetProperty("value").GetString() ?? "",
                        m.TryGetProperty("trend", out var tr) ? tr.GetString() ?? "neutral" : "neutral",
                        m.TryGetProperty("icon", out var ic) ? ic.GetString() ?? "analytics" : "analytics",
                        m.TryGetProperty("color", out var co) ? co.GetString() ?? "indigo" : "indigo"
                    ));
                }
            }

            var tables = new List<ReportTable>();
            if (root.TryGetProperty("tables", out var tablesEl) && tablesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var tbl in tablesEl.EnumerateArray())
                {
                    var cols = new List<string>();
                    if (tbl.TryGetProperty("columns", out var colsEl) && colsEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var c in colsEl.EnumerateArray())
                            cols.Add(c.GetString() ?? "");
                    }

                    var rows = new List<List<string>>();
                    if (tbl.TryGetProperty("rows", out var rowsEl) && rowsEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var row in rowsEl.EnumerateArray())
                        {
                            var rowData = new List<string>();
                            foreach (var cell in row.EnumerateArray())
                                rowData.Add(cell.GetString() ?? "");
                            rows.Add(rowData);
                        }
                    }

                    tables.Add(new ReportTable(
                        tbl.TryGetProperty("title", out var ttl) ? ttl.GetString() ?? "" : "",
                        cols, rows));
                }
            }

            var sections = new List<ReportSection>();
            if (root.TryGetProperty("sections", out var sectionsEl) && sectionsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var sec in sectionsEl.EnumerateArray())
                {
                    sections.Add(new ReportSection(
                        sec.TryGetProperty("title", out var sct) ? sct.GetString() ?? "" : "",
                        sec.TryGetProperty("content", out var sc) ? sc.GetString() ?? "" : "",
                        sec.TryGetProperty("type", out var st) ? st.GetString() ?? "analysis" : "analysis"
                    ));
                }
            }

            var insights = new List<string>();
            if (root.TryGetProperty("insights", out var insightsEl) && insightsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var ins in insightsEl.EnumerateArray())
                    insights.Add(ins.GetString() ?? "");
            }

            var recommendations = new List<string>();
            if (root.TryGetProperty("recommendations", out var recsEl) && recsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var rec in recsEl.EnumerateArray())
                    recommendations.Add(rec.GetString() ?? "");
            }

            return (title, summary, metrics, tables, sections, insights, recommendations);
        }
        catch (JsonException ex)
        {
            // Log the offending prefix: models that ignore "ONLY valid JSON" emit a preamble, a
            // markdown fence, or trailing prose, and the bare parse error is impossible to act on.
            var preview = responseText.Length > 300 ? responseText[..300] : responseText;
            _logger.LogWarning(
                "Could not parse AI report response for {ReportType}: {Message}. Response began: {Preview}",
                reportType, ex.Message, preview);

            return (ReportTitle(reportType),
                $"AI report generation returned an unexpected format: {ex.Message}",
                new List<ReportMetric>(), new List<ReportTable>(), new List<ReportSection>(),
                new List<string>(), new List<string>());
        }
    }

    /// <summary>
    /// Pulls the JSON object out of a model response. Models frequently wrap it in a markdown code
    /// fence or add a sentence of preamble, so slice from the first brace to the last one rather
    /// than assuming the response starts with JSON.
    /// </summary>
    private static string ExtractJson(string text)
    {
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start >= 0 && end > start)
            return text[start..(end + 1)];
        return text;
    }

    private static AiReportResponse BuildFallbackReport(Guid reportId, string reportType, Exception? error = null)
    {
        var title = ReportTitle(reportType);
        var detail = error is null
            ? "Configure an AI provider in Settings to enable intelligent report generation."
            : $"The configured AI provider rejected the request: {Truncate(error.Message, 300)}";

        return new AiReportResponse(
            reportId,
            reportType,
            title,
            $"{title} could not be generated with AI assistance. {detail}",
            new List<ReportMetric>(),
            new List<ReportTable>(),
            new List<ReportSection>
            {
                new("AI Generation Failed",
                    (error is null
                        ? "This report requires an AI provider (OpenAI or OpenRouter) to be configured. "
                        : $"Provider error: {Truncate(error.Message, 500)} ")
                    + "Go to AI Settings to verify the default provider, its API key, and the default model, " +
                    "then regenerate this report for AI-powered insights.",
                    "recommendation")
            },
            new List<string>
            {
                "Verify the default AI provider and model in Settings > AI Configuration.",
                error is null
                    ? "Reports require an API key for OpenAI or OpenRouter."
                    : "A model id that does not belong to the selected provider is the most common cause."
            },
            new List<string>
            {
                "Go to Settings > AI Configuration and test the provider with a custom prompt.",
                "After configuration, regenerate this report for AI-powered insights."
            },
            DateTime.UtcNow);
    }

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength] + "...";

    private static string ReportTitle(string reportType) => reportType switch
    {
        "project-status" => "Project Status Report",
        "budget-variance" => "Budget Variance Report",
        "task-completion" => "Task Completion Report",
        "department-workload" => "Department Workload Report",
        "delay-analysis" => "Delay Analysis Report",
        _ => "Report"
    };

    private async Task StoreReportAsync(string reportType, AiReportResponse report, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
            return;

        var data = JsonSerializer.SerializeToUtf8Bytes(report, JsonOptions);
        var entity = Report.Create(
            report.Title,
            reportType,
            new { generatedAt = report.GeneratedAt },
            "json",
            data,
            userId);
        entity.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.Reports.AddAsync(entity, ct);
        await _uow.SaveChangesAsync(ct);
    }

    private async Task<byte[]> RenderToFormatAsync(AiReportResponse report, string format, CancellationToken ct)
    {
        var json = JsonSerializer.SerializeToUtf8Bytes(report, JsonOptions);

        return format.ToLower() switch
        {
            "pdf" => await Task.Run(() => _pdfRenderer.Render(report), ct),
            "excel" or "xlsx" => await Task.Run(() => _excelRenderer.Render(report), ct),
            "json" => json,
            "txt" => System.Text.Encoding.UTF8.GetBytes(
                $"{report.Title}\n{new string('-', 40)}\n\n{report.Summary}\n\n" +
                string.Join("\n", report.Insights.Select(i => $"• {i}")) +
                $"\n\nRecommendations:\n" +
                string.Join("\n", report.Recommendations.Select(r => $"  - {r}"))),
            _ => json
        };
    }
}
