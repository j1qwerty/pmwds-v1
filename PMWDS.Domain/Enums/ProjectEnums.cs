namespace PMWDS.Domain.Enums;

public enum ProjectStatus
{
    NotStarted = 0,
    InProgress = 1,
    OnHold = 2,
    Completed = 3,
    Cancelled = 4,
    Delayed = 5
}
public enum ProjectPriority
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}
public enum MilestoneStatus
{
    Pending = 0,
    InProgress = 1,
    Completed = 2,
    Delayed = 3
}
public enum MilestoneDependencyType
{
    CompletionBased = 0,
    ProgressThreshold = 1
}