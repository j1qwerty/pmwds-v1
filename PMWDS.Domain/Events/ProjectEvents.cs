using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
namespace PMWDS.Domain.Events;

public sealed class ProjectCreatedEvent : DomainEvent
{
    public Guid ProjectId { get; }
    public string ProjectName { get; }
    public override string EventType => "ProjectCreated";
    public ProjectCreatedEvent(Guid projectId, string name)
    {
        ProjectId = projectId;
        ProjectName = name;
    }
}
public sealed class ProjectStatusChangedEvent : DomainEvent
{
    public Guid ProjectId { get; }
    public ProjectStatus OldStatus { get; }
    public ProjectStatus NewStatus { get; }
    public override string EventType => "ProjectStatusChanged";
    public ProjectStatusChangedEvent(
    Guid id, ProjectStatus old, ProjectStatus @new)
    {
        ProjectId = id;
        OldStatus = old;
        NewStatus = @new;
    }
}
public sealed class ProjectDelayedEvent : DomainEvent
{
    public Guid ProjectId { get; }
    public DateTime OriginalEndDate { get; }
    public DateTime NewEndDate { get; }
    public string Justification { get; }
    public override string EventType => "ProjectDelayed";
    public ProjectDelayedEvent(
    Guid id, DateTime orig,
    DateTime newDate, string justification)
    {
        ProjectId = id;
        OriginalEndDate = orig;
        NewEndDate = newDate;
        Justification = justification;
    }
}
public sealed class ProjectBudgetAlertEvent : DomainEvent
{
    public Guid ProjectId { get; }
    public decimal ActualCost { get; }
    public decimal PlannedBudget { get; }
    public override string EventType => "ProjectBudgetAlert";
    public ProjectBudgetAlertEvent(
    Guid id, decimal actual, decimal planned)
    {
        ProjectId = id;
        ActualCost = actual;
        PlannedBudget = planned;
    }
}
//
