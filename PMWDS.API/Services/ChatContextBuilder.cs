using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Common;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Persistence.Context;

// The project's task status enum shadows System.Threading.Tasks.TaskStatus, which is
// in scope through ImplicitUsings. Alias it so the domain one is unambiguous.
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;

namespace PMWDS.API.Services;

/// <summary>
/// Builds the data block that accompanies a chat question.
///
/// The assistant used to receive nothing at all for most questions, because intent
/// detection filed "tell me about all the projects" as General and the old switch
/// returned null for General. The model was then asked to answer with no data and
/// correctly replied that it had no access to any project information. That is the
/// failure this class exists to remove.
///
/// Two properties matter more than the content itself:
///
/// Scoped. Everything is filtered through RoleScopeService, the same service every
/// other controller uses, so the assistant can never describe a project the user
/// could not open in the UI themselves. Without this the AI would become a way to
/// read another organisation's projects by asking a question instead of clicking.
///
/// Bounded. Each section is capped and the whole dossier is capped, because the
/// alternative is an unbounded prompt that gets slower, costs more, and eventually
/// trips the provider's context limit - which surfaces as a confusing provider
/// error rather than a clean "too much data" answer.
/// </summary>
public class ChatContextBuilder
{
    /// <summary>
    /// A task row as it appears in the dossier.
    ///
    /// Named rather than anonymous: the subtask rollup needs to read Id and Title
    /// back out of a list of these, and doing that with anonymous types forces
    /// either <c>dynamic</c> (which EF cannot translate) or a duplicated projection.
    /// </summary>
    private sealed record TaskRow(
        Guid Id,
        string Title,
        Guid ProjectId,
        TaskStatus Status,
        TaskPriority Priority,
        DateTime StartDate,
        DateTime DueDate,
        double ProgressPercentage,
        int EstimatedHours,
        string? MilestoneName,
        Guid? AssignedToUserId);

    private sealed record SubtaskRow(
        string Title,
        Guid ParentTaskId,
        TaskStatus Status,
        DateTime DueDate);

    /// <summary>
    /// Hard ceiling on the dossier. Roughly 12k tokens of text, which sits
    /// comfortably inside every supported provider while leaving room for the
    /// question and the answer.
    /// </summary>
    private const int MaxCharacters = 40_000;

    private const int MaxProjects = 25;
    private const int MaxTasks = 30;
    private const int MaxMilestones = 20;
    private const int MaxDocuments = 20;
    private const int MaxPeople = 15;
    private const int MaxSubtaskLines = 3;

    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;
    private readonly ILogger<ChatContextBuilder> _logger;

    public ChatContextBuilder(
        ApplicationDbContext db,
        RoleScopeService scope,
        ILogger<ChatContextBuilder> logger)
    {
        _db = db;
        _scope = scope;
        _logger = logger;
    }

    /// <summary>
    /// Builds the dossier for one question, or null when the caller has no
    /// authenticated user to scope by.
    /// </summary>
    public async Task<string?> BuildAsync(string userId, string intent, CancellationToken ct)
    {
        if (!Guid.TryParse(userId, out var currentUserId))
        {
            _logger.LogWarning(
                "Chat context skipped: user id '{UserId}' is not a GUID, so the data cannot be scoped.",
                userId);
            return null;
        }

        var today = DateTime.UtcNow.Date;
        var builder = new StringBuilder();

        // Split into two steps deliberately. Written as one chain,
        // `await _scope.ScopeProjectsAsync(...).AsNoTracking()` binds .AsNoTracking
        // to the Task rather than to the awaited query, because member access binds
        // tighter than await. That compiles to a confusing "cannot infer type
        // arguments" rather than naming the real mistake.
        var visibleProjects = await _scope.ScopeProjectsAsync(_db.Projects.AsQueryable(), ct);
        var projects = await visibleProjects.AsNoTracking().ToListAsync(ct);

        // A user who genuinely has no visible projects gets an explicit statement,
        // not silence. Silence reads as "the assistant forgot to look", which is
        // exactly the confusion this whole change exists to remove.
        if (projects.Count == 0)
        {
            return """
                You have access to 0 projects.

                The user asking has no projects visible to them under their current role or
                organisation. Say so plainly and explain that the answer depends on which
                projects their role covers. Do not suggest a workaround or offer to fetch
                data from elsewhere.
                """;
        }

        var projectIds = projects.Select(p => p.Id).ToList();
        var projectNames = projects.ToDictionary(p => p.Id, p => p.Name);
        var managerNames = await LoadManagerNamesAsync(projects, ct);

        await AppendIdentityAsync(builder, currentUserId, ct);
        await AppendPortfolioSummaryAsync(builder, projects, today, ct);

        switch (intent)
        {
            case ChatIntents.ProjectList:
            case ChatIntents.ProjectStatus:
                AppendProjectTable(builder, projects, managerNames, today);
                await AppendRiskSectionAsync(builder, projectIds, projectNames, today, ct);
                await AppendMilestonesAsync(builder, projectIds, projectNames, today, ct);
                break;

            case ChatIntents.DelayAnalysis:
                await AppendRiskSectionAsync(builder, projectIds, projectNames, today, ct);
                AppendProjectTable(builder, projects.Where(p => p.Status != ProjectStatus.Completed).ToList(), managerNames, today);
                break;

            case ChatIntents.TaskQuery:
                await AppendTasksAsync(builder, projectIds, projectNames, currentUserId, today, ct);
                break;

            case ChatIntents.TaskAssignment:
                await AppendPeopleAsync(builder, ct);
                await AppendOpenTasksAsync(builder, projectIds, projectNames, today, ct);
                break;

            case ChatIntents.MilestoneQuery:
                await AppendMilestonesAsync(builder, projectIds, projectNames, today, ct);
                AppendProjectTable(builder, projects.Where(p => p.Status != ProjectStatus.Completed).ToList(), managerNames, today);
                break;

            case ChatIntents.DocumentQuery:
                await AppendDocumentsAsync(builder, projectIds, projectNames, ct);
                break;

            case ChatIntents.BudgetQuery:
                AppendProjectTable(builder, projects, managerNames, today);
                break;

            case ChatIntents.ResourceManagement:
                await AppendPeopleAsync(builder, ct);
                await AppendOpenTasksAsync(builder, projectIds, projectNames, today, ct);
                break;

            case ChatIntents.Reporting:
                AppendProjectTable(builder, projects, managerNames, today);
                await AppendRiskSectionAsync(builder, projectIds, projectNames, today, ct);
                await AppendMilestonesAsync(builder, projectIds, projectNames, today, ct);
                await AppendDocumentsAsync(builder, projectIds, projectNames, ct);
                break;

            default:
                // General, and any intent added later without a case here. Broad but
                // bounded, so an unrecognised question still gets real data instead
                // of a refusal.
                AppendProjectTable(builder, projects, managerNames, today);
                await AppendRiskSectionAsync(builder, projectIds, projectNames, today, ct);
                await AppendMilestonesAsync(builder, projectIds, projectNames, today, ct);
                await AppendDocumentsAsync(builder, projectIds, projectNames, ct);
                break;
        }

        var dossier = builder.ToString();
        if (dossier.Length > MaxCharacters)
        {
            _logger.LogInformation(
                "Chat context truncated from {Original} to {Truncated} characters for intent {Intent}.",
                dossier.Length,
                MaxCharacters,
                intent);

            dossier = dossier[..MaxCharacters]
                + "\n\n[Remaining sections omitted because the data exceeded the size limit. "
                + "Say that the answer is based on a partial view rather than implying you saw everything.]";
        }

        return dossier;
    }

    /// <summary>
    /// Who is asking and what they may see. Without this the model has no way to
    /// phrase "your projects" correctly, and it tends to describe the whole
    /// portfolio as if the user owned all of it.
    /// </summary>
    private async Task AppendIdentityAsync(StringBuilder sb, Guid currentUserId, CancellationToken ct)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id == currentUserId)
            .Select(u => new
            {
                u.FullName,
                u.JobTitle,
                OrganizationName = u.Organization != null ? u.Organization.Name : null,
                DepartmentName = u.Department != null ? u.Department.Name : null,
                Roles = u.Roles.Select(r => r.Key).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (user == null)
        {
            return;
        }

        var roleLabel = DescribeRoles(user.Roles);

        sb.AppendLine("# Who is asking");
        sb.Append("Name: ").AppendLine(user.FullName);
        if (!string.IsNullOrWhiteSpace(user.JobTitle))
        {
            sb.Append("Job title: ").AppendLine(user.JobTitle);
        }
        if (!string.IsNullOrWhiteSpace(user.OrganizationName))
        {
            sb.Append("Organisation: ").AppendLine(user.OrganizationName);
        }
        if (!string.IsNullOrWhiteSpace(user.DepartmentName))
        {
            sb.Append("Department: ").AppendLine(user.DepartmentName);
        }
        sb.Append("Role: ").AppendLine(roleLabel);
        sb.AppendLine();
        sb.AppendLine(
            "Everything below is already filtered to what this person's role allows them to see. "
            + "Never speculate about, mention, or ask for data outside this dossier - not even to "
            + "guess. If the answer is not here, say it is not available to them.");
        sb.AppendLine();
    }

    private static string DescribeRoles(IReadOnlyCollection<string> roles)
    {
        if (roles.Count == 0)
        {
            return "member";
        }

        // Most privileged first, so the description is not misleading when a user
        // holds several roles at once.
        var order = new[]
        {
            RoleKeys.SuperAdmin, RoleKeys.Director, RoleKeys.DepartmentHead,
            RoleKeys.ProjectManager, RoleKeys.TeamMember, RoleKeys.Viewer
        };

        var known = order.Where(role => roles.Contains(role, StringComparer.OrdinalIgnoreCase)).ToList();
        var label = known.Count > 0
            ? string.Join(", ", known.Select(HumaniseRole))
            : string.Join(", ", roles.Select(HumaniseRole));

        return roles.Count > 1 && known.Count > 1
            ? $"{label} (can also act as: {string.Join(", ", known.Skip(1).Select(HumaniseRole))})"
            : label;
    }

    private static string HumaniseRole(string role) => role switch
    {
        RoleKeys.SuperAdmin => "administrator (sees everything)",
        RoleKeys.Director => "director (sees all projects in their organisation)",
        RoleKeys.DepartmentHead => "department head (sees their department's projects)",
        RoleKeys.ProjectManager => "project manager",
        RoleKeys.TeamMember => "team member",
        RoleKeys.Viewer => "viewer (read-only)",
        _ => role
    };

    private async Task AppendPortfolioSummaryAsync(
        StringBuilder sb,
        List<Project> projects,
        DateTime today,
        CancellationToken ct)
    {
        var active = projects.Where(p => p.Status == ProjectStatus.InProgress).ToList();
        var overdueProjects = projects.Where(p => p.Status == ProjectStatus.Delayed).ToList();
        var plannedBudget = projects.Sum(p => p.PlannedBudget);
        var actualCost = projects.Sum(p => p.ActualCost);

        sb.AppendLine("# Portfolio at a glance");
        sb.Append("Total projects visible: ").AppendLine(projects.Count.ToString(CultureInfo.InvariantCulture));
        sb.Append("Active: ").Append(active.Count.ToString(CultureInfo.InvariantCulture))
            .Append(", on hold: ").AppendLine(projects.Count(p => p.Status == ProjectStatus.OnHold).ToString(CultureInfo.InvariantCulture));
        sb.Append("Flagged delayed: ").AppendLine(overdueProjects.Count.ToString(CultureInfo.InvariantCulture));
        sb.Append("Completed: ").AppendLine(projects.Count(p => p.Status == ProjectStatus.Completed).ToString(CultureInfo.InvariantCulture));
        sb.Append("Average progress: ").AppendLine(FormatPercent(projects.Average(p => p.ProgressPercentage)));
        sb.Append("Average health score: ").AppendLine(FormatNumber(projects.Average(p => p.AIHealthScore)));
        sb.Append("Combined planned budget: ").AppendLine(FormatMoney(plannedBudget));
        sb.Append("Combined actual cost: ").AppendLine(FormatMoney(actualCost));
        if (plannedBudget > 0)
        {
            sb.Append("Budget consumed: ").AppendLine(FormatBudgetUsed(actualCost, plannedBudget));
        }

        // The visible project ids are passed into the queries rather than joined
        // against an in-memory list. A .NET Any() over a materialised collection
        // cannot be translated to SQL, and the ID set is small enough that
        // Contains is the cheaper shape anyway.
        var projectIds = projects.Select(p => p.Id).ToList();

        var openTasks = await _db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled)
            .Select(t => t.DueDate)
            .ToListAsync(ct);

        var overdueTasks = openTasks.Count(due => due.Date < today);
        sb.Append("Open tasks: ").AppendLine(openTasks.Count.ToString(CultureInfo.InvariantCulture));
        sb.Append("Open tasks past due: ").AppendLine(overdueTasks.ToString(CultureInfo.InvariantCulture));

        var documents = await _db.ProjectDocuments
            .AsNoTracking()
            .CountAsync(d => projectIds.Contains(d.ProjectId), ct);
        sb.Append("Project documents: ").AppendLine(documents.ToString(CultureInfo.InvariantCulture));

        sb.AppendLine();
    }

    private void AppendProjectTable(
        StringBuilder sb,
        List<Project> projects,
        IReadOnlyDictionary<Guid, string> managerNames,
        DateTime today)
    {
        if (projects.Count == 0)
        {
            sb.AppendLine("## Projects");
            sb.AppendLine("No projects in this view.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## Projects");
        sb.AppendLine("| Project | Code | Status | Priority | Progress | Health | Budget used | Planned end | Days left | Project manager |");
        sb.AppendLine("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");

        foreach (var project in projects.Take(MaxProjects))
        {
            var daysLeft = (project.BaselineEndDate.Date - today).Days;
            var budgetUsed = FormatBudgetUsed(project.ActualCost, project.PlannedBudget);

            sb.Append("| ").Append(project.Name);
            sb.Append(" | ").Append(project.ProjectCode);
            sb.Append(" | ").Append(project.Status);
            sb.Append(" | ").Append(project.Priority);
            sb.Append(" | ").Append(FormatPercent(project.ProgressPercentage));
            sb.Append(" | ").Append(FormatNumber(project.AIHealthScore));
            sb.Append(" | ").Append(budgetUsed);
            sb.Append(" | ").Append(FormatDate(project.BaselineEndDate));
            sb.Append(" | ").Append(daysLeft.ToString(CultureInfo.InvariantCulture));
            sb.Append(" | ").AppendLine(ManagerOf(project, managerNames));

            if (!string.IsNullOrWhiteSpace(project.DelayJustification))
            {
                sb.Append("  Delay note: ").AppendLine(project.DelayJustification);
            }
        }

        if (projects.Count > MaxProjects)
        {
            sb.AppendLine();
            sb.Append($"_Showing {MaxProjects} of {projects.Count} projects. Say how many were omitted._");
        }

        sb.AppendLine();
    }

    private async Task AppendRiskSectionAsync(
        StringBuilder sb,
        List<Guid> projectIds,
        IReadOnlyDictionary<Guid, string> projectNames,
        DateTime today,
        CancellationToken ct)
    {
        var problemTasks = await _db.Tasks
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled)
            .Where(t => t.DueDate.Date < today || t.Status == TaskStatus.Delayed || t.IsEscalated)
            .OrderBy(t => t.DueDate)
            .Take(MaxTasks)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.ProjectId,
                t.Status,
                t.Priority,
                t.DueDate,
                t.ProgressPercentage,
                t.IsEscalated,
                t.EscalationLevel,
                t.ParentTaskId,
                MilestoneName = t.Milestone != null ? t.Milestone.Name : null
            })
            .ToListAsync(ct);

        var problemMilestones = await _db.Milestones
            .AsNoTracking()
            .Where(m => projectIds.Contains(m.ProjectId))
            .Where(m => m.Status != MilestoneStatus.Completed &&
                        (m.Status == MilestoneStatus.Delayed || m.DueDate.Date < today))
            .OrderBy(m => m.DueDate)
            .Take(MaxMilestones)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.ProjectId,
                m.Status,
                m.IsCritical,
                m.ProgressPercentage,
                m.DueDate
            })
            .ToListAsync(ct);

        if (problemTasks.Count == 0 && problemMilestones.Count == 0)
        {
            sb.AppendLine("## At risk");
            sb.AppendLine("Nothing is currently overdue or flagged at risk. Say that plainly rather than inventing concerns.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## At risk");

        if (problemTasks.Count > 0)
        {
            sb.AppendLine();
            sb.Append("Overdue or escalated tasks: ").AppendLine(problemTasks.Count.ToString(CultureInfo.InvariantCulture));
            foreach (var task in problemTasks)
            {
                var daysOverdue = (today - task.DueDate.Date).Days;
                sb.Append("- ").Append(task.Title);
                sb.Append(" [project: ").Append(NameOf(projectNames, task.ProjectId)).Append(']');
                sb.Append(" due ").Append(FormatDate(task.DueDate));
                sb.Append(daysOverdue > 0
                    ? $" ({daysOverdue}d overdue)"
                    : " (due today)");
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
            sb.Append("Overdue or delayed milestones: ").AppendLine(problemMilestones.Count.ToString(CultureInfo.InvariantCulture));
            foreach (var milestone in problemMilestones)
            {
                var daysOverdue = (today - milestone.DueDate.Date).Days;
                sb.Append("- ").Append(milestone.Name);
                sb.Append(" [project: ").Append(NameOf(projectNames, milestone.ProjectId)).Append(']');
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

    private async Task AppendTasksAsync(
        StringBuilder sb,
        List<Guid> projectIds,
        IReadOnlyDictionary<Guid, string> projectNames,
        Guid currentUserId,
        DateTime today,
        CancellationToken ct)
    {
        // AssignedToUserId is projected alongside the dossier fields purely so the
        // "assigned to the person asking" split can be done in memory after the
        // query. Filtering on it in SQL would need the id threaded through as a
        // parameter for a second round trip, which is not worth it for a summary.
        var allTasks = await QueryTasksAsync(
            _db.Tasks.AsNoTracking()
                .Where(t => projectIds.Contains(t.ProjectId))
                .Where(t => t.ParentTaskId == null)
                .OrderByDescending(t => t.DueDate),
            MaxTasks,
            ct);

        var mine = allTasks.Where(t => t.AssignedToUserId == currentUserId).ToList();
        var mineOpen = mine.Where(t => t.Status != TaskStatus.Completed && t.Status != TaskStatus.Cancelled).ToList();
        var mineOverdue = mineOpen.Where(t => t.DueDate.Date < today).ToList();

        sb.AppendLine("## Tasks assigned to the person asking");
        sb.Append("Total: ").Append(mine.Count.ToString(CultureInfo.InvariantCulture))
            .Append(", still open: ").AppendLine(mineOpen.Count.ToString(CultureInfo.InvariantCulture));
        sb.Append("Open and past due: ").AppendLine(mineOverdue.Count.ToString(CultureInfo.InvariantCulture));
        sb.AppendLine();

        if (mine.Count == 0)
        {
            sb.AppendLine("They have no tasks assigned to them.");
            sb.AppendLine();
        }
        else
        {
            foreach (var task in mine.Take(15))
            {
                AppendTaskLine(sb, task, projectNames, today);
            }

            if (mine.Count > 15)
            {
                sb.Append($"_Showing 15 of {mine.Count.ToString(CultureInfo.InvariantCulture)} assigned tasks._");
                sb.AppendLine();
            }

            sb.AppendLine();
        }

        sb.AppendLine("## Task status breakdown across their visible projects");
        sb.AppendLine(string.Join(", ", allTasks
            .GroupBy(t => t.Status)
            .OrderBy(g => g.Key.ToString(), StringComparer.Ordinal)
            .Select(g => $"{g.Key}: {g.Count().ToString(CultureInfo.InvariantCulture)}")));
        sb.AppendLine();
        sb.AppendLine(
            $"Total top-level tasks across these projects: {allTasks.Count.ToString(CultureInfo.InvariantCulture)}. "
            + "Subtasks are summarised under their parent below.");
        sb.AppendLine();

        sb.AppendLine("## Tasks across their visible projects");
        foreach (var task in allTasks.Take(20))
        {
            AppendTaskLine(sb, task, projectNames, today);
        }

        await AppendSubtasksAsync(sb, allTasks, ct);
    }

    private static async Task<List<TaskRow>> QueryTasksAsync(
        IQueryable<ProjectTask> query,
        int take,
        CancellationToken ct)
        => await query
            .Take(take)
            .Select(t => new TaskRow(
                t.Id,
                t.Title,
                t.ProjectId,
                t.Status,
                t.Priority,
                t.StartDate,
                t.DueDate,
                t.ProgressPercentage,
                t.EstimatedHours,
                t.Milestone != null ? t.Milestone.Name : null,
                t.AssignedToUserId))
            .ToListAsync(ct);

    /// <summary>
    /// Subtasks, grouped under their parent. A parent task reading "0% complete" is
    /// misleading on its own when it has four finished children, so the rollup is
    /// what makes the progress figure interpretable.
    /// </summary>
    private async Task AppendSubtasksAsync(
        StringBuilder sb,
        List<TaskRow> parents,
        CancellationToken ct)
    {
        if (parents.Count == 0)
        {
            return;
        }

        var parentIds = parents.Select(t => t.Id).ToList();
        var parentTitles = parents.ToDictionary(t => t.Id, t => t.Title);

        var subtasks = await _db.Tasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId != null && parentIds.Contains(t.ParentTaskId.Value))
            .OrderBy(t => t.Title)
            .Select(t => new SubtaskRow(
                t.Title,
                t.ParentTaskId!.Value,
                t.Status,
                t.DueDate))
            .ToListAsync(ct);

        if (subtasks.Count == 0)
        {
            return;
        }

        sb.AppendLine();
        sb.AppendLine("## Subtasks");
        sb.AppendLine(
            $"_These {subtasks.Count.ToString(CultureInfo.InvariantCulture)} subtasks roll up into the tasks above._");

        foreach (var group in subtasks
            .GroupBy(t => t.ParentTaskId)
            .Take(MaxSubtaskLines * 5))
        {
            var children = group.ToList();
            var done = children.Count(c => c.Status == TaskStatus.Completed);

            sb.Append("- ")
                .Append(parentTitles.TryGetValue(group.Key, out var title) ? title : "unknown task")
                .Append(": ")
                .Append(done.ToString(CultureInfo.InvariantCulture))
                .Append('/')
                .Append(children.Count.ToString(CultureInfo.InvariantCulture))
                .Append(" done [")
                .Append(string.Join("; ", children.Select(c => $"{c.Title} ({c.Status})")))
                .AppendLine("]");
        }

        sb.AppendLine();
    }

    private async Task AppendOpenTasksAsync(
        StringBuilder sb,
        List<Guid> projectIds,
        IReadOnlyDictionary<Guid, string> projectNames,
        DateTime today,
        CancellationToken ct)
    {
        var open = await QueryTasksAsync(
            _db.Tasks.AsNoTracking()
                .Where(t => projectIds.Contains(t.ProjectId))
                .Where(t => t.Status == TaskStatus.NotStarted || t.Status == TaskStatus.InProgress)
                .OrderBy(t => t.Priority)
                .ThenBy(t => t.DueDate),
            MaxTasks,
            ct);

        if (open.Count == 0)
        {
            sb.AppendLine("## Open tasks");
            sb.AppendLine("No open tasks in these projects.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## Open tasks (candidates for assignment)");
        foreach (var task in open.Take(20))
        {
            AppendTaskLine(sb, task, projectNames, today);
        }

        sb.AppendLine();
    }

    private async Task AppendMilestonesAsync(
        StringBuilder sb,
        List<Guid> projectIds,
        IReadOnlyDictionary<Guid, string> projectNames,
        DateTime today,
        CancellationToken ct)
    {
        var milestones = await _db.Milestones
            .AsNoTracking()
            .Where(m => projectIds.Contains(m.ProjectId))
            .OrderBy(m => m.DueDate)
            .Take(MaxMilestones)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.ProjectId,
                m.Status,
                m.IsCritical,
                m.ProgressPercentage,
                m.DueDate,
                m.CompletedDate,
                m.Order
            })
            .ToListAsync(ct);

        if (milestones.Count == 0)
        {
            sb.AppendLine("## Milestones");
            sb.AppendLine("No milestones in these projects.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## Milestones");
        foreach (var milestone in milestones)
        {
            var daysLeft = (milestone.DueDate.Date - today).Days;
            sb.Append("- ").Append(milestone.Name);
            sb.Append(" [project: ").Append(NameOf(projectNames, milestone.ProjectId)).Append(']');
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

    private async Task AppendDocumentsAsync(
        StringBuilder sb,
        List<Guid> projectIds,
        IReadOnlyDictionary<Guid, string> projectNames,
        CancellationToken ct)
    {
        var documents = await _db.ProjectDocuments
            .AsNoTracking()
            .Where(d => projectIds.Contains(d.ProjectId))
            .OrderByDescending(d => d.CreatedDate)
            .Take(MaxDocuments)
            .Select(d => new
            {
                d.Title,
                d.ProjectId,
                d.Category,
                d.ContentType,
                d.Version,
                d.Description,
                d.FileSizeBytes,
                d.CreatedDate,
                d.UploadedByUserId
            })
            .ToListAsync(ct);

        if (documents.Count == 0)
        {
            sb.AppendLine("## Documents");
            sb.AppendLine("No documents are attached to these projects.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## Documents");
        foreach (var document in documents)
        {
            sb.Append("- ").Append(document.Title);
            sb.Append(" [project: ").Append(NameOf(projectNames, document.ProjectId)).Append(']');
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

    private async Task AppendPeopleAsync(StringBuilder sb, CancellationToken ct)
    {
        var visibleUsers = await _scope.ScopeUsersAsync(_db.Users.AsQueryable(), ct);
        var users = await visibleUsers
            .Where(u => u.IsActive)
            .OrderByDescending(u => u.AIWorkloadScore)
            .Take(MaxPeople)
            .Select(u => new
            {
                u.FullName,
                u.JobTitle,
                AvailabilityPercentage = u.AvailabilityPercentage,
                AIWorkloadScore = u.AIWorkloadScore,
                AIBurnoutRiskScore = u.AIBurnoutRiskScore,
                AIPerformanceScore = u.AIPerformanceScore,
                AvailabilityStatus = u.AvailabilityStatus,
                OpenTaskCount = u.GetActiveTaskCount()
            })
            .ToListAsync(ct);

        if (users.Count == 0)
        {
            sb.AppendLine("## People");
            sb.AppendLine("No people are visible to this user.");
            sb.AppendLine();
            return;
        }

        sb.AppendLine("## People");
        sb.AppendLine("| Name | Job title | Availability | Workload | Burnout risk | Open tasks |");
        sb.AppendLine("| --- | --- | --- | --- | --- | --- |");

        foreach (var user in users)
        {
            sb.Append("| ").Append(user.FullName);
            sb.Append(" | ").Append(string.IsNullOrWhiteSpace(user.JobTitle) ? "-" : user.JobTitle);
            sb.Append(" | ").Append(FormatPercent(user.AvailabilityPercentage));
            sb.Append(" | ").Append(FormatNumber(user.AIWorkloadScore));
            sb.Append(" | ").Append(FormatNumber(user.AIBurnoutRiskScore));
            sb.Append(" | ").Append(user.OpenTaskCount.ToString(CultureInfo.InvariantCulture));
            sb.AppendLine();
        }

        sb.AppendLine();
        sb.AppendLine(
            "_Scores run 0-100 where higher is worse, except performance. Availability is the "
            + "percentage of capacity still free._");
        sb.AppendLine();
    }

    private static void AppendTaskLine(
        StringBuilder sb,
        TaskRow task,
        IReadOnlyDictionary<Guid, string> projectNames,
        DateTime today)
    {
        var daysLeft = (task.DueDate.Date - today).Days;
        sb.Append("- ").Append(task.Title);
        sb.Append(" [project: ").Append(NameOf(projectNames, task.ProjectId)).Append(']');
        sb.Append(", ").Append(task.Status);
        sb.Append(", ").Append(task.Priority).Append(" priority");
        sb.Append(", progress ").Append(FormatPercent(task.ProgressPercentage));
        sb.Append(", ").Append(FormatDate(task.StartDate)).Append(" -> ").Append(FormatDate(task.DueDate));
        sb.Append(daysLeft switch
        {
            < 0 => $" ({-daysLeft}d overdue)",
            0 => " (due today)",
            _ => $" ({daysLeft}d left)"
        });
        sb.Append(", est. ").Append(task.EstimatedHours.ToString(CultureInfo.InvariantCulture)).Append("h");
        if (!string.IsNullOrWhiteSpace(task.MilestoneName))
        {
            sb.Append(", milestone ").Append(task.MilestoneName);
        }
        sb.AppendLine();
    }

    private static string NameOf(IReadOnlyDictionary<Guid, string> names, Guid projectId)
        => names.TryGetValue(projectId, out var name) ? name : "unknown project";

    /// <summary>
    /// The project manager's name, or a clear "not set".
    ///
    /// "assigned" was what the previous version printed here, which told the model
    /// nothing and invited it to invent a name when asked who runs a project.
    /// </summary>
    private static string ManagerOf(Project project, IReadOnlyDictionary<Guid, string> managerNames)
    {
        if (project.ProjectManagerId is not { } managerId)
        {
            return "no project manager set";
        }

        return managerNames.TryGetValue(managerId, out var name) && !string.IsNullOrWhiteSpace(name)
            ? name
            : "assigned (name not visible to you)";
    }

    /// <summary>
    /// Resolves project manager names in one query.
    /// </summary>
    private async Task<Dictionary<Guid, string>> LoadManagerNamesAsync(
        List<Project> projects,
        CancellationToken ct)
    {
        var managerIds = projects
            .Where(p => p.ProjectManagerId is not null)
            .Select(p => p.ProjectManagerId!.Value)
            .Distinct()
            .ToList();

        if (managerIds.Count == 0)
        {
            return [];
        }

        return await _db.Users
            .AsNoTracking()
            .Where(u => managerIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
    }

    private static string FormatDate(DateTime value)
        => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string FormatPercent(double value)
        => value.ToString("0.#", CultureInfo.InvariantCulture) + "%";

    private static string FormatNumber(double value)
        => value.ToString("0.0", CultureInfo.InvariantCulture);

    private static string FormatMoney(decimal value)
        => value.ToString("#,##0", CultureInfo.InvariantCulture);

    /// <summary>
    /// Percentage of a budget consumed. Budget columns are decimal in the domain but
    /// the ratio is only ever displayed, so it is computed in double rather than
    /// forcing a decimal division at every call site.
    /// </summary>
    private static string FormatBudgetUsed(decimal actual, decimal planned)
        => planned > 0
            ? FormatPercent((double)(actual / planned * 100m))
            : "n/a";

    private static string FormatBytes(long bytes)
        => bytes switch
        {
            < 1024 => $"{bytes} B",
            < 1024 * 1024 => $"{bytes / 1024.0:0.#} KB",
            < 1024L * 1024 * 1024 => $"{bytes / (1024.0 * 1024):0.#} MB",
            _ => $"{bytes / (1024.0 * 1024 * 1024):0.#} GB"
        };
}
