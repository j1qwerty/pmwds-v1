using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;
namespace PMWDS.Application.DTOs.Projects;

public record MilestoneDependencyDto(
    Guid Id,
    Guid ProjectId,
    Guid PrerequisiteMilestoneId,
    string? PrerequisiteMilestoneName,
    Guid DependentMilestoneId,
    string? DependentMilestoneName,
    string Type,
    double? ThresholdPercentage,
    bool IsMet)
{
    public static MilestoneDependencyDto FromEntity(MilestoneDependency dep)
    {
        var prerequisite = dep.PrerequisiteMilestone;
        var dependent = dep.DependentMilestone;
        return new(
            dep.Id,
            dep.ProjectId,
            dep.PrerequisiteMilestoneId,
            prerequisite?.Name,
            dep.DependentMilestoneId,
            dependent?.Name,
            dep.Type.ToString(),
            dep.ThresholdPercentage,
            dep.IsMet(prerequisite ?? throw new InvalidOperationException("Prerequisite milestone not loaded")));
    }
}
