using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.DTOs.Documents;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Features.Projects.Commands;
using PMWDS.Application.Features.Projects.Queries;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Infrastructure.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

public class ProjectsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly IProjectHealthService _ai;
    private readonly ICurrentUserService _currentUser;
    private readonly ILocalFileStorageService _localFiles;
    private readonly RoleScopeService _scope;
    private readonly ApplicationDbContext _db;
    private readonly IDataChangeNotifier _changes;

    public ProjectsController(
        IMediator mediator,
        IUnitOfWork uow,
        IProjectHealthService ai,
        ICurrentUserService currentUser,
        ILocalFileStorageService localFiles,
        RoleScopeService scope,
        ApplicationDbContext db,
        IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _ai = ai;
        _currentUser = currentUser;
        _localFiles = localFiles;
        _scope = scope;
        _db = db;
        _changes = changes;
    }

    [HttpGet("dashboard")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsView)]
    public async Task<IActionResult> GetDashboard([FromQuery] Guid? departmentId, CancellationToken ct)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var now = DateTime.UtcNow;
        var query = _db.Projects
            .AsNoTracking();

        if (departmentId.HasValue)
        {
            query = query.Where(project =>
                project.DepartmentId == departmentId.Value ||
                project.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        query = await _scope.ScopeProjectsAsync(query, ct);

        var metrics = await query
            .GroupBy(_ => 1)
            .Select(group => new
            {
                TotalProjects = group.Count(),
                ActiveProjects = group.Count(project => project.Status == ProjectStatus.InProgress),
                CompletedProjects = group.Count(project => project.Status == ProjectStatus.Completed),
                OnHoldProjects = group.Count(project => project.Status == ProjectStatus.OnHold),
                DelayedProjects = group.Count(project =>
                    project.Status == ProjectStatus.Delayed ||
                    (project.Status != ProjectStatus.Completed &&
                     project.ProgressPercentage < 100 &&
                     project.PlannedEndDate < now)),
                OverdueProjects = group.Count(project =>
                    (project.ActualEndDate.HasValue && project.ActualEndDate > project.PlannedEndDate) ||
                    (!project.ActualEndDate.HasValue && now > project.PlannedEndDate)),
                HighRiskProjects = group.Count(project => project.AIDelayRiskScore >= 0.7),
                AverageHealthScore = group.Average(project => project.AIHealthScore),
                TotalBudget = group.Sum(project => project.PlannedBudget),
                TotalActualCost = group.Sum(project => project.ActualCost)
            })
            .FirstOrDefaultAsync(ct);

        var recentProjectRows = await query
            .OrderByDescending(project => project.CreatedDate)
            .Take(5)
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                project.ActualEndDate,
                project.PlannedEndDate
            })
            .ToListAsync(ct);

        var recentProjectPreviewRows = await query
            .OrderByDescending(project => project.CreatedDate)
            .Take(50)
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                project.ActualEndDate,
                project.PlannedEndDate
            })
            .ToListAsync(ct);

        var atRiskProjectRows = await query
            .Where(project => project.AIDelayRiskScore >= 0.7)
            .OrderByDescending(project => project.AIDelayRiskScore)
            .Take(10)
            .Select(project => new
            {
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status,
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                project.ActualEndDate,
                project.PlannedEndDate
            })
            .ToListAsync(ct);

        var recentProjects = recentProjectRows
            .Select(project => new ProjectSummaryDto(
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status.ToString(),
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                GetDelayDays(project.ActualEndDate, project.PlannedEndDate, now),
                project.PlannedEndDate))
            .ToList();

        var atRiskProjects = atRiskProjectRows
            .Select(project => new ProjectSummaryDto(
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status.ToString(),
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                GetDelayDays(project.ActualEndDate, project.PlannedEndDate, now),
                project.PlannedEndDate))
            .ToList();

        var recentProjectPreviews = recentProjectPreviewRows
            .Select(project => new ProjectSummaryDto(
                project.Id,
                project.ProjectCode,
                project.Name,
                project.Status.ToString(),
                project.ProgressPercentage,
                project.AIHealthScore,
                project.AIDelayRiskScore,
                GetDelayDays(project.ActualEndDate, project.PlannedEndDate, now),
                project.PlannedEndDate))
            .ToList();

        return Ok(new ProjectDashboardDto(
            TotalProjects: metrics?.TotalProjects ?? 0,
            ActiveProjects: metrics?.ActiveProjects ?? 0,
            CompletedProjects: metrics?.CompletedProjects ?? 0,
            OnHoldProjects: metrics?.OnHoldProjects ?? 0,
            DelayedProjects: metrics?.DelayedProjects ?? 0,
            OverdueProjects: metrics?.OverdueProjects ?? 0,
            HighRiskProjects: metrics?.HighRiskProjects ?? 0,
            AverageHealthScore: metrics?.AverageHealthScore ?? 0,
            TotalBudget: metrics?.TotalBudget ?? 0,
            TotalActualCost: metrics?.TotalActualCost ?? 0,
            RecentProjects: recentProjects,
            AtRiskProjects: atRiskProjects,
            RecentProjectPreviews: recentProjectPreviews));
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.ProjectsView)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? departmentId,
        [FromQuery] ProjectStatus? status,
        [FromQuery] PaginationQuery pagination,
        CancellationToken ct)
    {
        if (departmentId.HasValue && !await _scope.CanAccessDepartmentAsync(departmentId.Value, ct))
        {
            return Forbid();
        }

        var query = _db.Projects.AsNoTracking();

        if (departmentId.HasValue)
        {
            query = query.Where(p =>
                p.DepartmentId == departmentId.Value ||
                p.ProjectDepartments.Any(assignment => assignment.DepartmentId == departmentId.Value));
        }

        query = await _scope.ScopeProjectsAsync(query, ct);

        if (status.HasValue)
        {
            query = query.Where(p => p.Status == status.Value);
        }

        var totalCount = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(p => p.CreatedDate)
            .Skip(pagination.Skip)
            .Take(pagination.NormalizedPageSize)
            .Select(p => new
            {
                p.Id,
                p.ProjectCode,
                p.Name,
                p.Description,
                p.Category,
                p.Status,
                p.Priority,
                p.PlannedStartDate,
                p.PlannedEndDate,
                p.ActualStartDate,
                p.ActualEndDate,
                p.PlannedBudget,
                p.ActualCost,
                p.ProgressPercentage,
                p.AIHealthScore,
                p.AIDelayRiskScore,
                p.AIBudgetRiskScore,
                p.AIInsightsSummary,
                p.DepartmentId,
                DepartmentName = p.Department != null ? p.Department.Name : null,
                p.ProjectManagerId,
                ProjectManagerName = p.ProjectManagerId.HasValue
                    ? _db.Users
                        .Where(u => u.Id == p.ProjectManagerId.Value)
                        .Select(u => u.FirstName + " " + u.LastName)
                        .FirstOrDefault()
                    : null,
                TotalTasks = p.Tasks.Count,
                CompletedTasks = p.Tasks.Count(t => t.Status == PMWDS.Domain.Enums.TaskStatus.Completed),
                OverdueTasks = p.Tasks.Count(t =>
                    t.Status != PMWDS.Domain.Enums.TaskStatus.Completed &&
                    t.DueDate < DateTime.UtcNow),
                TotalMilestones = p.Milestones.Count,
                CompletedMilestones = p.Milestones.Count(m =>
                    m.Status == PMWDS.Domain.Enums.MilestoneStatus.Completed),
                p.CreatedDate
            })
            .ToListAsync(ct);

        var projectIds = rows.Select(row => row.Id).ToList();

        var departmentRows = await _db.ProjectDepartments
            .AsNoTracking()
            .Where(assignment => projectIds.Contains(assignment.ProjectId))
            .Select(assignment => new
            {
                assignment.ProjectId,
                assignment.DepartmentId,
                DepartmentName = assignment.Department != null ? assignment.Department.Name : null,
                assignment.IsPrimary
            })
            .ToListAsync(ct);

        var milestoneRows = await _db.Milestones
            .AsNoTracking()
            .Where(milestone => projectIds.Contains(milestone.ProjectId))
            .Select(milestone => new
            {
                milestone.ProjectId,
                milestone.Status,
                milestone.ProgressPercentage
            })
            .ToListAsync(ct);

        var departmentsByProject = departmentRows
            .GroupBy(row => row.ProjectId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .GroupBy(row => row.DepartmentId)
                    .Select(departmentGroup =>
                        new ProjectDepartmentDto(
                            departmentGroup.Key,
                            departmentGroup.Select(row => row.DepartmentName).FirstOrDefault(),
                            departmentGroup.Any(row => row.IsPrimary)))
                    .ToList());

        var milestonesByProject = milestoneRows
            .GroupBy(row => row.ProjectId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var items = rows.Select(row =>
        {
            var milestones = milestonesByProject.GetValueOrDefault(row.Id) ?? [];
            var progress = row.ProgressPercentage;
            var projectStatus = row.Status;

            if (milestones.Count > 0)
            {
                progress = Math.Round(milestones.Average(milestone =>
                    Math.Clamp(milestone.ProgressPercentage, 0, 100)), 1);

                if (milestones.All(milestone =>
                    milestone.Status == PMWDS.Domain.Enums.MilestoneStatus.Completed))
                {
                    projectStatus = PMWDS.Domain.Enums.ProjectStatus.Completed;
                    progress = 100;
                }
                else if (milestones.Any(milestone =>
                    milestone.Status == PMWDS.Domain.Enums.MilestoneStatus.Delayed))
                {
                    projectStatus = PMWDS.Domain.Enums.ProjectStatus.Delayed;
                }
                else if (projectStatus == PMWDS.Domain.Enums.ProjectStatus.NotStarted &&
                         milestones.Any(milestone =>
                             milestone.ProgressPercentage > 0 ||
                             milestone.Status == PMWDS.Domain.Enums.MilestoneStatus.InProgress))
                {
                    projectStatus = PMWDS.Domain.Enums.ProjectStatus.InProgress;
                }
            }

            var projectDepartments = departmentsByProject.GetValueOrDefault(row.Id) ?? [];
            if (projectDepartments.Count == 0)
            {
                projectDepartments =
                [
                    new ProjectDepartmentDto(row.DepartmentId, row.DepartmentName, true)
                ];
            }

            return new ProjectDto(
                Id: row.Id,
                ProjectCode: row.ProjectCode,
                Name: row.Name,
                Description: row.Description,
                Category: row.Category,
                Status: projectStatus.ToString(),
                Priority: row.Priority.ToString(),
                PlannedStartDate: row.PlannedStartDate,
                PlannedEndDate: row.PlannedEndDate,
                ActualStartDate: row.ActualStartDate,
                ActualEndDate: row.ActualEndDate,
                PlannedBudget: row.PlannedBudget,
                ActualCost: row.ActualCost,
                BudgetVariance: row.PlannedBudget - row.ActualCost,
                ProgressPercentage: progress,
                AIHealthScore: row.AIHealthScore,
                AIDelayRiskScore: row.AIDelayRiskScore,
                AIBudgetRiskScore: row.AIBudgetRiskScore,
                AIInsightsSummary: row.AIInsightsSummary,
                DepartmentId: row.DepartmentId,
                DepartmentName: row.DepartmentName,
                DepartmentIds: projectDepartments.Select(department => department.DepartmentId).Distinct().ToList(),
                Departments: projectDepartments,
                ProjectManagerId: row.ProjectManagerId?.ToString() ?? string.Empty,
                ProjectManagerName: row.ProjectManagerName,
                TotalTasks: row.TotalTasks,
                CompletedTasks: row.CompletedTasks,
                OverdueTasks: row.OverdueTasks,
                TotalMilestones: row.TotalMilestones,
                CompletedMilestones: row.CompletedMilestones,
                CreatedDate: row.CreatedDate)
            ;
        }).ToList();

        return Ok(PaginatedResponse<ProjectDto>.Create(items, pagination, totalCount));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsView)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(await Mediator.Send(new GetProjectDetailsQuery(id), ct));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.ProjectsCreate)]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto dto, CancellationToken ct)
    {
        var departmentIds = ResolveDepartmentIds(dto.DepartmentId, dto.DepartmentIds);
        if (!await AreDepartmentsInScopeAsync(departmentIds, ct))
        {
            return Forbid();
        }

        if (!await _scope.CanCreateProjectAsync(dto.DepartmentId, ct))
        {
            return Forbid();
        }

        if (!string.IsNullOrEmpty(dto.ProjectManagerId) &&
            !await IsUserInDepartmentOrganizationsAsync(dto.ProjectManagerId, departmentIds, ct))
        {
            return BadRequest(new { message = "Project manager must belong to one of the selected department organizations." });
        }

        var result = await Mediator.Send(new CreateProjectCommand(dto), ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Project Created",
            Description: $"{_currentUser.FullName} created project \"{result.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = result.Id,
                ["projectName"] = result.Name
            },
            ProjectId: result.Id
        );

        await _changes.NotifyAsync(DataChangeScopes.Projects, result.Id.ToString(), result.Id, ct);

        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsEdit)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectDto dto, CancellationToken ct)
    {
        if (!await _scope.CanEditProjectAsync(id, ct))
        {
            return Forbid();
        }

        var departmentIds = ResolveDepartmentIds(dto.DepartmentId, dto.DepartmentIds);
        if (!await AreDepartmentsInScopeAsync(departmentIds, ct))
        {
            return Forbid();
        }

        if (!string.IsNullOrEmpty(dto.ProjectManagerId) &&
            !await IsUserInDepartmentOrganizationsAsync(dto.ProjectManagerId, departmentIds, ct))
        {
            return BadRequest(new { message = "Project manager must belong to one of the selected department organizations." });
        }

        var updateResult = await Mediator.Send(new UpdateProjectCommand(id, dto), ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Project Updated",
            Description: $"{_currentUser.FullName} updated project \"{updateResult.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = updateResult.Id,
                ["projectName"] = updateResult.Name
            },
            ProjectId: updateResult.Id
        );

        await _changes.NotifyAsync(DataChangeScopes.Projects, updateResult.Id.ToString(), updateResult.Id, ct);

        return Ok(updateResult);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsEdit)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateProjectStatusRequest req, CancellationToken ct)
    {
        if (!await _scope.CanEditProjectAsync(id, ct))
        {
            return Forbid();
        }

        var statusResult = await Mediator.Send(new UpdateProjectStatusCommand(id, req.NewStatus, req.Justification), ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Project Status Changed",
            Description: $"{_currentUser.FullName} changed project \"{statusResult.Name}\" status to \"{req.NewStatus}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = statusResult.Id,
                ["projectName"] = statusResult.Name,
                ["newStatus"] = req.NewStatus.ToString(),
                ["justification"] = req.Justification ?? ""
            },
            ProjectId: statusResult.Id
        );

        await _changes.NotifyAsync(DataChangeScopes.Projects, statusResult.Id.ToString(), statusResult.Id, ct);

        return Ok(statusResult);
    }

    [HttpGet("{id:guid}/progress")]
    public async Task<IActionResult> GetProgress(Guid id, CancellationToken ct)
    {
        var project = await _uow.Projects.GetWithDetailsAsync(id, ct);
        if (project == null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(new
        {
            project.Id,
            project.Name,
            project.ProgressPercentage,
            TotalTasks = project.Tasks.Count,
            CompletedTasks = project.Tasks.Count(t => t.Status == PMWDS.Domain.Enums.TaskStatus.Completed),
            OverdueTasks = project.Tasks.Count(t => t.IsOverdue())
        });
    }

    [HttpGet("{id:guid}/ai/health")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetAIHealth(Guid id, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(await Mediator.Send(new GetProjectHealthQuery(id), ct));
    }

    [HttpGet("{id:guid}/ai/insights")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetAIInsights(Guid id, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(await _ai.GenerateProjectInsightsAsync(id, ct));
    }

    [HttpPost("{id:guid}/ai/optimize-resources")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> OptimizeResources(Guid id, CancellationToken ct)
    {
        if (!await _scope.CanManageProjectAsync(id, ct))
        {
            return Forbid();
        }

        return Ok(await _ai.OptimizeResourceAllocationAsync(id, ct));
    }

    [HttpGet("{id:guid}/documents/capabilities")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsView)]
    public async Task<IActionResult> GetDocumentCapabilities(Guid id, CancellationToken ct)
    {
        var project = await _uow.Projects.GetByIdAsync(id, ct);
        if (project == null)
            return NotFound();

        var canView = await _scope.GetProjectDocumentAccessScopeAsync(
            id,
            ct,
            PermissionCodes.DocumentOwnView,
            PermissionCodes.DocumentAllView,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage);

        if (canView == DepartmentDataScope.None)
            return Forbid();

        var canProjectUpload = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.DocumentOwnProjectUpload,
            PermissionCodes.DocumentAllProjectUpload);

        var canMilestoneUpload = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.DocumentOwnMilestoneUpload,
            PermissionCodes.DocumentAllMilestoneUpload);

        var canTaskUpload = await _scope.HasAnyPermissionAsync(
            ct,
            PermissionCodes.DocumentOwnTaskUpload,
            PermissionCodes.DocumentAllTaskUpload);

        return Ok(new ProjectDocumentCapabilitiesDto(
            canProjectUpload,
            canMilestoneUpload,
            canTaskUpload,
            await _scope.CanModifyProjectDocumentAsync(
                id, null, null, ct,
                PermissionCodes.DocumentOwnEdit,
                PermissionCodes.DocumentAllEdit,
                PermissionCodes.DocumentOwnManage,
                PermissionCodes.DocumentAllManage),
            await _scope.CanModifyProjectDocumentAsync(
                id, null, null, ct,
                PermissionCodes.DocumentOwnDelete,
                PermissionCodes.DocumentAllDelete,
                PermissionCodes.DocumentOwnManage,
                PermissionCodes.DocumentAllManage)));
    }

    [HttpPost("{id:guid}/documents")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsUpload)]
    public async Task<IActionResult> UploadDocument(
        Guid id,
        IFormFile? file,
        [FromForm] Guid? milestoneId,
        [FromForm] Guid? taskId,
        [FromForm] DocumentCategory? category,
        CancellationToken ct)
    {
        var project = await _uow.Projects.GetByIdAsync(id, ct);
        if (project == null)
            return NotFound();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "A document file is required." });

        Guid? resolvedMilestoneId = milestoneId;
        if (taskId.HasValue)
        {
            var task = await _db.Tasks
                .Where(item => item.Id == taskId.Value && item.ProjectId == id)
                .Select(item => new { item.MilestoneId })
                .FirstOrDefaultAsync(ct);

            if (task == null)
                return BadRequest(new { message = "The selected task does not belong to this project." });

            if (milestoneId.HasValue && task.MilestoneId != milestoneId)
                return BadRequest(new { message = "The selected task does not belong to the selected milestone." });

            resolvedMilestoneId = task.MilestoneId;
        }
        else if (milestoneId.HasValue)
        {
            var milestoneExists = await _db.Milestones.AnyAsync(
                milestone => milestone.Id == milestoneId.Value && milestone.ProjectId == id,
                ct);
            if (!milestoneExists)
                return BadRequest(new { message = "The selected milestone does not belong to this project." });
        }

        var levelUploadAllowed = taskId.HasValue
            ? await _scope.CanUploadProjectDocumentAsync(
                id, resolvedMilestoneId, taskId, ct,
                PermissionCodes.DocumentOwnTaskUpload,
                PermissionCodes.DocumentAllTaskUpload)
            : resolvedMilestoneId.HasValue
                ? await _scope.CanUploadProjectDocumentAsync(
                    id, resolvedMilestoneId, null, ct,
                    PermissionCodes.DocumentOwnMilestoneUpload,
                    PermissionCodes.DocumentAllMilestoneUpload)
                : await _scope.CanUploadProjectDocumentAsync(
                    id, null, null, ct,
                    PermissionCodes.DocumentOwnProjectUpload,
                    PermissionCodes.DocumentAllProjectUpload);

        if (!levelUploadAllowed)
            return Forbid();

        var resolvedCategory = category is null || category == DocumentCategory.UtilizationCertificate
            ? DocumentCategory.General
            : category.Value;

        await using var stream = file.OpenReadStream();
        var extension = Path.GetExtension(file.FileName);
        var filePath = await _localFiles.UploadDocumentAsync(
            stream,
            project.ProjectCode,
            project.Name,
            extension,
            file.ContentType,
            ct);

        var doc = ProjectDocument.Create(
            id,
            file.FileName,
            filePath,
            file.ContentType,
            file.Length,
            _currentUser.UserId ?? "system",
            description: null,
            category: resolvedCategory,
            milestoneId: resolvedMilestoneId,
            taskId: taskId);
        doc.ValidateHierarchy();
        doc.SetCreatedBy(_currentUser.UserId ?? "system");

        await _uow.ProjectDocuments.AddAsync(doc, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Document Uploaded",
            Description: $"{_currentUser.FullName} uploaded \"{file.FileName}\" to project \"{project.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = id,
                ["projectName"] = project.Name,
                ["documentId"] = doc.Id,
                ["fileName"] = file.FileName,
                ["fileSize"] = file.Length,
                ["level"] = doc.Level.ToString()
            },
            ProjectId: id);

        await _changes.NotifyAsync(DataChangeScopes.Documents, doc.Id.ToString(), id, ct);
        return Ok(MapDocument(doc, project.Name));
    }

    [HttpGet("{id:guid}/documents")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsView)]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetDocuments(Guid id, CancellationToken ct)
    {
        var project = await _uow.Projects.GetByIdAsync(id, ct);
        if (project == null)
            return NotFound();

        var accessScope = await _scope.GetProjectDocumentAccessScopeAsync(
            id,
            ct,
            PermissionCodes.DocumentOwnView,
            PermissionCodes.DocumentAllView,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage);

        if (accessScope == DepartmentDataScope.None)
            return Forbid();

        var departmentIds = accessScope == DepartmentDataScope.OwnDepartment
            ? await _scope.GetDepartmentIdsAsync(ct)
            : [];

        var docs = await _db.ProjectDocuments
            .AsNoTracking()
            .Include(document => document.Milestone)
            .Include(document => document.Task)
                .ThenInclude(task => task!.Milestone)
            .Where(document => document.ProjectId == id)
            .OrderByDescending(document => document.CreatedDate)
            .ToListAsync(ct);

        if (accessScope == DepartmentDataScope.OwnDepartment)
        {
            docs = docs.Where(document =>
            {
                var targetDepartmentId = document.Task?.Milestone?.DepartmentId
                    ?? document.Milestone?.DepartmentId
                    ?? project.DepartmentId;
                return departmentIds.Contains(targetDepartmentId);
            }).ToList();
        }

        return Ok(docs.Select(document => MapDocument(document, project.Name)));
    }

    [HttpPut("{id:guid}/documents/{docId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsEdit)]
    public async Task<IActionResult> UpdateDocument(
        Guid id,
        Guid docId,
        [FromBody] UpdateProjectDocumentDto dto,
        CancellationToken ct)
    {
        var doc = await _db.ProjectDocuments
            .Include(document => document.Milestone)
            .Include(document => document.Task)
                .ThenInclude(task => task!.Milestone)
            .FirstOrDefaultAsync(document => document.Id == docId && document.ProjectId == id, ct);

        if (doc == null)
            return NotFound();

        if (!await _scope.CanModifyProjectDocumentAsync(
            id,
            doc.MilestoneId,
            doc.TaskId,
            ct,
            PermissionCodes.DocumentOwnEdit,
            PermissionCodes.DocumentAllEdit,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage))
            return Forbid();

        doc.UpdateMetadata(dto.Title, dto.Description, dto.Category);
        doc.SetModified(_currentUser.UserId ?? "system");
        await _uow.ProjectDocuments.UpdateAsync(doc, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, doc.Id.ToString(), id, ct);
        return Ok(MapDocument(doc, null));
    }

    [HttpGet("{id:guid}/documents/{docId:guid}/download")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsView)]
    public async Task<IActionResult> DownloadDocument(Guid id, Guid docId, CancellationToken ct)
    {
        var doc = await _db.ProjectDocuments
            .AsNoTracking()
            .Include(document => document.Milestone)
            .Include(document => document.Task)
                .ThenInclude(task => task!.Milestone)
            .FirstOrDefaultAsync(document => document.Id == docId && document.ProjectId == id, ct);

        if (doc == null)
            return NotFound();

        if (!await _scope.CanAccessProjectDocumentAsync(
            id,
            doc.MilestoneId,
            doc.TaskId,
            ct,
            PermissionCodes.DocumentOwnView,
            PermissionCodes.DocumentAllView,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage))
            return Forbid();

        var stream = await _localFiles.DownloadFileAsync(doc.FilePath, ct);
        return File(stream, doc.ContentType, doc.Title);
    }

    [HttpDelete("{id:guid}/documents/{docId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.DocumentsDelete)]
    public async Task<IActionResult> DeleteDocument(Guid id, Guid docId, CancellationToken ct)
    {
        var doc = await _db.ProjectDocuments
            .AsNoTracking()
            .Include(document => document.Milestone)
            .Include(document => document.Task)
                .ThenInclude(task => task!.Milestone)
            .FirstOrDefaultAsync(document => document.Id == docId && document.ProjectId == id, ct);

        if (doc == null)
            return NotFound();

        if (!await _scope.CanModifyProjectDocumentAsync(
            id,
            doc.MilestoneId,
            doc.TaskId,
            ct,
            PermissionCodes.DocumentOwnDelete,
            PermissionCodes.DocumentAllDelete,
            PermissionCodes.DocumentOwnManage,
            PermissionCodes.DocumentAllManage))
            return Forbid();

        await _uow.ProjectDocuments.DeleteAsync(doc.Id, ct);
        await _uow.SaveChangesAsync(ct);
        await _localFiles.DeleteFileAsync(doc.FilePath, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, doc.Id.ToString(), id, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProjectsDelete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var project = await _uow.Projects.GetByIdAsync(id, ct);
        if (project == null)
        {
            return NotFound();
        }

        if (!await _scope.CanDeleteProjectAsync(id, ct))
        {
            return Forbid();
        }

        var projectName = project.Name;

        var milestoneIds = await _db.Milestones
            .Where(m => m.ProjectId == id)
            .Select(m => m.Id)
            .ToListAsync(ct);
        if (milestoneIds.Count > 0)
        {
            var deps = await _db.MilestoneDependencies
                .Where(d => milestoneIds.Contains(d.PrerequisiteMilestoneId) || milestoneIds.Contains(d.DependentMilestoneId))
                .ToListAsync(ct);
            if (deps.Count > 0)
                _db.MilestoneDependencies.RemoveRange(deps);
        }

        await _uow.Tasks.DeleteTasksByProjectAsync(id, ct);
        await _uow.Projects.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Project Deleted",
            Description: $"{_currentUser.FullName} deleted project \"{projectName}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectName"] = projectName,
                ["projectId"] = id
            },
            ProjectId: id
        );

        // Deleting a project cascades its milestones, tasks and documents, so every
        // dependent scope has to refetch too.
        await _changes.NotifyAsync(DataChangeScopes.Projects, id.ToString(), null, ct);
        await _changes.NotifyAsync(DataChangeScopes.Milestones, id.ToString(), null, ct);
        await _changes.NotifyAsync(DataChangeScopes.Tasks, id.ToString(), null, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, id.ToString(), null, ct);

        return NoContent();
    }

    private static ProjectDocumentDto MapDocument(ProjectDocument document, string? projectName)
        => new(
            document.Id,
            document.ProjectId,
            projectName,
            document.MilestoneId,
            document.Milestone?.Name,
            document.TaskId,
            document.Task?.Title,
            document.Level,
            document.Title,
            document.FilePath,
            document.ContentType,
            document.FileSizeBytes,
            document.UploadedByUserId,
            document.Description,
            document.Version,
            document.Category,
            document.CreatedDate);

    private async Task<bool> AreDepartmentsInScopeAsync(IReadOnlyCollection<Guid> departmentIds, CancellationToken ct)
    {
        foreach (var departmentId in departmentIds)
        {
            if (!await _scope.CanAccessDepartmentAsync(departmentId, ct))
            {
                return false;
            }
        }

        return true;
    }

    private static List<Guid> ResolveDepartmentIds(Guid primaryDepartmentId, IReadOnlyCollection<Guid>? assignedDepartmentIds)
        => (assignedDepartmentIds ?? Array.Empty<Guid>())
            .Append(primaryDepartmentId)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

    private static int GetDelayDays(DateTime? actualEndDate, DateTime plannedEndDate, DateTime now)
    {
        var compareDate = actualEndDate ?? now;
        return compareDate > plannedEndDate
            ? (int)(compareDate - plannedEndDate).TotalDays
            : 0;
    }

    private async Task<bool> IsUserInDepartmentOrganizationsAsync(string userId, IReadOnlyCollection<Guid> departmentIds, CancellationToken ct)
    {
        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            return false;
        }

        var organizationIds = await _db.Departments
            .Where(department => departmentIds.Contains(department.Id) && department.OrganizationId.HasValue)
            .Select(department => department.OrganizationId!.Value)
            .ToListAsync(ct);

        if (organizationIds.Count == 0)
        {
            return false;
        }

        return await _db.Users.AnyAsync(user =>
            user.Id == parsedUserId &&
            ((user.OrganizationId.HasValue && organizationIds.Contains(user.OrganizationId.Value)) ||
             user.DepartmentAssignments.Any(assignment =>
                 assignment.Department != null &&
                 assignment.Department.OrganizationId.HasValue &&
                 organizationIds.Contains(assignment.Department.OrganizationId.Value)) ||
             user.Department != null &&
                 user.Department.OrganizationId.HasValue &&
                 organizationIds.Contains(user.Department.OrganizationId.Value)),
            ct);
    }

    private async Task<Dictionary<Guid, string>> ResolveProjectManagerNamesAsync(IEnumerable<Project> projects, CancellationToken ct)
    {
        var managerIds = projects
            .Select(project => project.ProjectManagerId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (managerIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        return await _db.Users
            .AsNoTracking()
            .Where(user => managerIds.Contains(user.Id))
            .ToDictionaryAsync(user => user.Id, user => user.FullName, ct);
    }
}
