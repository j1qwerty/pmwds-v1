using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
using PMWDS.Domain.Events;
using PMWDS.Domain.Time;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Domain.Entities;

public class ProjectTask : AuditableEntity, IHasDomainEvents
{
    // Core Properties
    public Guid ProjectId { get; private set; }
    public Guid? MilestoneId { get; private set; }
    public Guid? ParentTaskId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public TaskStatus Status { get; private set; }
    public TaskPriority Priority { get; private set; }
    // Assignment
    public Guid? AssignedToUserId { get; private set; }
    public Guid? AssignedByUserId { get; private set; }
    public DateTime? AssignedDate { get; private set; }
    // Scheduling
    public DateTime StartDate { get; private set; }
    public DateTime DueDate { get; private set; }
    public DateTime? CompletedDate { get; private set; }
    public bool IsRecurring { get; private set; }
    public string? RecurrencePattern { get; private set; }
    // Effort
    public int EstimatedHours { get; private set; }
    public double ProgressPercentage { get; private set; }
    public string? CompletionNotes { get; private set; }
    // Escalation
    public bool IsEscalated { get; private set; }
    public int EscalationLevel { get; private set; }
    public DateTime? EscalatedDate { get; private set; }
    // AI Fields
    public double AIDelayProbability { get; private set; }
    public DateTime? AIPredictedCompletionDate { get; private set; }
    public double AIOptimalAssigneeScore { get; private set; }
    public Guid? AIRecommendedAssigneeId { get; private set; }
    public string? AIRiskFactors { get; private set; } // JSON
                                                       // Navigation
    public Project? Project { get; private set; }
    public Milestone? Milestone { get; private set; }
    public ProjectTask? ParentTask { get; private set; }
    public IReadOnlyCollection<ProjectTask> SubTasks =>
    _subTasks.AsReadOnly();
    public IReadOnlyCollection<TaskDependency> Dependencies =>
    _dependencies.AsReadOnly();
    public IReadOnlyCollection<TaskComment> Comments =>
    _comments.AsReadOnly();
    public IReadOnlyCollection<TaskAttachment> Attachments =>
    _attachments.AsReadOnly();
    public IReadOnlyCollection<TaskAssignment> Assignments =>
    _assignments.AsReadOnly();
    public ICollection<AllocationRecommendation> AllocationRecommendations { get; private set; } = new List<AllocationRecommendation>();
    public ICollection<DelayPrediction> DelayPredictions { get; private set; } = new List<DelayPrediction>();
    private readonly List<ProjectTask> _subTasks = new();
    private readonly List<TaskDependency> _dependencies = new();
    private readonly List<TaskComment> _comments = new();
    private readonly List<TaskAttachment> _attachments = new();
    private readonly List<TaskAssignment> _assignments = new();
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyList<IDomainEvent> DomainEvents =>
    _domainEvents.AsReadOnly();
    protected ProjectTask()
    {
        _subTasks = new();
        _dependencies = new();
        _comments = new();
        _attachments = new();
        _assignments = new();
        _domainEvents = new();
        AllocationRecommendations = new List<AllocationRecommendation>();
        DelayPredictions = new List<DelayPrediction>();
    }
    public static ProjectTask Create(
    Guid projectId,
    string title,
    string description,
    TaskPriority priority,
    DateTime startDate,
    DateTime dueDate,
    int estimatedHours,
    Guid? milestoneId = null,
    Guid? parentTaskId = null)
    {
        return new ProjectTask
        {
            ProjectId = projectId,
            MilestoneId = milestoneId,
            ParentTaskId = parentTaskId,
            Title = title,
            Description = description,
            Priority = priority,
            Status = TaskStatus.NotStarted,
            StartDate = startDate,
            DueDate = dueDate,
            EstimatedHours = estimatedHours
        };
    }
    public void AssignTo(Guid userId, Guid assignedBy)
    {
        AssignedToUserId = userId;
        AssignedByUserId = assignedBy;
        AssignedDate = DateTime.UtcNow;
        _domainEvents.Add(new TaskAssignedEvent(
        Id, userId.ToString(), assignedBy.ToString()));
    }
    public void UpdateDetails(
    string title,
    string description,
    TaskPriority priority,
    DateTime startDate,
    DateTime dueDate,
    int estimatedHours,
    Guid? milestoneId)
    {
        Title = title;
        Description = description;
        Priority = priority;
        StartDate = startDate;
        DueDate = dueDate;
        EstimatedHours = estimatedHours;
        MilestoneId = milestoneId;
    }
    public void UpdateStatus(TaskStatus status)
    {
        if (!Enum.IsDefined(status))
            throw new ArgumentException($"Invalid task status: {status}");
        Status = status;
        if (status == TaskStatus.Completed)
        {
            CompletedDate = DateTime.UtcNow;
            ProgressPercentage = 100;
        }
    }
    public void MarkSubtaskCompleted()
    {
        Status = TaskStatus.Completed;
        ProgressPercentage = 100;
        CompletedDate = DateTime.UtcNow;
    }
    public void ResetAllProgress()
    {
        ProgressPercentage = 0;
        foreach (var sub in _subTasks)
        {
            sub.ResetAllProgress();
        }
    }
    public void UpdateProgress(
    double percentage, string? notes = null)
    {
        ProgressPercentage = Math.Clamp(percentage, 0, 100);
        if (!string.IsNullOrEmpty(notes))
            CompletionNotes = notes;
        // Progress is the source of truth for the workflow state. Without this the status
        // stayed "NotStarted" forever once a task or subtask had any progress recorded.
        SyncStatusFromProgress();
    }

    /// <summary>
    /// Derives the workflow status from the recorded progress.
    ///
    /// Progress was previously written without ever touching <see cref="Status"/>, so a task
    /// at 80% still reported "Not Started" on every card, board and dashboard until someone
    /// set the status by hand. From here on progress is the source of truth and the status
    /// follows it:
    ///
    /// <list type="bullet">
    /// <item>100% → Completed (raising the usual completion event)</item>
    /// <item>1–99% → In Progress</item>
    /// <item>0% → Not Started</item>
    /// </list>
    ///
    /// Only <see cref="TaskStatus.OnHold"/> and <see cref="TaskStatus.Cancelled"/> are
    /// preserved, because those are deliberate human decisions that a progress edit must not
    /// silently undo. Rolling progress back below 100 does reopen a completed task, which
    /// mirrors what setting the status to In Progress by hand would have done.
    /// </summary>
    public void SyncStatusFromProgress()
    {
        // Deliberate human decisions - a progress edit must not quietly undo them.
        if (Status is TaskStatus.OnHold or TaskStatus.Cancelled)
            return;

        var clamped = Math.Clamp(ProgressPercentage, 0, 100);

        if (clamped >= 100)
        {
            if (Status != TaskStatus.Completed)
            {
                Complete();
            }
            return;
        }

        Status = clamped > 0 ? TaskStatus.InProgress : TaskStatus.NotStarted;

        // Progress was rolled back below 100, so the completion stamp is no longer valid.
        CompletedDate = null;
    }

    public void RecalculateProgressFromSubtasks()
    {
        if (_subTasks.Count == 0)
        {
            return;
        }
        var total = _subTasks.Count;
        var sum = _subTasks.Sum(st => Math.Clamp(st.ProgressPercentage, 0, 100));
        ProgressPercentage = Math.Round(sum / total, 1);
        // A parent task is derived entirely from its subtasks, so its status has to be
        // derived too - otherwise the parent stayed "Not Started" while its subtasks ran.
        SyncStatusFromProgress();
    }
    public bool HasSubTasks => _subTasks.Count > 0;
    public void AddComment(TaskComment comment)
        => _comments.Add(comment);
    public void AddAttachment(TaskAttachment attachment)
        => _attachments.Add(attachment);
    public void AddDependency(TaskDependency dependency)
        => _dependencies.Add(dependency);
    public void Complete()
    {
        Status = TaskStatus.Completed;
        CompletedDate = DateTime.UtcNow;
        ProgressPercentage = 100;
        _domainEvents.Add(
        new TaskCompletedEvent(Id, ProjectId,
        CompletedDate.Value));
    }
    public void CompleteWithSubtasks()
    {
        Complete();
        foreach (var sub in _subTasks)
        {
            sub.CompleteWithSubtasks();
        }
    }
    public void PutOnHold(string reason)
    {
        Status = TaskStatus.OnHold;
        AddComment(TaskComment.Create(
        Id, null, $"Task put on hold: {reason}", isSystem: true));
    }
    public void MarkDelayed(string reason)
    {
        Status = TaskStatus.Delayed;
        _domainEvents.Add(
        new TaskDelayedEvent(Id, DueDate, reason));
    }
    public void Escalate()
    {
        IsEscalated = true;
        EscalationLevel++;
        EscalatedDate = DateTime.UtcNow;
        _domainEvents.Add(new TaskEscalatedEvent(
        Id, EscalationLevel));
    }
    public void UpdateAIPrediction(
    double delayProbability,
    DateTime predictedCompletion,
    string? riskFactors,
    Guid? recommendedAssigneeId = null)
    {
        AIDelayProbability = delayProbability;
        AIPredictedCompletionDate = predictedCompletion;
        AIRiskFactors = riskFactors;
        AIRecommendedAssigneeId = recommendedAssigneeId;
    }
    public void UpdateAIRecommendation(
    double optimalAssigneeScore,
    Guid? recommendedAssigneeId)
    {
        AIOptimalAssigneeScore = optimalAssigneeScore;
        AIRecommendedAssigneeId = recommendedAssigneeId;
    }
    public bool IsOverdue()
        // Judged against the end of the current IST day, not `DateTime.UtcNow`. A task due
        // today is not overdue: the stored due date is midnight, so comparing it with the
        // raw UTC clock flagged work from 00:00 UTC (05:30 IST) every single morning.
        => Status != TaskStatus.Completed
        && Status != TaskStatus.Cancelled
        && AppClock.IsDueDatePassed(DueDate);
    public void ClearDomainEvents()
        => _domainEvents.Clear();
}
