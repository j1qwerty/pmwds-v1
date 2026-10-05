namespace PMWDS.Domain.Enums;

public enum AvailabilityStatus
{
    Available = 0,
    Busy = 1,
    OnLeave = 2,
    PartiallyBusy = 3
}
public enum NotificationType
{
    TaskAssigned = 0,
    TaskDeadline = 1,
    TaskDelayed = 2,
    TaskEscalated = 3,
    MilestoneAlert = 4,
    ProjectAlert = 5,
    BudgetAlert = 6,
    AIInsight = 7,
    SystemAlert = 8
}
public enum NotificationPriority
{
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3
}