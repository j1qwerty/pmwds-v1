using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class TimeEntry : BaseEntity
{
    public Guid TaskId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public bool IsBillable { get; private set; }
    public bool IsManualEntry { get; private set; }
    public TimeSpan Duration =>
    EndTime.HasValue
    ? EndTime.Value - StartTime
    : DateTime.UtcNow - StartTime;
    public ProjectTask? Task { get; private set; }
    public ApplicationUser? User { get; private set; }
    protected TimeEntry() { }
    public static TimeEntry StartTimer(
    Guid taskId, Guid userId,
    string description, bool billable = false)
    {
        return new TimeEntry
        {
            TaskId = taskId,
            UserId = userId,
            StartTime = DateTime.UtcNow,
            Description = description,
            IsBillable = billable,
            IsManualEntry = false
        };
    }
    public static TimeEntry ManualEntry(
    Guid taskId, Guid userId,
    DateTime start, DateTime end,
    string description, bool billable = false)
    {
        if (end <= start)
            throw new InvalidOperationException(
            "End time must be after start time.");
        return new TimeEntry
        {
            TaskId = taskId,
            UserId = userId,
            StartTime = start,
            EndTime = end,
            Description = description,
            IsBillable = billable,
            IsManualEntry = true
        };
    }
    public void StopTimer()
    {
        if (EndTime.HasValue)
            throw new InvalidOperationException(
            "Timer already stopped.");
        EndTime = DateTime.UtcNow;
    }
}
