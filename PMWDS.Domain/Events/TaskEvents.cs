using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Domain.Events;

public sealed class TaskAssignedEvent : DomainEvent
{
    public Guid TaskId { get; }
    public string AssigneeId { get; }
    public string AssignedBy { get; }
    public override string EventType => "TaskAssigned";
    public TaskAssignedEvent(
    Guid taskId, string assigneeId, string assignedBy)
    {
        TaskId = taskId;
        AssigneeId = assigneeId;
        AssignedBy = assignedBy;
    }
}
public sealed class TaskStatusChangedEvent : DomainEvent
{
    public Guid TaskId { get; }
    public TaskStatus OldStatus { get; }
    public TaskStatus NewStatus { get; }
    public override string EventType => "TaskStatusChanged";
    public TaskStatusChangedEvent(
    Guid id, TaskStatus old, TaskStatus @new)
    {
        TaskId = id;
        OldStatus = old;
        NewStatus = @new;
    }
}
public sealed class TaskCompletedEvent : DomainEvent
{
    public Guid TaskId { get; }
    public Guid ProjectId { get; }
    public DateTime CompletedAt { get; }
    public override string EventType => "TaskCompleted";
    public TaskCompletedEvent(
    Guid taskId, Guid projectId, DateTime completedAt)
    {
        TaskId = taskId;
        ProjectId = projectId;
        CompletedAt = completedAt;
    }
}
public sealed class TaskDelayedEvent : DomainEvent
{
    public Guid TaskId { get; }
    public DateTime OriginalDue { get; }
    public string Reason { get; }
    public override string EventType => "TaskDelayed";
    public TaskDelayedEvent(
    Guid id, DateTime due, string reason)
    {
        TaskId = id;
        OriginalDue = due;
        Reason = reason;
    }
}
public sealed class TaskEscalatedEvent : DomainEvent
{
    public Guid TaskId { get; }
    public int EscalationLevel { get; }
    public override string EventType => "TaskEscalated";
    public TaskEscalatedEvent(Guid taskId, int level)
    {
        TaskId = taskId;
        EscalationLevel = level;
    }
}