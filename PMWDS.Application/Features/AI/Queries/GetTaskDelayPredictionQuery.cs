using MediatR;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.AI.Queries;
public record GetTaskDelayPredictionQuery(
 Guid TaskId) : IRequest<DelayPredictionDto>;
public class GetTaskDelayPredictionQueryHandler
 : IRequestHandler<
 GetTaskDelayPredictionQuery,
 DelayPredictionDto>
{
 private readonly IPredictionService _ai;
 private readonly IUnitOfWork _uow;
 public GetTaskDelayPredictionQueryHandler(
 IPredictionService ai,
 IUnitOfWork uow)
 {
 _ai = ai;
 _uow = uow;
 }
 public async Task<DelayPredictionDto> Handle(
 GetTaskDelayPredictionQuery req,
 CancellationToken ct)
 {
 _ = await _uow.Tasks
 .GetByIdAsync(req.TaskId, ct)
 ?? throw new NotFoundException(
 "Task", req.TaskId);


 return await _ai.PredictTaskDelayAsync(
 req.TaskId, ct);
 }
}
