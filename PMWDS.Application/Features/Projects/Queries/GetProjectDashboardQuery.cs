using MediatR;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Enums;
namespace PMWDS.Application.Features.Projects.Queries;

public record GetProjectDashboardQuery(
 Guid? DepartmentId = null) : IRequest<ProjectDashboardDto>;
public record ProjectDashboardDto(
  int TotalProjects,
  int ActiveProjects,
  int CompletedProjects,
  int OverdueProjects,
  int HighRiskProjects,
  double AverageHealthScore,
  decimal TotalBudget,
  decimal TotalActualCost,
  List<ProjectSummaryDto> RecentProjects,
  List<ProjectSummaryDto> AtRiskProjects
);
public class GetProjectDashboardQueryHandler
 : IRequestHandler<GetProjectDashboardQuery,
 ProjectDashboardDto>
{
    private readonly IUnitOfWork _uow;
    public GetProjectDashboardQueryHandler(IUnitOfWork uow)
    {
        _uow = uow;
    }
    public async Task<ProjectDashboardDto> Handle(
    GetProjectDashboardQuery request,
    CancellationToken ct)
    {
        var projects = request.DepartmentId.HasValue
        ? await _uow.Projects
        .GetByDepartmentAsync(
        request.DepartmentId.Value, ct)
        : await _uow.Projects.GetAllAsync(ct);
        var list = projects.ToList();
        return new ProjectDashboardDto(
        TotalProjects: list.Count,
        ActiveProjects: list.Count(p =>
        p.Status == ProjectStatus.InProgress),
        CompletedProjects: list.Count(p =>
        p.Status == ProjectStatus.Completed),
        OverdueProjects: list.Count(p =>
        p.GetDelayDays() > 0),
        HighRiskProjects: list.Count(p =>
        p.AIDelayRiskScore >= 0.7),
        AverageHealthScore: list.Any()
        ? list.Average(p => p.AIHealthScore)
        : 0,
        TotalBudget: list.Sum(p => p.PlannedBudget),
        TotalActualCost: list.Sum(p => p.ActualCost),
        RecentProjects: list.OrderByDescending(p => p.CreatedDate)
        .Take(5)
        .Select(p => ProjectSummaryDto.FromEntity(p))
        .ToList(),
        AtRiskProjects: list
        .Where(p => p.AIDelayRiskScore >= 0.7)
        .OrderByDescending(p => p.AIDelayRiskScore)
        .Take(10)
        .Select(p => ProjectSummaryDto.FromEntity(p))
        .ToList()
        );
    }
}
