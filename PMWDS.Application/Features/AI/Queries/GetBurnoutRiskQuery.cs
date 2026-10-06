using MediatR;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;

namespace PMWDS.Application.Features.AI.Queries;

public record GetBurnoutRiskQuery(Guid? DepartmentId) : IRequest<List<BurnoutRiskDto>>;

public class GetBurnoutRiskQueryHandler : IRequestHandler<GetBurnoutRiskQuery, List<BurnoutRiskDto>>
{
    private readonly IUnitOfWork _uow;

    public GetBurnoutRiskQueryHandler(IUnitOfWork uow)
        => _uow = uow;

    public async Task<List<BurnoutRiskDto>> Handle(
        GetBurnoutRiskQuery req,
        CancellationToken ct)
    {
        var users = req.DepartmentId.HasValue
            ? await _uow.Users.GetByDepartmentAsync(req.DepartmentId.Value, ct)
            : await _uow.Users.GetAllAsync(ct);

        var liveWorkload = await _uow.Users.GetLiveWorkloadAsync(req.DepartmentId, ct);

        return users
            .Select(user =>
            {
                var metrics = liveWorkload.GetValueOrDefault(user.Id, (0, 0, 0d));
                var capacityHours = Math.Max(20d, 40d * Math.Clamp(user.AvailabilityPercentage / 100d, 0.1d, 1d));
                var taskPressure = Math.Clamp(metrics.ActiveTasks / 8d, 0d, 1d);
                var hourPressure = Math.Clamp(metrics.EstimatedHours / capacityHours, 0d, 1d);
                var overduePressure = metrics.ActiveTasks == 0
                    ? 0d
                    : Math.Clamp(metrics.OverdueTasks / (double)metrics.ActiveTasks, 0d, 1d);
                var availabilityPressure = 1d - Math.Clamp(user.AvailabilityPercentage / 100d, 0d, 1d);

                var workloadScore = Math.Round(
                    Math.Clamp(taskPressure * 35d + hourPressure * 50d + overduePressure * 15d, 0d, 100d),
                    1);

                var burnoutRisk = Math.Round(
                    Math.Clamp(
                        workloadScore / 100d * 0.65d +
                        overduePressure * 0.2d +
                        availabilityPressure * 0.15d,
                        0d,
                        1d),
                    4);

                return new BurnoutRiskDto(
                    UserId: user.Id.ToString(),
                    FullName: user.FullName,
                    BurnoutRisk: burnoutRisk,
                    WorkloadScore: workloadScore,
                    ActiveTasks: metrics.ActiveTasks,
                    RiskLevel: burnoutRisk switch
                    {
                        >= 0.8 => "Critical",
                        >= 0.6 => "High",
                        >= 0.4 => "Medium",
                        _ => "Low"
                    },
                    Recommendations: GetRecommendations(burnoutRisk));
            })
            .OrderByDescending(record => record.BurnoutRisk)
            .ToList();
    }

    private static List<string> GetRecommendations(double burnoutRisk)
        => burnoutRisk switch
        {
            >= 0.8 => new()
            {
                "Immediately rebalance tasks.",
                "Review current availability before adding work.",
                "Schedule a workload check-in."
            },
            >= 0.6 => new()
            {
                "Reduce active task load where possible.",
                "Avoid new assignments until pressure falls.",
                "Review overdue work."
            },
            >= 0.4 => new()
            {
                "Monitor workload closely.",
                "Prioritize overdue work before new assignments."
            },
            _ => new()
            {
                "Continue standard workload monitoring."
            }
        };
}
