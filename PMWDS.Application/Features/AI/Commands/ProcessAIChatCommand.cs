using MediatR;
using PMWDS.Application.DTOs.AI;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.AI.Commands;
public record ProcessAIChatCommand(
 string Message) : IRequest<ChatResponseDto>;
public class ProcessAIChatCommandHandler
 : IRequestHandler<ProcessAIChatCommand, ChatResponseDto>
{
 private readonly IChatService _ai;
 private readonly ICurrentUserService _currentUser;
 public ProcessAIChatCommandHandler(
 IChatService ai,
 ICurrentUserService currentUser)
 {
 _ai = ai;
 _currentUser = currentUser;
 }
 public async Task<ChatResponseDto> Handle(
 ProcessAIChatCommand req,
 CancellationToken ct)
 {
 var userId = _currentUser.UserId
 ?? throw new UnauthorizedAccessException();
 return await _ai.ProcessChatMessageAsync(
 userId, req.Message, ct: ct);
 }
}
