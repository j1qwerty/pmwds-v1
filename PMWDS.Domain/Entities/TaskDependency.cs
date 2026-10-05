using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
namespace PMWDS.Domain.Entities;

public class TaskDependency : BaseEntity
{
    public Guid PredecessorTaskId { get; private set; }
    public Guid SuccessorTaskId { get; private set; }
    public DependencyType Type { get; private set; }
    public int LagDays { get; private set; }
    public ProjectTask? PredecessorTask { get; private set; }
    public ProjectTask? SuccessorTask { get; private set; }
    protected TaskDependency() { }
    public static TaskDependency Create(
    Guid predecessorId, Guid successorId,
    DependencyType type = DependencyType.FinishToStart,
    int lagDays = 0)
    {
        if (predecessorId == successorId)
            throw new InvalidOperationException(
            "Task cannot depend on itself.");
        return new TaskDependency
        {
            PredecessorTaskId = predecessorId,
            SuccessorTaskId = successorId,
            Type = type,
            LagDays = lagDays
        };
    }
    public void UpdateLag(int newLagDays)
    => LagDays = newLagDays;
    public void UpdateType(DependencyType newType)
    => Type = newType;
}