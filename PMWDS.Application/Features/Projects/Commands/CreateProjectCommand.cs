using MediatR;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
namespace PMWDS.Application.Features.Projects.Commands;

public record CreateProjectCommand(
 CreateProjectDto Dto) : IRequest<ProjectDto>;
public class CreateProjectCommandHandler
 : IRequestHandler<CreateProjectCommand, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;
    public CreateProjectCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IAuditService audit,
    INotificationService notifications)
    {
        _uow = uow;
        _currentUser = currentUser;
        _audit = audit;
        _notifications = notifications;
    }
    public async Task<ProjectDto> Handle(
    CreateProjectCommand req,
    CancellationToken ct)
    {
        var dto = req.Dto;
        // Validate department exists
        var dept = await _uow.Departments
        .GetByIdAsync(dto.DepartmentId, ct)
        ?? throw new NotFoundException(
        "Department", dto.DepartmentId);
        // Validate project manager exists (optional)
        Guid? projectManagerId = null;
        string? managerName = null;
        if (!string.IsNullOrEmpty(dto.ProjectManagerId))
        {
           projectManagerId = Guid.Parse(dto.ProjectManagerId);
           var manager = await _uow.Users
           .GetByIdAsync(
           projectManagerId.Value, ct)
           ?? throw new NotFoundException(
           "User", dto.ProjectManagerId);
           managerName = manager.FullName;
        }

        var project = Project.Create(
        dto.Name,
        dto.Description ?? string.Empty,
        dto.Category,
        dto.Priority,
        dto.DepartmentId,
        projectManagerId,
        dto.PlannedStartDate,
        dto.PlannedEndDate,
        dto.PlannedBudget,
        null,
        dto.ProjectCode);
        project.AssignDepartments(
            dto.DepartmentIds ?? new[] { dto.DepartmentId },
            dto.HasPrimaryDepartment);
        project.SetCreatedBy(_currentUser.UserId ?? "system");


        await _uow.Projects.AddAsync(project, ct);
        await _uow.SaveChangesAsync(ct);
        // Audit log
        await _audit.LogAsync(
        _currentUser.UserId ?? "system",
        "Create", "Project",
        project.Id.ToString(),
        null, new { project.Id, project.Name },
        ct: ct);
        // Notify project manager
        return ProjectDto.FromEntity(project, managerName ?? "N/A");
    }
}
