using MediatR;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.AI.Queries;
public record GetAIAssigneeRecommendationQuery(
 Guid TaskId) : IRequest<AssigneeRecommendationDto>;
public class GetAIAssigneeRecommendationQueryHandler
 : IRequestHandler<
 GetAIAssigneeRecommendationQuery,
 AssigneeRecommendationDto>
{
 private readonly IRecommendationService _ai;
 private readonly IUnitOfWork _uow;
 public GetAIAssigneeRecommendationQueryHandler(
 IRecommendationService ai,
 IUnitOfWork uow)
 {
 _ai = ai;
 _uow = uow;
 }
 public async Task<AssigneeRecommendationDto> Handle(
 GetAIAssigneeRecommendationQuery req,
 CancellationToken ct)
 {
 var task = await _uow.Tasks
 .GetByIdAsync(req.TaskId, ct)
 ?? throw new NotFoundException(
 "Task", req.TaskId);
 return await _ai.GetOptimalAssigneeAsync(
 req.TaskId, ct);
 }
}
