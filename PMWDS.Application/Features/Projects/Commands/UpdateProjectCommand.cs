using MediatR;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.Projects.Commands;

public record UpdateProjectCommand(
 Guid Id, UpdateProjectDto Dto) : IRequest<ProjectDto>;
public class UpdateProjectCommandHandler
 : IRequestHandler<UpdateProjectCommand, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IAuditService _audit;
    public UpdateProjectCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IAuditService audit)
    {
        _uow = uow;
        _currentUser = currentUser;
        _audit = audit;
    }
    public async Task<ProjectDto> Handle(
    UpdateProjectCommand req,
    CancellationToken ct)
    {
        var project = await _uow.Projects
        .GetWithDetailsAsync(req.Id, ct)
        ?? throw new NotFoundException(
        "Project", req.Id);
        var oldValues = new
        {
            project.Name,
            project.Description,
            project.PlannedEndDate,
            project.PlannedBudget
        };
        var dto = req.Dto;
        // The join rows that were loaded from the database. Needed to tell which
        // ProjectDepartment instances the AssignDepartments calls below create.
        // Compared by reference on purpose: Project.Update() runs
        // AssignDepartments too, so an already-assigned department can be dropped
        // and re-created as a *new* instance within the same request. Comparing
        // by DepartmentId would mistake that new instance for an existing row.
        var loadedAssignments = project.ProjectDepartments.ToList();
        var projectManagerId = string.IsNullOrWhiteSpace(dto.ProjectManagerId)
        ? (Guid?)null
        : Guid.Parse(dto.ProjectManagerId);
        project.Update(
        dto.Name,
        dto.Description ?? string.Empty,
        dto.Category,
        dto.PlannedStartDate,
        dto.PlannedEndDate,
        dto.PlannedBudget,
        dto.Priority,
        dto.DepartmentId,
        projectManagerId);
        // Project.Update() already assigned the single primary department; this call
        // reconciles the full requested set (adding / dropping assignments).
        project.AssignDepartments(dto.DepartmentIds ?? new[] { dto.DepartmentId });
        project.SetModified(
        _currentUser.UserId ?? "system");
        await _uow.Projects.UpdateAsync(project, ct);
        // EfRepository.UpdateAsync marks the aggregate root Modified. EF's cascade
        // for Modified does NOT add dependents, so the ProjectDepartment rows that
        // AssignDepartments just created were left untracked and EF emitted an
        // UPDATE for each instead of an INSERT. That UPDATE matched no row and the
        // whole request failed with DbUpdateConcurrencyException (HTTP 500) - so
        // editing a project worked only while the department list stayed the
        // same length. Track the new join rows explicitly as Added.
        foreach (var assignment in project.ProjectDepartments
        .Where(a => !loadedAssignments.Any(loaded => ReferenceEquals(loaded, a))))
        {
            await _uow.ProjectDepartments.AddAsync(assignment, ct);
        }
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(
        _currentUser.UserId ?? "system",
        "Update", "Project",
        project.Id.ToString(),
        oldValues,
        new { dto.Name, dto.PlannedEndDate },
        ct: ct);
        var projectManagerName = project.ProjectManagerId.HasValue
            ? (await _uow.Users.GetByIdAsync(project.ProjectManagerId.Value, ct))?.FullName
            : null;
        return ProjectDto.FromEntity(project, projectManagerName);
    }
}
