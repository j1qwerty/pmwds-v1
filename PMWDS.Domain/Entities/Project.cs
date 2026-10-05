using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
using PMWDS.Domain.Events;
namespace PMWDS.Domain.Entities;

public class Project : AuditableEntity, IHasDomainEvents
{
   // Core Properties
   public string ProjectCode { get; private set; } = string.Empty;
   public string Name { get; private set; } = string.Empty;
   public string Description { get; private set; } = string.Empty;
   public string Category { get; private set; } = string.Empty;
   public ProjectPriority Priority { get; private set; }
   public ProjectStatus Status { get; private set; }
   // Organization
   public Guid DepartmentId { get; private set; }
   public Guid? ProjectManagerId { get; private set; }
   public string? ClientName { get; private set; }
   public string? StakeholderIds { get; private set; } // JSON
                                                       // Timeline
   public DateTime PlannedStartDate { get; private set; }
   public DateTime PlannedEndDate { get; private set; }
   public DateTime? ActualStartDate { get; private set; }
   public DateTime? ActualEndDate { get; private set; }
   public DateTime BaselineEndDate { get; private set; }
   // Budget
   public decimal PlannedBudget { get; private set; }
   public decimal ActualCost { get; private set; }
   // Progress
   public double ProgressPercentage { get; private set; }
   public string? DelayJustification { get; private set; }
   // AI Fields
   public double AIHealthScore { get; private set; }
   public double AIDelayRiskScore { get; private set; }
   public double AIBudgetRiskScore { get; private set; }
   public string? AIInsightsSummary { get; private set; }
   public DateTime? LastAIAnalysis { get; private set; }
   // Navigation
   public Department? Department { get; private set; }
   public IReadOnlyCollection<ProjectDepartment> ProjectDepartments =>
   _projectDepartments.AsReadOnly();
   public IReadOnlyCollection<Milestone> Milestones => _milestones.AsReadOnly();
   public IReadOnlyCollection<ProjectTask> Tasks => _tasks.AsReadOnly();
   public IReadOnlyCollection<ProjectDocument> Documents =>
   _documents.AsReadOnly();
   private readonly List<Milestone> _milestones = new();
   private readonly List<ProjectTask> _tasks = new();
   private readonly List<ProjectDocument> _documents = new();
   private readonly List<ProjectDepartment> _projectDepartments = new();
   private readonly List<IDomainEvent> _domainEvents = new();
   public IReadOnlyList<IDomainEvent> DomainEvents =>
   _domainEvents.AsReadOnly();
   protected Project() { }
    public static Project Create(
    string name,
    string description,
    string category,
    ProjectPriority priority,
    Guid departmentId,
    Guid? projectManagerId,
    DateTime plannedStartDate,
    DateTime plannedEndDate,
    decimal plannedBudget,
    string? clientName = null,
    string? projectCode = null)
    {
       var project = new Project
       {
          ProjectCode = projectCode ?? GenerateCode(category),
         Name = name,
         Description = description,
         Category = category,
         Priority = priority,
         Status = ProjectStatus.NotStarted,
         DepartmentId = departmentId,
         ProjectManagerId = projectManagerId,
         PlannedStartDate = plannedStartDate,
         PlannedEndDate = plannedEndDate,
         BaselineEndDate = plannedEndDate,
         PlannedBudget = plannedBudget,
         ActualCost = 0,
         ClientName = clientName,
         ProgressPercentage = 0,
         AIHealthScore = 100
      };
      project.AssignDepartments(new[] { departmentId });
      project._domainEvents.Add(
      new ProjectCreatedEvent(project.Id, project.Name));
      return project;
   }
   public void Start()
   {
      if (Status != ProjectStatus.NotStarted)
         throw new InvalidOperationException(
         "Only NotStarted projects can be started.");
      Status = ProjectStatus.InProgress;
      ActualStartDate = DateTime.UtcNow;
      _domainEvents.Add(new ProjectStatusChangedEvent(
      Id, ProjectStatus.NotStarted, ProjectStatus.InProgress));
   }
   public void Complete()
   {
      Status = ProjectStatus.Completed;
      ActualEndDate = DateTime.UtcNow;
      ProgressPercentage = 100;
      _domainEvents.Add(new ProjectStatusChangedEvent(
      Id, ProjectStatus.InProgress, ProjectStatus.Completed));
   }
   public void PutOnHold(string justification)
   {
      Status = ProjectStatus.OnHold;
      DelayJustification = justification;
   }
   public void Update(
   string name,
   string description,
   string category,
   DateTime plannedStartDate,
   DateTime plannedEndDate,
   decimal plannedBudget,
   ProjectPriority priority,
   Guid departmentId,
   Guid? projectManagerId)
   {
      Name = name;
      Description = description;
      Category = category;
      DepartmentId = departmentId;
      ProjectManagerId = projectManagerId;
      PlannedStartDate = plannedStartDate;
      PlannedEndDate = plannedEndDate;
      PlannedBudget = plannedBudget;
      Priority = priority;
      AssignDepartments(new[] { departmentId });
   }
   public void AssignDepartments(IEnumerable<Guid> departmentIds)
   {
      var requested = departmentIds
      .Append(DepartmentId)
      .Where(id => id != Guid.Empty)
      .Distinct()
      .ToList();

      var primary = requested.Contains(DepartmentId)
      ? DepartmentId
      : requested.FirstOrDefault();
      if (primary != Guid.Empty)
      {
         DepartmentId = primary;
      }

      _projectDepartments.RemoveAll(assignment => !requested.Contains(assignment.DepartmentId));
      foreach (var assignment in _projectDepartments)
      {
         if (assignment.DepartmentId == DepartmentId)
            assignment.MarkPrimary();
         else
            assignment.ClearPrimary();
      }

      foreach (var departmentId in requested.Where(id => _projectDepartments.All(assignment => assignment.DepartmentId != id)))
      {
         _projectDepartments.Add(ProjectDepartment.Create(Id, departmentId, departmentId == DepartmentId));
      }
   }
   public void UpdateStatus(ProjectStatus newStatus)
   {
      switch (newStatus)
      {
         case ProjectStatus.NotStarted:
            Status = ProjectStatus.NotStarted;
            ActualStartDate = null;
            ActualEndDate = null;
            break;
         case ProjectStatus.InProgress:
            if (Status == ProjectStatus.NotStarted)
               ActualStartDate = DateTime.UtcNow;
            Status = ProjectStatus.InProgress;
            break;
         case ProjectStatus.OnHold:
            Status = ProjectStatus.OnHold;
            break;
         case ProjectStatus.Completed:
            Status = ProjectStatus.Completed;
            ActualEndDate = DateTime.UtcNow;
            ProgressPercentage = 100;
            break;
         case ProjectStatus.Cancelled:
         case ProjectStatus.Delayed:
            Status = newStatus;
            break;
      }
   }
   public void UpdateTimeline(
   DateTime newEndDate, string justification)
   {
      if (newEndDate < PlannedEndDate)
         throw new InvalidOperationException(
         "New end date must be after planned end date.");
      PlannedEndDate = newEndDate;
      DelayJustification = justification;
      _domainEvents.Add(new ProjectDelayedEvent(
      Id, BaselineEndDate, newEndDate, justification));
   }
    public void UpdateProgress(double percentage)
    {
       ProgressPercentage = Math.Clamp(percentage, 0, 100);
    }
    public double RecalculateProgressFromMilestones()
    {
       if (_milestones.Count == 0) return ProgressPercentage;
       var sum = _milestones.Sum(m => Math.Clamp(m.ProgressPercentage, 0, 100));
       ProgressPercentage = Math.Round(sum / _milestones.Count, 1);
       return ProgressPercentage;
    }
    public void RecalculateStatusFromMilestones()
    {
       if (_milestones.Count == 0) return;
       if (_milestones.All(m => m.Status == MilestoneStatus.Completed))
       {
          Status = ProjectStatus.Completed;
          ProgressPercentage = 100;
       }
       else if (_milestones.Any(m => m.Status == MilestoneStatus.Delayed))
       {
          Status = ProjectStatus.Delayed;
       }
       else if (_milestones.Any(m => m.ProgressPercentage > 0 || m.Status == MilestoneStatus.InProgress))
       {
          if (Status == ProjectStatus.NotStarted)
             Status = ProjectStatus.InProgress;
       }
    }
   public void AddActualCost(decimal cost)
   {
      ActualCost += cost;
      if (ActualCost > PlannedBudget * 0.9m)
         _domainEvents.Add(
         new ProjectBudgetAlertEvent(Id, ActualCost,
         PlannedBudget));
   }
   public void AddMilestone(Milestone milestone)
   => _milestones.Add(milestone);
   public void AddDocument(ProjectDocument document)
   => _documents.Add(document);
   public void UpdateAIAnalysis(
   double healthScore,
   double delayRisk,
   double budgetRisk,
   string insightsSummary)
   {
      AIHealthScore = healthScore;
      AIDelayRiskScore = delayRisk;
      AIBudgetRiskScore = budgetRisk;
      AIInsightsSummary = insightsSummary;
      LastAIAnalysis = DateTime.UtcNow;
   }
   public decimal GetBudgetVariance()
   => PlannedBudget - ActualCost;
   public int GetDelayDays()
   {
      var compareDate = ActualEndDate ?? DateTime.UtcNow;
      return compareDate > PlannedEndDate
      ? (int)(compareDate - PlannedEndDate).TotalDays
      : 0;
   }
   public bool IsOverBudget()
   => ActualCost > PlannedBudget;
   public void ClearDomainEvents()
   => _domainEvents.Clear();
   private static string GenerateCode(string category)
   {
      var prefix = category.Length >= 3
      ? category[..3].ToUpper()
      : category.ToUpper();
      return $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
   }
}
