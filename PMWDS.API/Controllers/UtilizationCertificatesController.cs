using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Documents;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
using PMWDS.Infrastructure.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

/// <summary>
/// Utilization Certificates (UC) — the formal proof that grant money, government
/// funds or a corporate contribution was spent strictly for its intended purpose.
/// A contributor uploads the signed certificate against a project; a reviewer with
/// the finance sign-off authority then approves or rejects it.
/// </summary>
[ApiController]
[Route("api/v1/utilization-certificates")]
[Authorize]
[Produces("application/json")]
public class UtilizationCertificatesController : ControllerBase
{
    // A UC is a signed financial document, never a large binary payload.
    private const long MaxFileSizeBytes = 10_000_000;

    private static readonly string[] AllowedContentTypes =
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    private readonly ApplicationDbContext _db;
    private readonly IUnitOfWork _uow;
    private readonly ILocalFileStorageService _localFiles;
    private readonly RoleScopeService _scope;
    private readonly ICurrentUserService _currentUser;
    private readonly IDataChangeNotifier _changes;

    public UtilizationCertificatesController(
        IMediator mediator,
        ApplicationDbContext db,
        IUnitOfWork uow,
        ILocalFileStorageService localFiles,
        RoleScopeService scope,
        ICurrentUserService currentUser,
        IDataChangeNotifier changes)
    {
        _db = db;
        _uow = uow;
        _localFiles = localFiles;
        _scope = scope;
        _currentUser = currentUser;
        _changes = changes;
    }

    /// <summary>Uploads the certificate file and its finance metadata as a draft.</summary>
    [HttpPost]
    [RequestSizeLimit(MaxFileSizeBytes)]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificatesUpload)]
    public async Task<IActionResult> SubmitCertificate(
        IFormFile file,
        [FromForm] SubmitUtilizationCertificateDto dto,
        CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(dto.ProjectId, ct))
            return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "A certificate file is required." });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "The certificate file must be 10 MB or smaller." });

        if (!AllowedContentTypes.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only PDF, Word, Excel, JPEG, PNG or WebP files are accepted." });

        var project = await _uow.Projects.GetByIdAsync(dto.ProjectId, ct);
        if (project == null)
            return NotFound();

        if (!await ValidateWorkItemLinksAsync(dto.ProjectId, dto.MilestoneId, dto.TaskId, ct))
            return BadRequest(new { message = "The linked milestone or task does not belong to this project." });

        await using var stream = file.OpenReadStream();
        var extension = Path.GetExtension(file.FileName);
        var filePath = await _localFiles.UploadDocumentAsync(
            stream, project.ProjectCode, project.Name, extension, file.ContentType, ct);

        var title = string.IsNullOrWhiteSpace(dto.Title) ? file.FileName : dto.Title!.Trim();

        var document = ProjectDocument.Create(
            dto.ProjectId,
            title,
            filePath,
            file.ContentType,
            file.Length,
            _currentUser.UserId ?? "system",
            dto.Description,
            DocumentCategory.UtilizationCertificate);
        document.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.ProjectDocuments.AddAsync(document, ct);

        var certificate = UtilizationCertificate.Create(
            dto.ProjectId,
            document.Id,
            dto.CertificateNumber.Trim(),
            dto.FundingSource.Trim(),
            dto.AmountClaimed,
            dto.AmountUtilized,
            dto.PeriodStart,
            dto.PeriodEnd,
            _currentUser.UserId ?? "system",
            dto.MilestoneId,
            dto.TaskId,
            dto.Purpose);
        certificate.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.UtilizationCertificates.AddAsync(certificate, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: "Utilization Certificate Submitted",
            Description: $"{_currentUser.FullName} submitted utilization certificate \"{dto.CertificateNumber}\" for project \"{project.Name}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = dto.ProjectId,
                ["projectName"] = project.Name,
                ["certificateId"] = certificate.Id,
                ["certificateNumber"] = certificate.CertificateNumber,
                ["amountClaimed"] = certificate.AmountClaimed,
                ["amountUtilized"] = certificate.AmountUtilized
            },
            ProjectId: dto.ProjectId);

        await _changes.NotifyAsync(DataChangeScopes.UtilizationCertificates, certificate.Id.ToString(), certificate.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, certificate.DocumentId.ToString(), certificate.ProjectId, ct);
        return Ok(await ToDtoAsync(new LoadedCertificate(certificate, document), ct));
    }

    /// <summary>All certificates raised against a project.</summary>
    [HttpGet("project/{projectId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateView)]
    // Certificate status drives which action buttons the UI shows, so a cached
    // response would leave stale buttons on screen after a review.
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetForProject(Guid projectId, CancellationToken ct)
    {
        if (!await _scope.CanAccessProjectAsync(projectId, ct))
            return Forbid();

        var certificates = await _db.UtilizationCertificates
            .AsNoTracking()
            .Include(c => c.Document)
            .Include(c => c.Milestone)
            .Include(c => c.Task)
            .Where(c => c.ProjectId == projectId)
            .OrderByDescending(c => c.CreatedDate)
            .ToListAsync(ct);

        var canManageProject = await _scope.CanManageProjectAsync(projectId, ct);
        var canReviewProject = await CanReviewProjectCertificatesAsync(projectId, ct);
        var result = new List<UtilizationCertificateDto>(certificates.Count);
        foreach (var certificate in certificates)
        {
            result.Add(UtilizationCertificateDto.FromEntity(
                certificate,
                await ResolveCapabilitiesAsync(certificate, canManageProject, canReviewProject, ct),
                certificate.Document,
                certificate.Milestone?.Name,
                certificate.Task?.Title));
        }

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateView)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var loaded = await LoadCertificateAsync(id, ct);
        if (loaded is null)
            return NotFound();

        if (!await _scope.CanAccessProjectAsync(loaded.Certificate.ProjectId, ct))
            return Forbid();

        return Ok(await ToDtoAsync(loaded, ct));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateEdit)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUtilizationCertificateDto dto, CancellationToken ct)
    {
        var loaded = await LoadCertificateAsync(id, ct);
        if (loaded is null)
            return NotFound();

        var certificate = loaded.Certificate;

        if (!await _scope.CanAccessProjectAsync(certificate.ProjectId, ct))
            return Forbid();

        if (!certificate.IsEditable())
            return BadRequest(new { message = "Only a draft or rejected certificate can be edited." });

        if (!await CanModifyCertificateAsync(certificate, ct))
            return Forbid();

        if (!await ValidateWorkItemLinksAsync(certificate.ProjectId, dto.MilestoneId, dto.TaskId, ct))
            return BadRequest(new { message = "The linked milestone or task does not belong to this project." });

        certificate.UpdateDetails(
            dto.CertificateNumber.Trim(),
            dto.FundingSource.Trim(),
            dto.AmountClaimed,
            dto.AmountUtilized,
            dto.PeriodStart,
            dto.PeriodEnd,
            dto.MilestoneId,
            dto.TaskId,
            dto.Purpose);
        certificate.SetModified(_currentUser.UserId ?? "system");

        await _uow.UtilizationCertificates.UpdateAsync(certificate, ct);
        await _uow.SaveChangesAsync(ct);

        await _changes.NotifyAsync(DataChangeScopes.UtilizationCertificates, certificate.Id.ToString(), certificate.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, certificate.DocumentId.ToString(), certificate.ProjectId, ct);
        return Ok(await ToDtoAsync(loaded, ct));
    }

    /// <summary>Hand the draft over for review.</summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateEdit)]
    public async Task<IActionResult> MarkAsSubmitted(Guid id, CancellationToken ct)
    {
        var loaded = await LoadCertificateAsync(id, ct);
        if (loaded is null)
            return NotFound();

        var certificate = loaded.Certificate;

        if (!await _scope.CanAccessProjectAsync(certificate.ProjectId, ct))
            return Forbid();

        if (!certificate.IsEditable())
            return BadRequest(new { message = "Only a draft or rejected certificate can be submitted for review." });

        if (!await CanModifyCertificateAsync(certificate, ct))
            return Forbid();

        certificate.MarkAsSubmitted(DateTime.UtcNow);
        certificate.SetModified(_currentUser.UserId ?? "system");
        await _uow.UtilizationCertificates.UpdateAsync(certificate, ct);
        await _uow.SaveChangesAsync(ct);

        await _changes.NotifyAsync(DataChangeScopes.UtilizationCertificates, certificate.Id.ToString(), certificate.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, certificate.DocumentId.ToString(), certificate.ProjectId, ct);
        return Ok(await ToDtoAsync(loaded, ct));
    }

    /// <summary>Approve or reject a submitted certificate. Requires the finance sign-off authority.</summary>
    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateReview)]
    public async Task<IActionResult> Review(Guid id, [FromBody] ReviewUtilizationCertificateDto dto, CancellationToken ct)
    {
        var loaded = await LoadCertificateAsync(id, ct);
        if (loaded is null)
            return NotFound();

        var certificate = loaded.Certificate;

        if (!await _scope.CanAccessProjectAsync(certificate.ProjectId, ct))
            return Forbid();

        // Reviewing is restricted to a SuperAdmin, a Director of the owning
        // organization, or the head of this project's primary department.
        if (!await CanReviewProjectCertificatesAsync(certificate.ProjectId, ct))
            return Forbid();

        if (certificate.Status is not (UtilizationCertificateStatus.Submitted or UtilizationCertificateStatus.UnderReview))
            return BadRequest(new { message = "Only a submitted certificate can be reviewed." });

        if (dto.Approve)
            certificate.Approve(_currentUser.UserId ?? "system", DateTime.UtcNow, dto.Notes);
        else
            certificate.Reject(_currentUser.UserId ?? "system", DateTime.UtcNow, dto.Notes);

        certificate.SetModified(_currentUser.UserId ?? "system");
        await _uow.UtilizationCertificates.UpdateAsync(certificate, ct);
        await _uow.SaveChangesAsync(ct);

        HttpContext.Items["ActivityLog"] = new ActivityLogContext(
            ActivityType: dto.Approve ? "Utilization Certificate Approved" : "Utilization Certificate Rejected",
            Description: $"{_currentUser.FullName} {(dto.Approve ? "approved" : "rejected")} utilization certificate \"{certificate.CertificateNumber}\"",
            Metadata: new Dictionary<string, object>
            {
                ["projectId"] = certificate.ProjectId,
                ["certificateId"] = certificate.Id,
                ["certificateNumber"] = certificate.CertificateNumber,
                ["notes"] = dto.Notes ?? string.Empty
            },
            ProjectId: certificate.ProjectId);

        await _changes.NotifyAsync(DataChangeScopes.UtilizationCertificates, certificate.Id.ToString(), certificate.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, certificate.DocumentId.ToString(), certificate.ProjectId, ct);
        return Ok(await ToDtoAsync(loaded, ct));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.UtilizationCertificateDelete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var loaded = await LoadCertificateAsync(id, ct);
        if (loaded is null)
            return NotFound();

        var certificate = loaded.Certificate;

        if (!await _scope.CanAccessProjectAsync(certificate.ProjectId, ct))
            return Forbid();

        if (!certificate.IsEditable())
            return BadRequest(new { message = "An approved or in-review certificate cannot be deleted." });

        if (!await CanModifyCertificateAsync(certificate, ct))
            return Forbid();

        // Soft-deletes both rows; the underlying file is left on disk so the
        // audit trail stays intact.
        await _uow.UtilizationCertificates.DeleteAsync(id, ct);
        await _uow.ProjectDocuments.DeleteAsync(certificate.DocumentId, ct);
        await _uow.SaveChangesAsync(ct);

        await _changes.NotifyAsync(DataChangeScopes.UtilizationCertificates, certificate.Id.ToString(), certificate.ProjectId, ct);
        await _changes.NotifyAsync(DataChangeScopes.Documents, certificate.DocumentId.ToString(), certificate.ProjectId, ct);
        return NoContent();
    }

    private sealed record LoadedCertificate(UtilizationCertificate Certificate, ProjectDocument Document);

    /// <summary>
    /// Resolves, server-side, exactly what this user may do with this certificate.
    /// The client renders from these flags rather than from its own JWT, so the
    /// buttons can never disagree with what the endpoints will actually allow.
    /// </summary>
    private async Task<UtilizationCertificateCapabilities> ResolveCapabilitiesAsync(
        UtilizationCertificate certificate,
        bool canManageProject,
        bool canReviewProject,
        CancellationToken ct)
    {
        var rolePermissions = await ResolveRolePermissionsAsync(ct);

        var isOwner = !string.IsNullOrWhiteSpace(certificate.SubmittedByUserId) &&
            certificate.SubmittedByUserId.Equals(_currentUser.UserId, StringComparison.OrdinalIgnoreCase);

        // The owner always has a say in their own certificate; a project manager
        // (including a department head whose department owns the project) can act on any.
        var canModify = isOwner || canManageProject;
        var isEditable = certificate.IsEditable();

        return new UtilizationCertificateCapabilities(
            CanEdit: rolePermissions.CanEdit && canModify && isEditable,
            CanSubmitForReview: rolePermissions.CanEdit && canModify && isEditable,
            // Reviewing is a finance sign-off, so it is limited to a SuperAdmin, a
            // Director of the owning organization, and the head of the project's
            // primary (creating) department. An approver who also raised the
            // certificate reviews it in their approver capacity.
            CanReview: rolePermissions.CanReview &&
                canReviewProject &&
                certificate.Status == UtilizationCertificateStatus.Submitted,
            CanDelete: rolePermissions.CanDelete && canModify && isEditable,
            IsOwner: isOwner);
    }

    /// <summary>
    /// Who may sign off a utilization certificate on this project: a SuperAdmin, a
    /// Director inside the owning organization, or the head of the project's primary
    /// department — the department that owns the project.
    /// <para>
    /// Deliberately stricter than <c>CanManageProjectAsync</c>: that helper treats any
    /// department the user is merely <em>assigned</em> to as in-scope, which would let a
    /// department head sign off on a project their department does not own.
    /// </para>
    /// </summary>
    private async Task<bool> CanReviewProjectCertificatesAsync(Guid projectId, CancellationToken ct)
    {
        if (_scope.IsSuperAdmin)
        {
            return true;
        }

        // Must hold review authority before any of the scoping below matters.
        if (!await _scope.HasAnyPermissionAsync(
                ct, PermissionCodes.UtilizationCertificateReview, PermissionCodes.UtilizationCertificateManage))
        {
            return false;
        }

        var userId = _currentUser.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            return false;
        }

        var project = await _db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => new
            {
                p.DepartmentId,
                OrganizationId = p.Department != null ? p.Department.OrganizationId : null
            })
            .FirstOrDefaultAsync(ct);

        if (project == null)
        {
            return false;
        }

        if (_scope.IsDirector && project.OrganizationId.HasValue &&
            await _scope.CanAccessOrganizationAsync(project.OrganizationId.Value, ct))
        {
            return true;
        }

        // Head of the primary department that owns this project.
        return await _db.Departments
            .AnyAsync(d => d.Id == project.DepartmentId && d.DepartmentHeadUserId == userId, ct);
    }

    /// <summary>Reads the caller's UC permissions once per request, straight from the database.</summary>
    private async Task<(bool CanEdit, bool CanReview, bool CanDelete)> ResolveRolePermissionsAsync(CancellationToken ct)
    {
        var canEdit = await _scope.HasAnyPermissionAsync(
            ct, PermissionCodes.UtilizationCertificateEdit, PermissionCodes.UtilizationCertificateManage);
        var canReview = await _scope.HasAnyPermissionAsync(
            ct, PermissionCodes.UtilizationCertificateReview, PermissionCodes.UtilizationCertificateManage);
        var canDelete = await _scope.HasAnyPermissionAsync(
            ct, PermissionCodes.UtilizationCertificateDelete, PermissionCodes.UtilizationCertificateManage);

        return (canEdit, canReview, canDelete);
    }

    private async Task<UtilizationCertificateDto> ToDtoAsync(
        LoadedCertificate loaded,
        CancellationToken ct)
    {
        var projectId = loaded.Certificate.ProjectId;
        var canManageProject = await _scope.CanManageProjectAsync(projectId, ct);
        var canReviewProject = await CanReviewProjectCertificatesAsync(projectId, ct);
        return UtilizationCertificateDto.FromEntity(
            loaded.Certificate,
            await ResolveCapabilitiesAsync(loaded.Certificate, canManageProject, canReviewProject, ct),
            loaded.Document,
            loaded.Certificate.Milestone?.Name,
            loaded.Certificate.Task?.Title);
    }

    private async Task<LoadedCertificate?> LoadCertificateAsync(Guid id, CancellationToken ct)
    {
        var certificate = await _db.UtilizationCertificates
            .Include(c => c.Document)
            .Include(c => c.Milestone)
            .Include(c => c.Task)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (certificate == null)
            return null;

        var document = certificate.Document ??
            await _db.ProjectDocuments.FirstOrDefaultAsync(d => d.Id == certificate.DocumentId, ct);

        if (document == null)
            return null;

        return new LoadedCertificate(certificate, document);
    }

    /// <summary>The owner may edit their own certificate; a project manager may edit any.</summary>
    private async Task<bool> CanModifyCertificateAsync(UtilizationCertificate certificate, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(certificate.SubmittedByUserId) &&
            certificate.SubmittedByUserId.Equals(_currentUser.UserId, StringComparison.OrdinalIgnoreCase))
            return true;

        return await _scope.CanManageProjectAsync(certificate.ProjectId, ct);
    }

    private async Task<bool> ValidateWorkItemLinksAsync(
        Guid projectId,
        Guid? milestoneId,
        Guid? taskId,
        CancellationToken ct)
    {
        if (milestoneId.HasValue &&
            !await _db.Milestones.AnyAsync(m => m.Id == milestoneId.Value && m.ProjectId == projectId, ct))
            return false;

        if (taskId.HasValue &&
            !await _db.Tasks.AnyAsync(t => t.Id == taskId.Value && t.ProjectId == projectId, ct))
            return false;

        return true;
    }
}
