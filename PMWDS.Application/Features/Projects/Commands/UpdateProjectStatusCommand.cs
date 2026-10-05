using MediatR;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Enums;
namespace PMWDS.Application.Features.Projects.Commands;

public record UpdateProjectStatusCommand(
 Guid Id,
 ProjectStatus NewStatus,
 string? Justification) : IRequest<ProjectDto>;
public class UpdateProjectStatusCommandHandler
 : IRequestHandler<UpdateProjectStatusCommand, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IAuditService _audit;
    private readonly INotificationService _notifications;
    public UpdateProjectStatusCommandHandler(
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
    UpdateProjectStatusCommand req,


    CancellationToken ct)
    {
        var project = await _uow.Projects
        .GetByIdAsync(req.Id, ct)
        ?? throw new NotFoundException(
        "Project", req.Id);
        var oldStatus = project.Status;
        project.UpdateStatus(req.NewStatus);
        project.SetModified(
        _currentUser.UserId ?? "system");
        await _uow.Projects.UpdateAsync(project, ct);
        await _uow.SaveChangesAsync(ct);
        await _audit.LogAsync(
        _currentUser.UserId ?? "system",
        "StatusChange", "Project",
        project.Id.ToString(),
        new { Status = oldStatus.ToString() },
        new
        {
            Status = req.NewStatus.ToString(),
            req.Justification
        },
        ct: ct);
        await _notifications.SendProjectStatusChangedAsync(
        project.Id, oldStatus, req.NewStatus, ct);
        var projectManagerName = project.ProjectManagerId.HasValue
            ? (await _uow.Users.GetByIdAsync(project.ProjectManagerId.Value, ct))?.FullName
            : null;
        return ProjectDto.FromEntity(project, projectManagerName);
    }
}
