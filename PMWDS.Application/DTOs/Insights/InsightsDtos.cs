namespace PMWDS.Application.DTOs.Insights;

// ---------------------------------------------------------------------------
// Score conventions used by every DTO in this file:
//   * DelayRiskPercent / HealthPercent are integers 0..100, already normalised
//     by the API (the stored AIDelayRiskScore is 0..1, AIHealthScore is 0..100).
//   * Dates are UTC.
// ---------------------------------------------------------------------------

/// <summary>A project ranked by urgency (delayed first, then AI delay risk).</summary>
public record UrgentProjectDto(
    Guid Id,
    string ProjectCode,
    string Name,
    string Status,
    string Priority,
    double ProgressPercentage,
    int DelayRiskPercent,
    int HealthPercent,
    DateTime PlannedEndDate,
    bool IsDelayed,
    int DaysOverdue,
    int OpenTasks,
    int OverdueTasks);

public record DashboardProjectCountsDto(
    int Total,
    int Active,
    int Completed,
    int OnHold,
    int Delayed,
    int HighRisk,
    double AverageHealthPercent);

public record DashboardTaskCountsDto(
    int Total,
    int InProgress,
    int OnHold,
    int Completed,
    int Delayed);

public record DashboardBudgetDto(decimal Planned, decimal Spent);

public record EscalationItemDto(
    Guid Id,
    string Title,
    string Status,
    string Priority,
    Guid ProjectId,
    string? ProjectName,
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    DateTime DueDate,
    int EscalationLevel,
    DateTime? EscalatedDate);

public record ActivityTypeCountDto(string Type, int Count);

/// <summary>One UTC calendar day of team activity.</summary>
public record ActivityDayDto(
    DateOnly Date,
    int Total,
    List<ActivityTypeCountDto> ByType);

/// <summary>Everything the dashboard needs in a single round trip.</summary>
public record DashboardSummaryDto(
    DashboardProjectCountsDto Projects,
    DashboardTaskCountsDto Tasks,
    DashboardBudgetDto Budget,
    List<UrgentProjectDto> TopProjects,
    int EscalationTotal,
    List<EscalationItemDto> Escalations,
    List<ActivityDayDto> Activity,
    int UnreadNotifications,
    DateTime GeneratedAt);

public record ActivitySummaryDto(int Days, int Total, List<ActivityDayDto> Items);

// ----------------------------- My work -------------------------------------

public record MyWorkTaskDto(
    Guid Id,
    string Title,
    string Status,
    string Priority,
    Guid ProjectId,
    string? ProjectName,
    string? MilestoneName,
    DateTime DueDate,
    double ProgressPercentage,
    bool IsEscalated,
    bool IsSubtask,
    int DaysFromToday);

public record MyWorkCountsDto(int Overdue, int DueToday, int DueSoon, int InProgress);

public record MyWorkDto(
    MyWorkCountsDto Counts,
    List<MyWorkTaskDto> Overdue,
    List<MyWorkTaskDto> DueToday,
    List<MyWorkTaskDto> DueSoon,
    int HorizonDays,
    DateTime GeneratedAt);

// ------------------------- Project health timeline --------------------------

public record HealthTimelinePointDto(
    DateOnly WeekEnding,
    int TotalTasks,
    int DueTasks,
    int CompletedTasks,
    int OverdueOpenTasks,
    double PlannedPercent,
    double ActualPercent);

public record ProjectHealthTimelineDto(
    Guid ProjectId,
    string ProjectName,
    int CurrentDelayRiskPercent,
    int CurrentHealthPercent,
    string Basis,
    List<HealthTimelinePointDto> Points);

// --------------------------------- Search -----------------------------------

public record SearchHitDto(
    string Kind,
    Guid Id,
    string Title,
    string? Subtitle,
    Guid? ProjectId);

public record SearchResultsDto(
    string Query,
    List<SearchHitDto> Projects,
    List<SearchHitDto> Tasks,
    List<SearchHitDto> People,
    List<SearchHitDto> Departments);
