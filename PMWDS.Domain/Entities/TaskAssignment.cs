using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class TaskAssignment : BaseEntity
{
    public Guid TaskId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime AssignedAt { get; private set; }
    public DateTime? ReleasedAt { get; private set; }
    public bool IsActive { get; private set; }
    // AI Fields
    public double AIMatchScore { get; private set; }
    public string? AIRationale { get; private set; }
    public bool IsAIRecommended { get; private set; }
    public ProjectTask? Task { get; private set; }
    public ApplicationUser? User { get; private set; }
    protected TaskAssignment() { }
    public static TaskAssignment Create(
    Guid taskId, Guid userId,
    double aiMatchScore = 0,
    string? aiRationale = null,
    bool isAIRecommended = false)
    {
        return new TaskAssignment
        {
            TaskId = taskId,
            UserId = userId,
            AssignedAt = DateTime.UtcNow,
            IsActive = true,
            AIMatchScore = aiMatchScore,
            AIRationale = aiRationale,
            IsAIRecommended = isAIRecommended
        };
    }
    public void Release()
    {
        IsActive = false;
        ReleasedAt = DateTime.UtcNow;
    }
}
