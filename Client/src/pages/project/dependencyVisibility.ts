import type { Milestone, MilestoneDependency } from "../../types";

/**
 * Label used in place of a milestone the caller is not allowed to see.
 *
 * A team's milestones can depend on milestones owned by another department in
 * the same project. Those milestones are absent from the caller's milestone
 * list (GET /milestones/by-project filters to the caller's departments), but the
 * dependency itself is real and affects them, so the row is kept and the
 * unseeable end is described rather than named.
 */
export const OTHER_DEPARTMENT_LABEL = "Other department";

export type DependencyEnd = {
  /** Milestone name when visible, otherwise OTHER_DEPARTMENT_LABEL. */
  label: string;
  /** False when the milestone is outside the caller's visibility scope. */
  isVisible: boolean;
  milestone?: Milestone;
};

export type ResolvedDependency = {
  dep: MilestoneDependency;
  prerequisite: DependencyEnd;
  dependent: DependencyEnd;
  /** Progress of the prerequisite, or 0 when it isn't visible. */
  prereqProgress: number;
  prereqStatus: string;
  /** Whether the prereq's live progress/status can be read at all. */
  canReadPrereqState: boolean;
  /** Server-computed rule outcome — authoritative even when the prereq is hidden. */
  isRuleSatisfied: boolean;
};

function resolveEnd(milestones: Map<string, Milestone>, id: string): DependencyEnd {
  const milestone = milestones.get(id);
  return milestone
    ? { label: milestone.name, isVisible: true, milestone }
    : { label: OTHER_DEPARTMENT_LABEL, isVisible: false };
}

/**
 * Annotate each dependency with its resolved ends, dropping the ones the caller
 * has no stake in.
 *
 * A dependency is kept when at least one end is visible — that one is the
 * caller's own milestone, so the rule is relevant to them. A dependency with
 * *both* ends hidden sits entirely between two other departments and says
 * nothing actionable about the caller's work, so it is dropped rather than
 * rendered as "Other department → Other department".
 */
export function resolveDependencies(
  dependencies: readonly MilestoneDependency[],
  milestones: readonly Milestone[],
): ResolvedDependency[] {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const resolved: ResolvedDependency[] = [];

  for (const dep of dependencies) {
    const prerequisite = resolveEnd(byId, dep.prerequisiteMilestoneId);
    const dependent = resolveEnd(byId, dep.dependentMilestoneId);

    if (!prerequisite.isVisible && !dependent.isVisible) continue;

    const prereqProgress = prerequisite.milestone?.progressPercentage ?? 0;
    const prereqStatus = prerequisite.milestone?.status ?? "";

    resolved.push({
      dep,
      prerequisite,
      dependent,
      prereqProgress,
      prereqStatus,
      canReadPrereqState: prerequisite.isVisible,
      isRuleSatisfied:
        dep.type === "CompletionBased"
          ? prereqStatus === "Completed"
          : prereqProgress >= (dep.thresholdPercentage ?? 0),
    });
  }

  return resolved;
}
