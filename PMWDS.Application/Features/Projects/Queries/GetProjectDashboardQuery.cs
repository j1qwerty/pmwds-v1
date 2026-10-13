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
  int OnHoldProjects,
  int DelayedProjects,
  int OverdueProjects,
  int HighRiskProjects,
  double AverageHealthScore,
  decimal TotalBudget,
  decimal TotalActualCost,
  List<ProjectSummaryDto> RecentProjects,
  List<ProjectSummaryDto> AtRiskProjects,
  List<ProjectSummaryDto> RecentProjectPreviews,
  // Names behind each segment of the "Project Overview" donut, so hovering a segment can
  // list the projects it counts. Bucketed with exactly the same predicates as the counts
  // above (New = neither InProgress nor Completed, Pending = InProgress, Done = Completed),
  // so the tooltip can never disagree with the number printed on the chart.
  //
  // Defaulted to empty rather than required: these are additive API fields, and an older
  // caller that does not know about them should still get a valid payload - the chart
  // simply has no names to show until a caller populates them.
  ProjectNameBucket? NewProjects = null,
  ProjectNameBucket? PendingProjects = null,
  ProjectNameBucket? DoneProjects = null
);

/// <summary>
/// A named slice of the overview chart: the projects themselves plus how many exist in
/// total, so the UI can list the first <c>Projects.Count</c> and say how many were omitted.
/// </summary>
public record ProjectNameBucket(IReadOnlyList<ProjectSummaryDto> Projects, int TotalCount);
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

        const int bucketLimit = 25;

        ProjectNameBucket Bucket(
        IEnumerable<PMWDS.Domain.Entities.Project> source)
        {
        var bucket = source
        .OrderByDescending(p => p.CreatedDate)
        .Take(bucketLimit)
        .Select(p => ProjectSummaryDto.FromEntity(p))
        .ToList();
        return new ProjectNameBucket(bucket, bucket.Count);
        }

        return new ProjectDashboardDto(
        TotalProjects: list.Count,
        ActiveProjects: list.Count(p =>
        p.Status == ProjectStatus.InProgress),
        CompletedProjects: list.Count(p =>
        p.Status == ProjectStatus.Completed),
        OnHoldProjects: list.Count(p =>
        p.Status == ProjectStatus.OnHold),
        DelayedProjects: list.Count(p =>
        p.Status == ProjectStatus.Delayed || p.GetDelayDays() > 0),
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
        .ToList(),
        RecentProjectPreviews: list
        .OrderByDescending(p => p.CreatedDate)
        .Take(10)
        .Select(p => ProjectSummaryDto.FromEntity(p))
        .ToList(),
        // Same buckets the controller endpoint uses, so hovering a donut segment lists
        // the same projects whichever handler serves the request.
        NewProjects: Bucket(
        list.Where(p =>
        p.Status != ProjectStatus.InProgress &&
        p.Status != ProjectStatus.Completed)),
        PendingProjects: Bucket(
        list.Where(p => p.Status == ProjectStatus.InProgress)),
        DoneProjects: Bucket(
        list.Where(p => p.Status == ProjectStatus.Completed))
        );
    }
}
