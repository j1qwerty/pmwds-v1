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
    /// <param name="revealPrerequisiteName">
    /// Pass false when the prerequisite milestone is outside the caller's
    /// department scope. GET /milestones/by-project/{id} withholds those
    /// milestones entirely, so echoing their names on a dependency row would
    /// disclose exactly what that endpoint hides.
    /// </param>
    /// <param name="revealDependentName">Same, for the dependent milestone.</param>
    public static MilestoneDependencyDto FromEntity(
        MilestoneDependency dep,
        bool revealPrerequisiteName = true,
        bool revealDependentName = true)
    {
        var prerequisite = dep.PrerequisiteMilestone;
        var dependent = dep.DependentMilestone;
        return new(
            dep.Id,
            dep.ProjectId,
            dep.PrerequisiteMilestoneId,
            revealPrerequisiteName ? prerequisite?.Name : null,
            dep.DependentMilestoneId,
            revealDependentName ? dependent?.Name : null,
            dep.Type.ToString(),
            dep.ThresholdPercentage,
            dep.IsMet(prerequisite ?? throw new InvalidOperationException("Prerequisite milestone not loaded")));
    }
}
