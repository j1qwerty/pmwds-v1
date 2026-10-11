using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

/// <summary>
/// Single ranked endpoint behind the Ctrl+K palette. Route: GET /api/v1/search?q=
///
/// Each section is returned only if the caller passes the same policy as the matching list
/// endpoint AND is filtered through the same scope service, so search can never reveal a
/// record the normal pages would hide. Sections the caller cannot see come back empty.
/// </summary>
public class SearchController : BaseApiController
{
    private const int MinQueryLength = 2;
    private const int MaxQueryLength = 100;

    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;
    private readonly ITaskWorkflowService _taskWorkflow;
    private readonly IAuthorizationService _authorization;

    public SearchController(
        IMediator mediator,
        ApplicationDbContext db,
        RoleScopeService scope,
        ITaskWorkflowService taskWorkflow,
        IAuthorizationService authorization) : base(mediator)
    {
        _db = db;
        _scope = scope;
        _taskWorkflow = taskWorkflow;
        _authorization = authorization;
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery(Name = "q")] string? query,
        [FromQuery] int limit = 5,
        CancellationToken ct = default)
    {
        var term = (query ?? string.Empty).Trim();
        if (term.Length > MaxQueryLength)
        {
            term = term[..MaxQueryLength];
        }

        var projects = new List<SearchHitDto>();
        var tasks = new List<SearchHitDto>();
        var people = new List<SearchHitDto>();
        var departments = new List<SearchHitDto>();

        if (term.Length < MinQueryLength)
        {
            return Ok(new SearchResultsDto(term, projects, tasks, people, departments));
        }

        var take = Math.Clamp(limit, 1, 20);

        if (await CanAsync(AuthorizationPolicies.ProjectsView))
        {
            var scoped = await _scope.ScopeProjectsAsync(_db.Projects.AsNoTracking(), ct);
            var rows = await scoped
                .Where(project => project.Name.Contains(term) || project.ProjectCode.Contains(term))
                .OrderBy(project => project.Name)
                .Take(take)
                .Select(project => new { project.Id, project.Name, project.ProjectCode, project.Status })
                .ToListAsync(ct);

            projects = rows
                .Select(row => new SearchHitDto(
                    "project",
                    row.Id,
                    row.Name,
                    $"{row.ProjectCode} - {row.Status}",
                    row.Id))
                .ToList();
        }

        if (await CanAsync(AuthorizationPolicies.TasksView))
        {
            var allowedProjectIds = await _taskWorkflow.GetAccessibleProjectIdsAsync(ct);
            var rows = await _db.Tasks
                .AsNoTracking()
                .Where(task =>
                    allowedProjectIds.Contains(task.ProjectId) &&
                    task.ParentTaskId == null &&
                    task.Title.Contains(term))
                .OrderByDescending(task => task.CreatedDate)
                .Take(take)
                .Select(task => new
                {
                    task.Id,
                    task.Title,
                    task.ProjectId,
                    ProjectName = task.Project != null ? task.Project.Name : null,
                    task.Status
                })
                .ToListAsync(ct);

            tasks = rows
                .Select(row => new SearchHitDto(
                    "task",
                    row.Id,
                    row.Title,
                    string.IsNullOrEmpty(row.ProjectName)
                        ? row.Status.ToString()
                        : $"{row.ProjectName} - {row.Status}",
                    row.ProjectId))
                .ToList();
        }

        if (await CanAsync(AuthorizationPolicies.UsersView))
        {
            var scoped = await _scope.ScopeUsersAsync(_db.Users.AsNoTracking(), ct);
            var rows = await scoped
                .Where(user =>
                    user.IsActive &&
                    (user.FirstName.Contains(term) ||
                     user.LastName.Contains(term) ||
                     user.Email.Contains(term) ||
                     (user.FirstName + " " + user.LastName).Contains(term)))
                .OrderBy(user => user.FirstName)
                .ThenBy(user => user.LastName)
                .Take(take)
                .Select(user => new { user.Id, user.FirstName, user.LastName, user.Email, user.JobTitle })
                .ToListAsync(ct);

            people = rows
                .Select(row => new SearchHitDto(
                    "person",
                    row.Id,
                    $"{row.FirstName} {row.LastName}".Trim(),
                    string.IsNullOrWhiteSpace(row.JobTitle) ? row.Email : $"{row.JobTitle} - {row.Email}",
                    null))
                .ToList();
        }

        if (await CanAsync(AuthorizationPolicies.DepartmentsView))
        {
            var scoped = await _scope.ScopeDepartmentsAsync(_db.Departments.AsNoTracking(), ct);
            var rows = await scoped
                .Where(department => department.Name.Contains(term) || department.Code.Contains(term))
                .OrderBy(department => department.Name)
                .Take(take)
                .Select(department => new { department.Id, department.Name, department.Code })
                .ToListAsync(ct);

            departments = rows
                .Select(row => new SearchHitDto("department", row.Id, row.Name, row.Code, null))
                .ToList();
        }

        return Ok(new SearchResultsDto(term, projects, tasks, people, departments));
    }

    private async Task<bool> CanAsync(string policy) =>
        (await _authorization.AuthorizeAsync(User, policy)).Succeeded;
}
