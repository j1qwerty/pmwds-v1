using MediatR;
using PMWDS.Application.DTOs.Tasks;
using PMWDS.Application.Exceptions;
using PMWDS.Application.Interfaces.Services;
namespace PMWDS.Application.Features.Tasks.Commands;

public record UpdateTaskProgressCommand(
 Guid Id,
 UpdateTaskProgressDto Dto) : IRequest<TaskDto>;
public class UpdateTaskProgressCommandHandler
 : IRequestHandler<UpdateTaskProgressCommand, TaskDto>
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    public UpdateTaskProgressCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser)
    {
        _uow = uow;
        _currentUser = currentUser;
    }
    public async Task<TaskDto> Handle(
    UpdateTaskProgressCommand req,
    CancellationToken ct)
    {
        var task = await _uow.Tasks
        .GetWithDetailsAsync(req.Id, ct)
        ?? throw new NotFoundException(
        "Task", req.Id);

        if (task.HasSubTasks && task.ParentTaskId == null)
        {
            throw new ConflictException(
            "Task progress is derived from its subtasks and cannot be updated manually. Update the progress of each subtask instead.");
        }

        task.UpdateProgress(
        req.Dto.ProgressPercentage,
        req.Dto.Notes);
        task.SetModified(
        _currentUser.UserId ?? "system");
        await _uow.SaveChangesAsync(ct);

        if (req.Dto.ProgressPercentage >= 100)
        {
            task.Complete();
            await _uow.SaveChangesAsync(ct);
        }

        if (task.ParentTaskId.HasValue)
        {
            var parent = await _uow.Tasks
                .GetWithDetailsAsync(task.ParentTaskId.Value, ct);
            if (parent != null)
            {
                parent.RecalculateProgressFromSubtasks();
                if (parent.ProgressPercentage >= 100)
                {
                    parent.MarkSubtaskCompleted();
                }
                parent.SetModified(_currentUser.UserId ?? "system");
                await _uow.SaveChangesAsync(ct);
            }
        }

        var refreshed = await _uow.Tasks.GetWithDetailsAsync(req.Id, ct);
        return TaskDto.FromEntity(refreshed ?? task);
    }
}
