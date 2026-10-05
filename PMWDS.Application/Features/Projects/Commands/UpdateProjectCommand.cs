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
        project.AssignDepartments(dto.DepartmentIds ?? new[] { dto.DepartmentId });
        project.SetModified(
        _currentUser.UserId ?? "system");
        await _uow.Projects.UpdateAsync(project, ct);
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
