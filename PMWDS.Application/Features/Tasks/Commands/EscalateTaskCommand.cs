using MediatR;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
namespace PMWDS.Application.Features.Tasks.Commands;

public record EscalateTaskCommand(
 Guid TaskId) : IRequest<bool>;
public class EscalateTaskCommandHandler
 : IRequestHandler<EscalateTaskCommand, bool>
{
    private readonly IUnitOfWork _uow;
    private readonly INotificationService _notifications;
    public EscalateTaskCommandHandler(
    IUnitOfWork uow,
    INotificationService notifications)
    {
        _uow = uow;
        _notifications = notifications;
    }
    public async Task<bool> Handle(
    EscalateTaskCommand request,
    CancellationToken ct)
    {
        var task = await _uow.Tasks
        .GetWithDetailsAsync(request.TaskId, ct)
        ?? throw new NotFoundException(
        nameof(ProjectTask), request.TaskId);
        task.Escalate();
        await _uow.SaveChangesAsync(ct);
        try
        {
            await _notifications.SendEscalationAlertAsync(
            task.Id, task.EscalationLevel, ct);
        }
        catch
        {
            // Email sending failed (e.g., SMTP not configured in dev)
            // Don't fail the escalation, just log and continue
        }
        return true;
    }
}