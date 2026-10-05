using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
namespace PMWDS.Domain.Entities;

public class MilestoneDependency : AuditableEntity
{
    public Guid ProjectId { get; private set; }
    public Guid PrerequisiteMilestoneId { get; private set; }
    public Guid DependentMilestoneId { get; private set; }
    public MilestoneDependencyType Type { get; private set; }
    public double? ThresholdPercentage { get; private set; }

    public Project? Project { get; private set; }
    public Milestone? PrerequisiteMilestone { get; private set; }
    public Milestone? DependentMilestone { get; private set; }

    protected MilestoneDependency() { }

    public static MilestoneDependency Create(
        Guid projectId,
        Guid prerequisiteMilestoneId,
        Guid dependentMilestoneId,
        MilestoneDependencyType type,
        double? thresholdPercentage = null)
    {
        return new MilestoneDependency
        {
            ProjectId = projectId,
            PrerequisiteMilestoneId = prerequisiteMilestoneId,
            DependentMilestoneId = dependentMilestoneId,
            Type = type,
            ThresholdPercentage = type == MilestoneDependencyType.ProgressThreshold
                ? Math.Clamp(thresholdPercentage ?? 0, 0, 100)
                : null
        };
    }

    public void Update(MilestoneDependencyType type, double? thresholdPercentage = null)
    {
        Type = type;
        ThresholdPercentage = type == MilestoneDependencyType.ProgressThreshold
            ? Math.Clamp(thresholdPercentage ?? 0, 0, 100)
            : null;
    }

    public bool IsMet(Milestone prerequisite)
    {
        return Type switch
        {
            MilestoneDependencyType.CompletionBased => prerequisite.Status == MilestoneStatus.Completed,
            MilestoneDependencyType.ProgressThreshold => prerequisite.ProgressPercentage >= (ThresholdPercentage ?? 0),
            _ => false
        };
    }
}
