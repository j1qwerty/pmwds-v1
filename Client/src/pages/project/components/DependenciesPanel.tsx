import type { Milestone, MilestoneDependency } from "../../../types";
import { getStatusColor } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";
import { resolveDependencies } from "../dependencyVisibility";
import { DependencyEndLabel } from "./MilestoneDependencyPanel";

interface DependenciesPanelProps {
  dependencies: MilestoneDependency[];
  milestones: Milestone[];
  /** New + Edit → POST/PUT /milestones/dependencies → Milestones.Edit. */
  canEdit: boolean;
  /** Delete → DELETE /milestones/dependencies → Milestones.Delete. */
  canDelete: boolean;
  onNew: () => void;
  onEdit: (dep: MilestoneDependency) => void;
  onDelete: (id: string) => void;
}

/**
 * Compact, scannable dependency panel used beside the milestone board.
 * Rows read "prerequisite → dependent" with a met/unmet badge, the rule
 * type, and inline edit/remove actions for users who can manage rules.
 */
export function DependenciesPanel({
  dependencies,
  milestones,
  canEdit,
  canDelete,
  onNew,
  onEdit,
  onDelete,
}: DependenciesPanelProps) {
  // Same resolution as MilestoneDependencyPanel: name the caller's own ends,
  // mark the rest as other-department, drop rows where neither end is theirs.
  const visibleDeps = resolveDependencies(dependencies, milestones);

  const metCount = visibleDeps.filter((d) => d.dep.isMet).length;
  const blockingCount = visibleDeps.length - metCount;
  const hiddenCount = dependencies.length - visibleDeps.length;

  return (
    <div className="bg-white/97  border border-slate-200/60 rounded-2xl shadow-sm p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon name="account_tree" size={14} className="text-indigo-600" />
          </div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate">Dependencies</h3>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all shrink-0"
          >
            <Icon name="add" size={12} />
            New
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">
          {visibleDeps.length} total
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {metCount} met
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {blockingCount} blocking
        </span>
      </div>

      {/* Dependency list */}
      <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
        {visibleDeps.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <Icon name="account_tree" size={22} className="mx-auto mb-1.5" />
            <p className="text-[10px] text-slate-500">
              {hiddenCount > 0 ? "No dependencies for your department" : "No dependencies"}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {hiddenCount > 0
                ? `${hiddenCount} ${hiddenCount === 1 ? "dependency sits" : "dependencies sit"} entirely between other departments.`
                : canEdit
                  ? "Click New to add one"
                  : "Nothing to show here."}
            </p>
          </div>
        )}

        {visibleDeps.map(({ dep, prerequisite, dependent, prereqProgress, isRuleSatisfied: ruleSatisfied, canReadPrereqState }) => {
          const prereqStatusColor = getStatusColor(
            prerequisite.milestone?.status ?? "",
          );

          return (
            <div
              key={dep.id}
              className={`group p-2 rounded-lg border transition-all ${
                dep.isMet
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-amber-200 bg-amber-50/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-1.5">
                {/* From → to */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${prereqStatusColor.dot}`}
                      title={
                        prerequisite.isVisible
                          ? `Prerequisite status: ${prerequisite.milestone?.status}`
                          : "Prerequisite status unknown — other department"
                      }
                    />
                    <DependencyEndLabel end={prerequisite} className="text-[10px]" />
                    <Icon name="arrow_forward" size={10} className="text-slate-400 shrink-0" />
                    <DependencyEndLabel end={dependent} className="text-[10px]" />
                  </div>

                  {/* Rule chips */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {dep.type === "CompletionBased" ? (
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          ruleSatisfied ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        Must complete{ruleSatisfied ? " ✓" : ""}
                      </span>
                    ) : canReadPrereqState ? (
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          ruleSatisfied ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {prereqProgress}% / {dep.thresholdPercentage}%
                      </span>
                    ) : (
                      // Prerequisite is out of scope, so its progress is unknown —
                      // don't render a misleading 0%.
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        Threshold {dep.thresholdPercentage}%
                      </span>
                    )}
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        dep.isMet ? "bg-emerald-100 text-emerald-700" : "bg-white text-amber-700 border border-amber-200"
                      }`}
                    >
                      {dep.isMet ? "Met" : "Blocking"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(dep)}
                        className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                        title={`Edit dependency for ${dependent.label}`}
                        aria-label={`Edit dependency for ${dependent.label}`}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(dep.id)}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete dependency"
                        aria-label="Delete dependency"
                      >
                        <Icon name="delete" size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
