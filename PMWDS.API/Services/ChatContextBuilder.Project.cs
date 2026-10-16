using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Common;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

// See ChatContextBuilder.cs: the domain TaskStatus shadows System.Threading.Tasks.TaskStatus.
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Services;

/// <summary>
/// What the signed-in user may see of one project through the AI tab. The client uses
/// the same flags to decide which sections to draw, and the server uses them to decide
/// which sections of the dossier exist at all - one computation, two consumers, so the
/// screen and the assistant cannot disagree.
/// </summary>
public sealed record ProjectAiCapabilities(
    bool Ai,
    bool FullProjectDetails,
    bool Tasks,
    bool Subtasks,
    bool Milestones,
    bool Documents,
    bool People,
    bool Budget)
{
    public static ProjectAiCapabilities None { get; } = new(false, false, false, false, false, false, false, false);

    /// <summary>
    /// Stable string for the permission set. Part of the chat session key so a person
    /// whose permissions change never inherits a conversation built under the old ones.
    /// </summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public string Fingerprint => string.Concat(
        Bit(Ai), Bit(FullProjectDetails), Bit(Tasks), Bit(Subtasks),
        Bit(Milestones), Bit(Documents), Bit(People), Bit(Budget));

    /// <summary>Plain-language names of the areas this person can ask about.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public IReadOnlyList<string> AvailableAreas
    {
        get
        {
            var areas = new List<string> { "project status" };
            if (Tasks) areas.Add("tasks");
            if (Milestones) areas.Add("milestones");
            if (Documents) areas.Add("documents");
            if (People) areas.Add("team workload");
            if (Budget) areas.Add("budget");
            return areas;
        }
    }

    private static char Bit(bool value) => value ? '1' : '0';
}

public enum ProjectChatOutcome
{
    /// <summary>The dossier is ready; send it to the model.</summary>
    Ready,

    /// <summary>The project does not exist for this person, or they lack AI access. Answer 403.</summary>
    NoAccess,

    /// <summary>
    /// The question is about something this role cannot see. Answered with a fixed
    /// message and never sent to the model, so there is nothing for a prompt to coax out.
    /// </summary>
    Refused
}

public sealed record ProjectChatContext(
    ProjectChatOutcome Outcome,
    string Dossier,
    string? RefusalMessage,
    string SessionKey,
    ProjectAiCapabilities Capabilities);

public partial class ChatContextBuilder
{
    private sealed record ProjectScope(
        ProjectAiCapabilities Caps,
        DepartmentDataScope DocumentScope,
        IReadOnlyCollection<Guid> DepartmentIds,
        List<Guid> VisibleMilestoneIds);

    private sealed record RiskTaskRow(
        string Title,
        TaskStatus Status,
        TaskPriority Priority,
        DateTime DueDate,
        double ProgressPercentage,
        bool IsEscalated,
        int EscalationLevel,
        string? MilestoneName);

    private sealed record MilestoneRow(
        string Name,
        MilestoneStatus Status,
        bool IsCritical,
        double ProgressPercentage,
        DateTime DueDate);

    private sealed record DocumentRow(
        string Title,
        DocumentCategory Category,
        string Version,
        string? Description,
        long FileSizeBytes,
        DateTime CreatedDate,
        Guid? TaskMilestoneDepartmentId,
        Guid? MilestoneDepartmentId);

    /// <summary>
    /// Capability flags for one project, or null when the person cannot open it at all.
    /// </summary>
    public async Task<ProjectAiCapabilities?> GetProjectCapabilitiesAsync(Guid projectId, CancellationToken ct)
        => (await ResolveProjectScopeAsync(projectId, ct))?.Caps;

    /// <summary>
    /// Builds the dossier for a question asked from inside one project's AI tab.
    ///
    /// The rules mirror the project list endpoints (tasks, milestones, documents) exactly:
    /// a person who cannot see every department of the project only sees the milestones
    /// that belong to their departments, and only the tasks under those milestones. A
    /// section the person has no permission for is not merely hidden - it is never
    /// queried, so it cannot appear in the prompt.
    /// </summary>
    public async Task<ProjectChatContext?> BuildForProjectAsync(
        string userId,
        Guid projectId,
        string intent,
        CancellationToken ct)
    {
        if (!Guid.TryParse(userId, out var currentUserId))
        {
            _logger.LogWarning("Project chat context skipped: user id '{UserId}' is not a GUID.", userId);
            return null;
        }

        var scope = await ResolveProjectScopeAsync(projectId, ct);
        var denied = new ProjectChatContext(
            ProjectChatOutcome.NoAccess, "", null, "", ProjectAiCapabilities.None);

        if (scope is null || !scope.Caps.Ai)
        {
            return denied;
        }

        var project = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null)
        {
            return denied;
        }

        var caps = scope.Caps;
        var sessionKey = $"{currentUserId:N}:project:{projectId:N}:{caps.Fingerprint}";

        var missing = MissingAreaFor(intent, caps);
        if (missing is not null)
        {
            var message =
                $"Your role doesn't include access to {missing} for {project.Name}, so I can't answer that here. "
                + $"I can help with: {string.Join(", ", caps.AvailableAreas)}.";
            return new ProjectChatContext(ProjectChatOutcome.Refused, "", message, sessionKey, caps);
        }

        var today = DateTime.UtcNow.Date;
        var sb = new StringBuilder();
        var projectNames = new Dictionary<Guid, string> { [project.Id] = project.Name };

        AppendProjectScopeRules(sb, project, caps);
        await AppendIdentityAsync(sb, currentUserId, ct);
        await AppendProjectOverviewAsync(sb, project, scope, today, ct);

        switch (intent)
        {
            case ChatIntents.DelayAnalysis:
                await AppendProjectRiskAsync(sb, project, scope, today, ct);
                break;

            case ChatIntents.TaskQuery:
                await AppendProjectTasksAsync(sb, project, scope, projectNames, currentUserId, today, ct);
                break;

            case ChatIntents.TaskAssignment:
                await AppendProjectPeopleAsync(sb, project, scope, today, ct);
                await AppendProjectOpenTasksAsync(sb, project, scope, projectNames, today, ct);
                break;

            case ChatIntents.MilestoneQuery:
                await AppendProjectMilestonesAsync(sb, project, scope, today, ct);
                break;

            case ChatIntents.DocumentQuery:
                await AppendProjectDocumentsAsync(sb, project, scope, ct);
                break;

            case ChatIntents.BudgetQuery:
                // The overview already carries the budget lines when permitted.
                break;

            case ChatIntents.ResourceManagement:
                await AppendProjectPeopleAsync(sb, project, scope, today, ct);
                if (caps.Tasks)
                {
                    await AppendProjectOpenTasksAsync(sb, project, scope, projectNames, today, ct);
                }
                break;

            default:
                // ProjectList, ProjectStatus, Reporting, General and any intent added later:
                // everything this person may see, bounded.
                await AppendProjectRiskAsync(sb, project, scope, today, ct);
                await AppendProjectMilestonesAsync(sb, project, scope, today, ct);
                if (caps.Tasks)
                {
                    await AppendProjectOpenTasksAsync(sb, project, scope, projectNames, today, ct);
                }
                if (intent == ChatIntents.Reporting || intent == ChatIntents.General)
                {
                    await AppendProjectDocumentsAsync(sb, project, scope, ct);
                }
                break;
        }

        var dossier = sb.ToString();
        if (dossier.Length > MaxCharacters)
        {
            _logger.LogInformation(
                "Project chat context truncated from {Original} to {Truncated} characters for intent {Intent}.",
                dossier.Length,
                MaxCharacters,
                intent);

            dossier = dossier[..MaxCharacters]
                + "\n\n[Remaining sections omitted because the data exceeded the size limit. "
                + "Say that the answer is based on a partial view rather than implying you saw everything.]";
        }

        return new ProjectChatContext(ProjectChatOutcome.Ready, dossier, null, sessionKey, caps);
    }

    /// <summary>
    /// The area an intent needs that this person does not have, or null when every
    /// area it needs is available.
    /// </summary>
    private static string? MissingAreaFor(string intent, ProjectAiCapabilities caps)
        => intent switch
        {
            ChatIntents.TaskQuery when !caps.Tasks => "tasks",
            ChatIntents.TaskAssignment when !caps.Tasks => "tasks",
            ChatIntents.TaskAssignment when !caps.People => "team members",
            ChatIntents.MilestoneQuery when !caps.Milestones => "milestones",
            ChatIntents.DocumentQuery when !caps.Documents => "documents",
            ChatIntents.BudgetQuery when !caps.Budget => "budget and cost figures",
            ChatIntents.ResourceManagement when !caps.People => "team members and workload",
            ChatIntents.DelayAnalysis when !caps.Tasks && !caps.Milestones => "tasks or milestones",
            _ => null
        };

    private async Task<ProjectScope?> ResolveProjectScopeAsync(Guid projectId, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
        {
            return null;
        }

        var ai = await _scope.HasAnyPermissionAsync(ct, PermissionCodes.AiProjectView, PermissionCodes.AiManage);
        var full = await _scope.CanSeeFullProjectDetailsAsync(projectId, ct);

        var tasks = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.TaskOwnView, PermissionCodes.TaskAllView,
            PermissionCodes.TaskOwnManage, PermissionCodes.TaskAllManage);

        var subtasks = tasks && await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.SubtaskOwnView, PermissionCodes.SubtaskAllView,
            PermissionCodes.SubtaskOwnManage, PermissionCodes.SubtaskAllManage);

        var milestones = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.MilestoneOwnView, PermissionCodes.MilestoneAllView,
            PermissionCodes.MilestoneOwnManage, PermissionCodes.MilestoneAllManage);

        var documentScope = await _scope.GetProjectDocumentAccessScopeAsync(
            projectId,
            ct,
            PermissionCodes.DocumentOwnView,
            PermissionCodes.DocumentAllView,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage);

        var people = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.UserOwnView, PermissionCodes.UserAllView,
            PermissionCodes.UserOwnManage, PermissionCodes.UserAllManage);

        var departmentIds = await _scope.GetDepartmentIdsAsync(ct);

        // Same narrowing as GET milestones/by-project and tasks/by-project: someone who
        // is not on the project's primary department sees their own departments' milestones,
        // and tasks only through those milestones.
        var visibleMilestoneIds = new List<Guid>();
        if (!full)
        {
            visibleMilestoneIds = await _db.Milestones
                .AsNoTracking()
                .Where(m => m.ProjectId == projectId
                    && m.DepartmentId.HasValue
                    && departmentIds.Contains(m.DepartmentId.Value))
                .Select(m => m.Id)
                .ToListAsync(ct);
        }

        var caps = new ProjectAiCapabilities(
            Ai: ai,
            FullProjectDetails: full,
            Tasks: tasks,
            Subtasks: subtasks,
            Milestones: milestones,
            Documents: documentScope != DepartmentDataScope.None,
            People: people,
            Budget: full);

        return new ProjectScope(caps, documentScope, departmentIds, visibleMilestoneIds);
    }

    private IQueryable<ProjectTask> ScopedTasks(Guid projectId, ProjectScope scope)
    {
        var query = _db.Tasks.AsNoTracking().Where(t => t.ProjectId == projectId);
        if (!scope.Caps.FullProjectDetails)
        {
            var visible = scope.VisibleMilestoneIds;
            query = query.Where(t => t.MilestoneId.HasValue && visible.Contains(t.MilestoneId.Value));
        }

        return query;
    }

    private IQueryable<Milestone> ScopedMilestones(Guid projectId, ProjectScope scope)
    {
        var query = _db.Milestones.AsNoTracking().Where(m => m.ProjectId == projectId);
        if (!scope.Caps.FullProjectDetails)
        {
            var visible = scope.VisibleMilestoneIds;
            query = query.Where(m => visible.Contains(m.Id));
        }

        return query;
    }

    private async Task<List<DocumentRow>> LoadVisibleDocumentsAsync(
        Project project,
        ProjectScope scope,
        CancellationToken ct)
    {
        if (scope.DocumentScope == DepartmentDataScope.None)
        {
            return [];
        }

        // Soft-deleted documents are excluded by the global query filter on BaseEntity.
        var rows = await _db.ProjectDocuments
            .AsNoTracking()
            .Where(d => d.ProjectId == project.Id)
            .OrderByDescending(d => d.CreatedDate)
            .Select(d => new DocumentRow(
                d.Title,
                d.Category,
                d.Version,
                d.Description,
                d.FileSizeBytes,
                d.CreatedDate,
                d.Task!.Milestone!.DepartmentId,
                d.Milestone!.DepartmentId))
            .ToListAsync(ct);

        if (scope.DocumentScope == DepartmentDataScope.OwnDepartment)
        {
            // Same rule as GET projects/{id}/documents.
            rows = rows
                .Where(r => scope.DepartmentIds.Contains(
                    r.TaskMilestoneDepartmentId ?? r.MilestoneDepartmentId ?? project.DepartmentId))
                .ToList();
        }

        return rows;
    }

    private static void AppendProjectScopeRules(StringBuilder sb, Project project, ProjectAiCapabilities caps)
    {
        sb.AppendLine("# Scope of this conversation");
        sb.Append("This conversation is limited to ONE project: ")
            .Append(project.Name).Append(" (").Append(project.ProjectCode).AppendLine(").");
        sb.AppendLine(
            "Answer only about this project, using only the data below. If the person asks about "
            + "any other project, the wider portfolio, or anything outside this project, say that this "
            + "tab only covers this project and answer nothing about the other subject.");

        sb.Append("Areas this person can ask about: ")
            .AppendLine(string.Join(", ", caps.AvailableAreas));

        var hidden = new List<string>();
        if (!caps.Tasks) hidden.Add("tasks");
        if (!caps.Subtasks) hidden.Add("subtasks");
        if (!caps.Milestones) hidden.Add("milestones");
        if (!caps.Documents) hidden.Add("documents");
        if (!caps.People) hidden.Add("team members and workload");
        if (!caps.Budget) hidden.Add("budget, cost and AI health scores");

        if (hidden.Count > 0)
        {
            sb.Append("Not available to this person under their role: ")
                .Append(string.Join(", ", hidden))
                .AppendLine(". If asked about these, say they are not available to their role. "
                    + "Do not estimate, infer or hint at them.");
        }

        sb.AppendLine();
    }

    private async Task AppendProjectOverviewAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        DateTime today,
        CancellationToken ct)
    {
        var caps = scope.Caps;
        var managerNames = await LoadManagerNamesAsync([project], ct);

        sb.AppendLine("## Project");
        sb.Append("Name: ").AppendLine(project.Name);
        sb.Append("Code: ").AppendLine(project.ProjectCode);
        sb.Append("Status: ").AppendLine(project.Status.ToString());
        sb.Append("Priority: ").AppendLine(project.Priority.ToString());
        sb.Append("Progress: ").AppendLine(FormatPercent(project.ProgressPercentage));
        sb.Append("Planned: ").Append(FormatDate(project.PlannedStartDate))
            .Append(" -> ").AppendLine(FormatDate(project.PlannedEndDate));
        var daysLeft = (project.BaselineEndDate.Date - today).Days;
        sb.Append("Baseline end: ").Append(FormatDate(project.BaselineEndDate))
            .Append(" (").Append(daysLeft.ToString(CultureInfo.InvariantCulture)).AppendLine(" days left)");
        sb.Append("Project manager: ").AppendLine(ManagerOf(project, managerNames));

        if (!string.IsNullOrWhiteSpace(project.Description))
        {
            var description = project.Description.Length > 600
                ? project.Description[..600] + "..."
                : project.Description;
            sb.Append("Description: ").AppendLine(description);
        }

        if (!string.IsNullOrWhiteSpace(project.DelayJustification))
        {
            sb.Append("Delay note: ").AppendLine(project.DelayJustification);
        }

        if (caps.Budget)
        {
            sb.Append("Planned budget: ").AppendLine(FormatMoney(project.PlannedBudget));
            sb.Append("Actual cost: ").AppendLine(FormatMoney(project.ActualCost));
            sb.Append("Budget used: ").AppendLine(FormatBudgetUsed(project.ActualCost, project.PlannedBudget));
            sb.Append("AI health score: ").AppendLine(FormatNumber(project.AIHealthScore));
            sb.Append("AI delay risk score: ").AppendLine(FormatNumber(project.AIDelayRiskScore));
        }

        if (caps.Tasks)
        {
            var rows = await ScopedTasks(project.Id, scope)
                .Where(t => t.ParentTaskId == null)
                .Select(t => new { t.Status, t.DueDate })
                .ToListAsync(ct);

            var open = rows.Where(r => r.Status != TaskStatus.Completed && r.Status != TaskStatus.Cancelled).ToList();
            sb.Append("Tasks visible: ").Append(rows.Count.ToString(CultureInfo.InvariantCulture))
                .Append(", open: ").Append(open.Count.ToString(CultureInfo.InvariantCulture))
                .Append(", open and past due: ")
                .AppendLine(open.Count(r => r.DueDate.Date < today).ToString(CultureInfo.InvariantCulture));
        }

        if (caps.Milestones)
        {
            var milestones = await ScopedMilestones(project.Id, scope)
                .Select(m => m.Status)
                .ToListAsync(ct);
            sb.Append("Milestones visible: ").Append(milestones.Count.ToString(CultureInfo.InvariantCulture))
                .Append(", completed: ")
                .AppendLine(milestones.Count(s => s == MilestoneStatus.Completed).ToString(CultureInfo.InvariantCulture));
        }

        if (caps.Documents)
        {
            var documents = await LoadVisibleDocumentsAsync(project, scope, ct);
            sb.Append("Documents visible: ").AppendLine(documents.Count.ToString(CultureInfo.InvariantCulture));
        }

        sb.AppendLine();
    }

    private async Task AppendProjectRiskAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        DateTime today,
        CancellationToken ct)
    {
        var caps = scope.Caps;
        if (!caps.Tasks && !caps.Milestones)
        {
            return;
        }

        List<RiskTaskRow> problemTasks = [];
        if (caps.Tasks)
        {
            problemTasks = await ScopedTasks(project.Id, scope)
                .Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled)
                .Where(t => t.DueDate.Date < today || t.Status == TaskStatus.Delayed || t.IsEscalated)
                .OrderBy(t => t.DueDate)
                .Take(MaxTasks)
                .Select(t => new RiskTaskRow(
                    t.Title,
                    t.Status,
                    t.Priority,
                    t.DueDate,
                    t.ProgressPercentage,
                    t.IsEscalated,
                    t.EscalationLevel,
                    t.Milestone != null ? t.Milestone.Name : null))
                .ToListAsync(ct);
        }

        List<MilestoneRow> problemMilestones = [];
        if (caps.Milestones)
        {
            problemMilestones = await ScopedMilestones(project.Id, scope)
                .Where(m => m.Status != MilestoneStatus.Completed &&
                            (m.Status == MilestoneStatus.Delayed || m.DueDate.Date < today))
                .OrderBy(m => m.DueDate)
                .Take(MaxMilestones)
                .Select(m => new MilestoneRow(m.Name, m.Status, m.IsCritical, m.ProgressPercentage, m.DueDate))
                .ToListAsync(ct);
        }

        sb.AppendLine("## At risk");

        if (problemTasks.Count == 0 && problemMilestones.Count == 0)
        {
            sb.AppendLine("Nothing is currently overdue or flagged at risk. Say that plainly rather than inventing concerns.");
            sb.AppendLine();
            return;
        }

        if (problemTasks.Count > 0)
        {
            sb.AppendLine();
            sb.Append("Overdue or escalated tasks: ")
                .AppendLine(problemTasks.Count.ToString(CultureInfo.InvariantCulture));
            foreach (var task in problemTasks)
            {
                var daysOverdue = (today - task.DueDate.Date).Days;
                sb.Append("- ").Append(task.Title);
                sb.Append(" due ").Append(FormatDate(task.DueDate));
                sb.Append(daysOverdue > 0 ? $" ({daysOverdue}d overdue)" : " (due today)");
                sb.Append(", status ").Append(task.Status);
                sb.Append(", priority ").Append(task.Priority);
                sb.Append(", progress ").Append(FormatPercent(task.ProgressPercentage));
                if (!string.IsNullOrWhiteSpace(task.MilestoneName))
                {
                    sb.Append(", milestone ").Append(task.MilestoneName);
                }
                if (task.IsEscalated)
                {
                    sb.Append(", ESCALATED level ").Append(task.EscalationLevel.ToString(CultureInfo.InvariantCulture));
                }
                sb.AppendLine();
            }
        }

        if (problemMilestones.Count > 0)
        {
            sb.AppendLine();
            sb.Append("Overdue or delayed milestones: ")
                .AppendLine(problemMilestones.Count.ToString(CultureInfo.InvariantCulture));
            foreach (var milestone in problemMilestones)
            {
                var daysOverdue = (today - milestone.DueDate.Date).Days;
                sb.Append("- ").Append(milestone.Name);
                sb.Append(" due ").Append(FormatDate(milestone.DueDate));
                sb.Append(daysOverdue > 0 ? $" ({daysOverdue}d overdue)" : " (due today)");
                sb.Append(", status ").Append(milestone.Status);
                sb.Append(", progress ").Append(FormatPercent(milestone.ProgressPercentage));
                if (milestone.IsCritical)
                {
                    sb.Append(", CRITICAL path");
                }
                sb.AppendLine();
            }
        }

        sb.AppendLine();
    }

    private async Task AppendProjectTasksAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        IReadOnlyDictionary<Guid, string> projectNames,
        Guid currentUserId,
        DateTime today,
        CancellationToken ct)
    {
        // Mine is queried on its own rather than filtered out of the capped list below,
        // otherwise someone whose tasks are not among the first 30 would be told they
        // have none.
        var mine = await QueryTasksAsync(
            ScopedTasks(project.Id, scope)
                .Where(t => t.ParentTaskId == null)
                .Where(t => t.AssignedToUserId == currentUserId
                    || t.Assignments.Any(a => a.IsActive && a.UserId == currentUserId))
                .OrderBy(t => t.DueDate),
            MaxTasks,
            ct);

        var mineOpen = mine.Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled).ToList();
        var mineOverdue = mineOpen.Where(t => t.DueDate.Date < today).ToList();

        sb.AppendLine("## Tasks assigned to the person asking (this project)");
        sb.Append("Total: ").Append(mine.Count.ToString(CultureInfo.InvariantCulture))
            .Append(", still open: ").AppendLine(mineOpen.Count.ToString(CultureInfo.InvariantCulture));
        sb.Append("Open and past due: ").AppendLine(mineOverdue.Count.ToString(CultureInfo.InvariantCulture));
        sb.AppendLine();

        if (mine.Count == 0)
        {
            sb.AppendLine("They have no tasks assigned to them in this project.");
            sb.AppendLine();
        }
        else
        {
            foreach (var task in mine.Take(15))
            {
                AppendTaskLine(sb, task, projectNames, today);
            }

            sb.AppendLine();
        }

        var breakdown = await ScopedTasks(project.Id, scope)
            .Where(t => t.ParentTaskId == null)
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        sb.AppendLine("## Task status breakdown (this project)");
        sb.AppendLine(string.Join(", ", breakdown
            .OrderBy(g => g.Status.ToString(), StringComparer.Ordinal)
            .Select(g => $"{g.Status}: {g.Count.ToString(CultureInfo.InvariantCulture)}")));
        sb.AppendLine();

        var all = await QueryTasksAsync(
            ScopedTasks(project.Id, scope)
                .Where(t => t.ParentTaskId == null)
                .OrderBy(t => t.DueDate),
            MaxTasks,
            ct);

        sb.AppendLine("## Tasks in this project (earliest due first)");
        foreach (var task in all.Take(20))
        {
            AppendTaskLine(sb, task, projectNames, today);
        }

        if (scope.Caps.Subtasks)
        {
            await AppendSubtasksAsync(sb, all, ct);
        }
    }

    private async Task AppendProjectOpenTasksAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        IReadOnlyDictionary<Guid, string> projectNames,
        DateTime today,
        CancellationToken ct)
    {
        var open = await QueryTasksAsync(
            ScopedTasks(project.Id, scope)
                .Where(t => t.ParentTaskId == null)
                .Where(t => t.Status == TaskStatus.NotStarted || t.Status == TaskStatus.InProgress)
                .OrderBy(t => t.Priority)
                .ThenBy(t => t.DueDate),
            MaxTasks,
            ct);

        if (open.Count == 0)
        {
            sb.AppendLine("## Open tasks");
            sb.AppendLine("No open tasks in this project.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## Open tasks");
        foreach (var task in open.Take(20))
        {
            AppendTaskLine(sb, task, projectNames, today);
        }

        sb.AppendLine();
    }

    private async Task AppendProjectMilestonesAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        DateTime today,
        CancellationToken ct)
    {
        if (!scope.Caps.Milestones)
        {
            return;
        }

        var milestones = await ScopedMilestones(project.Id, scope)
            .OrderBy(m => m.DueDate)
            .Take(MaxMilestones)
            .Select(m => new MilestoneRow(m.Name, m.Status, m.IsCritical, m.ProgressPercentage, m.DueDate))
            .ToListAsync(ct);

        sb.AppendLine("## Milestones");
        if (milestones.Count == 0)
        {
            sb.AppendLine("No milestones are visible in this project.");
            sb.AppendLine();
            return;
        }

        foreach (var milestone in milestones)
        {
            var daysLeft = (milestone.DueDate.Date - today).Days;
            sb.Append("- ").Append(milestone.Name);
            sb.Append(", status ").Append(milestone.Status);
            sb.Append(", progress ").Append(FormatPercent(milestone.ProgressPercentage));
            sb.Append(", due ").Append(FormatDate(milestone.DueDate));
            sb.Append(daysLeft switch
            {
                < 0 => $" ({-daysLeft}d overdue)",
                0 => " (due today)",
                _ => $" ({daysLeft}d left)"
            });
            if (milestone.IsCritical)
            {
                sb.Append(", CRITICAL path");
            }
            sb.AppendLine();
        }

        sb.AppendLine();
    }

    private async Task AppendProjectDocumentsAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        CancellationToken ct)
    {
        if (!scope.Caps.Documents)
        {
            return;
        }

        var documents = (await LoadVisibleDocumentsAsync(project, scope, ct)).Take(MaxDocuments).ToList();

        sb.AppendLine("## Documents");
        if (documents.Count == 0)
        {
            sb.AppendLine("No documents are visible in this project.");
            sb.AppendLine();
            return;
        }

        foreach (var document in documents)
        {
            sb.Append("- ").Append(document.Title);
            sb.Append(", category ").Append(document.Category);
            sb.Append(", version ").Append(document.Version);
            sb.Append(", added ").Append(FormatDate(document.CreatedDate));
            sb.Append(", ").Append(FormatBytes(document.FileSizeBytes));
            if (!string.IsNullOrWhiteSpace(document.Description))
            {
                sb.Append(" - ").Append(document.Description);
            }
            sb.AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine(
            "_Only titles and metadata are available. The contents of these files are not in the "
            + "dossier, so do not claim to have read or summarised them._");
        sb.AppendLine();
    }

    /// <summary>
    /// The people working on this project, not the organisation. Workload is shown as
    /// open tasks in this project; the overall scores are labelled as such because they
    /// describe everything the person is doing, and are only listed for people the asker
    /// is allowed to see.
    /// </summary>
    private async Task AppendProjectPeopleAsync(
        StringBuilder sb,
        Project project,
        ProjectScope scope,
        DateTime today,
        CancellationToken ct)
    {
        if (!scope.Caps.People)
        {
            return;
        }

        var openTasks = await ScopedTasks(project.Id, scope)
            .Where(t => t.ParentTaskId == null)
            .Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled)
            .Select(t => new
            {
                t.AssignedToUserId,
                t.DueDate,
                Assignees = t.Assignments.Where(a => a.IsActive).Select(a => a.UserId).ToList()
            })
            .ToListAsync(ct);

        var openByUser = new Dictionary<Guid, int>();
        var overdueByUser = new Dictionary<Guid, int>();
        foreach (var task in openTasks)
        {
            var people = new HashSet<Guid>(task.Assignees);
            if (task.AssignedToUserId is { } assigned)
            {
                people.Add(assigned);
            }

            foreach (var person in people)
            {
                openByUser[person] = openByUser.GetValueOrDefault(person) + 1;
                if (task.DueDate.Date < today)
                {
                    overdueByUser[person] = overdueByUser.GetValueOrDefault(person) + 1;
                }
            }
        }

        var participantIds = openByUser.Keys.ToList();
        if (project.ProjectManagerId is { } managerId)
        {
            participantIds.Add(managerId);
        }

        var visibleUsers = await _scope.ScopeUsersAsync(_db.Users.AsQueryable(), ct);
        var users = await visibleUsers
            .Where(u => u.IsActive && participantIds.Contains(u.Id))
            .Take(MaxPeople)
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.JobTitle,
                u.AvailabilityPercentage,
                u.AIWorkloadScore,
                u.AIBurnoutRiskScore
            })
            .ToListAsync(ct);

        sb.AppendLine("## People on this project");
        if (users.Count == 0)
        {
            sb.AppendLine("No people on this project are visible to this user.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("| Name | Job title | Open tasks here | Overdue here | Availability | Overall workload | Overall burnout risk |");
        sb.AppendLine("| --- | --- | --- | --- | --- | --- | --- |");

        foreach (var user in users.OrderByDescending(u => openByUser.GetValueOrDefault(u.Id)))
        {
            sb.Append("| ").Append(user.FullName);
            sb.Append(" | ").Append(string.IsNullOrWhiteSpace(user.JobTitle) ? "-" : user.JobTitle);
            sb.Append(" | ").Append(openByUser.GetValueOrDefault(user.Id).ToString(CultureInfo.InvariantCulture));
            sb.Append(" | ").Append(overdueByUser.GetValueOrDefault(user.Id).ToString(CultureInfo.InvariantCulture));
            sb.Append(" | ").Append(FormatPercent(user.AvailabilityPercentage));
            sb.Append(" | ").Append(FormatNumber(user.AIWorkloadScore));
            sb.Append(" | ").Append(FormatNumber(user.AIBurnoutRiskScore));
            sb.AppendLine(" |");
        }

        sb.AppendLine();
        sb.AppendLine(
            "_Open and overdue counts are for this project only. Overall workload and burnout scores run "
            + "0-100 where higher is worse and cover all of the person's work, not just this project._");
        sb.AppendLine();
    }
}
