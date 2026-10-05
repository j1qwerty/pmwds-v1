using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Domain.Entities;

public class Milestone : AuditableEntity
{
    public Guid ProjectId { get; private set; }
    public Guid? DepartmentId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public int Order { get; private set; }
    public DateTime DueDate { get; private set; }
    public DateTime? CompletedDate { get; private set; }
    public MilestoneStatus Status { get; private set; }
    public bool IsCritical { get; private set; }
    public double ProgressPercentage { get; private set; }
    // Navigation
    public Project? Project { get; private set; }
    public Department? Department { get; private set; }
    public IReadOnlyCollection<ProjectTask> Tasks =>
    _tasks.AsReadOnly();
    private readonly List<ProjectTask> _tasks = new();
    public IReadOnlyCollection<MilestoneDependency> PrerequisiteDependencies =>
    _prerequisiteDependencies.AsReadOnly();
    private readonly List<MilestoneDependency> _prerequisiteDependencies = new();
    public IReadOnlyCollection<MilestoneDependency> DependentDependencies =>
    _dependentDependencies.AsReadOnly();
    private readonly List<MilestoneDependency> _dependentDependencies = new();
    protected Milestone() { }
    public static Milestone Create(
    Guid projectId, string name,
    string description, DateTime dueDate,
    int order, bool isCritical = false,
    Guid? departmentId = null)
    {
        return new Milestone
        {
            ProjectId = projectId,
            DepartmentId = departmentId,
            Name = name,
            Description = description,
            DueDate = dueDate,
            Order = order,
            IsCritical = isCritical,
            Status = MilestoneStatus.Pending

        };
    }
    public void MarkComplete()
    {
        Status = MilestoneStatus.Completed;
        CompletedDate = DateTime.UtcNow;
        ProgressPercentage = 100;
    }
    public void SetStatus(MilestoneStatus status)
    {
        Status = status;
        if (status == MilestoneStatus.Completed)
        {
            CompletedDate ??= DateTime.UtcNow;
        }
    }
    public void Update(
    string name,
    string description,
    DateTime dueDate,
    int order,
    bool isCritical,
    Guid? departmentId = null)
    {
        Name = name;
        Description = description;
        DueDate = dueDate;
        Order = order;
        IsCritical = isCritical;
        DepartmentId = departmentId;
    }
    public void AssignDepartment(Guid? departmentId)
    {
        DepartmentId = departmentId;
    }
    public void UpdateProgress(double percentage)
    {
        ProgressPercentage = Math.Clamp(percentage, 0, 100);
        if (percentage >= 100) MarkComplete();
    }
    public double RecalculateProgressFromTasks()
    {
        if (_tasks.Count == 0) return ProgressPercentage;
        var sum = _tasks.Sum(t => Math.Clamp(t.ProgressPercentage, 0, 100));
        ProgressPercentage = Math.Round(sum / _tasks.Count, 1);
        return ProgressPercentage;
    }

    public void RecalculateStatusFromTasks()
    {
        if (_tasks.Count == 0) return;
        if (_tasks.All(t => t.Status == TaskStatus.Completed))
        {
            Status = MilestoneStatus.Completed;
            CompletedDate ??= DateTime.UtcNow;
            ProgressPercentage = 100;
        }
        else if (_tasks.Any(t => t.Status == TaskStatus.Delayed))
        {
            Status = MilestoneStatus.Delayed;
        }
        else if (_tasks.Any(t => t.ProgressPercentage > 0 || t.Status == TaskStatus.InProgress))
        {
            if (Status == MilestoneStatus.Pending)
                Status = MilestoneStatus.InProgress;
        }
    }
    public void CompleteAllTasks()
    {
        foreach (var task in _tasks)
        {
            task.CompleteWithSubtasks();
        }
        MarkComplete();
    }
    public int GetIncompleteTaskCount()
    {
        return _tasks.Count(t => t.Status != TaskStatus.Completed);
    }
    public bool AllTasksCompleted => _tasks.Count > 0
        && _tasks.All(t => t.Status == TaskStatus.Completed);
    public bool HasTasks => _tasks.Count > 0;
    public bool IsOverdue() => Status != MilestoneStatus.Completed
    && DateTime.UtcNow > DueDate;
    public int GetDaysRemaining()
    => (int)(DueDate - DateTime.UtcNow).TotalDays;

    public bool IsBlocked
    {
        get
        {
            if (_dependentDependencies.Count == 0) return false;
            return _dependentDependencies.Any(dep => !dep.IsMet(
                dep.PrerequisiteMilestone ?? throw new InvalidOperationException("Prerequisite milestone not loaded")));
        }
    }

    public string? BlockedByMessage
    {
        get
        {
            if (!IsBlocked) return null;
            var blockers = _dependentDependencies
                .Where(dep => !dep.IsMet(
                    dep.PrerequisiteMilestone ?? throw new InvalidOperationException("Prerequisite milestone not loaded")))
                .Select(dep =>
                {
                    var name = dep.PrerequisiteMilestone?.Name ?? "Unknown";
                    return dep.Type switch
                    {
                        MilestoneDependencyType.CompletionBased => $"\"{name}\" (must be completed)",
                        MilestoneDependencyType.ProgressThreshold => $"\"{name}\" (must reach {dep.ThresholdPercentage}% progress)",
                        _ => $"\"{name}\""
                    };
                });
            return $"Blocked by: {string.Join(", ", blockers)}";
        }
    }
}
