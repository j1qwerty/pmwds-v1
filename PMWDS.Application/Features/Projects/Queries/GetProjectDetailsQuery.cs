using MediatR;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Application.DTOs.Projects;
namespace PMWDS.Application.Features.Projects.Queries;

public record GetProjectDetailsQuery(
 Guid ProjectId) : IRequest<ProjectDto>;
public class GetProjectDetailsQueryHandler
 : IRequestHandler<GetProjectDetailsQuery, ProjectDto>
{
    private readonly IUnitOfWork _uow;
    public GetProjectDetailsQueryHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }
    public async Task<ProjectDto> Handle(
    GetProjectDetailsQuery request,
    CancellationToken ct)
    {
        var project = await _uow.Projects
        .GetWithDetailsAsync(request.ProjectId, ct)
        ?? throw new NotFoundException(
        nameof(Project), request.ProjectId);
        var projectManagerName = project.ProjectManagerId.HasValue
            ? (await _uow.Users.GetByIdAsync(project.ProjectManagerId.Value, ct))?.FullName
            : null;
        return ProjectDto.FromEntity(project, projectManagerName);
    }
}
