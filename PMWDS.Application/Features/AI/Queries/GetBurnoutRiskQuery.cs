using MediatR;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.AI.Queries;
public record GetBurnoutRiskQuery(
 Guid? DepartmentId)
 : IRequest<List<BurnoutRiskDto>>;
public class GetBurnoutRiskQueryHandler
 : IRequestHandler<
 GetBurnoutRiskQuery,
 List<BurnoutRiskDto>>
{
 private readonly IUnitOfWork _uow;
 public GetBurnoutRiskQueryHandler(IUnitOfWork uow)
 => _uow = uow;
 public async Task<List<BurnoutRiskDto>> Handle(
 GetBurnoutRiskQuery req,
 CancellationToken ct)
 {
 var users = req.DepartmentId.HasValue
 ? await _uow.Users.GetByDepartmentAsync(
 req.DepartmentId.Value, ct)
 : await _uow.Users.GetAllAsync(ct);
 return users
 .OrderByDescending(u =>
 u.AIBurnoutRiskScore)
 .Select(u => new BurnoutRiskDto(
 UserId: u.Id.ToString(),
 FullName: u.FullName,
 BurnoutRisk: u.AIBurnoutRiskScore,
 WorkloadScore: u.AIWorkloadScore,
 ActiveTasks: u.GetActiveTaskCount(),
 RiskLevel: u.AIBurnoutRiskScore switch
 {
 >= 0.8 => "Critical",
 >= 0.6 => "High",
 >= 0.4 => "Medium",
 _ => "Low"
 },
 Recommendations:
 GetRecommendations(u.AIBurnoutRiskScore)
  ))
 .ToList();
 }
 private static List<string> GetRecommendations(
 double burnoutRisk)
 => burnoutRisk switch
 {
 >= 0.8 => new()
 {
 "Immediately reassign tasks.",
 "Schedule mandatory rest period.",
 "HR intervention recommended."
 },
 >= 0.6 => new()
 {
 "Reduce task load by 30%.",
 "No new task assignments.",
 "Weekly check-in required."
 },
 >= 0.4 => new()
 {
 "Monitor workload closely.",
 "Avoid overtime assignments."
 },
 _ => new()
 {
 "Continue standard monitoring."
 }
 };
}
