import { useEffect, useState } from "react";
import type { Milestone, MilestoneDependency } from "../../../types";
import { useToast, EmptyState, SectionCard } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";
import { DependencyFormModal } from "./DependencyFormModal";
import { resolveDependencies, type DependencyEnd } from "../dependencyVisibility";

interface MilestoneDependencyPanelProps {
  dependencies: MilestoneDependency[];
  milestones: Milestone[];
  projectId: string;
  /**
   * New + Edit. Both go through POST/PUT /milestones/dependencies, which the
   * server gates on the Milestones.Edit policy.
   */
  canEdit: boolean;
  /** Row delete goes through DELETE /milestones/dependencies → Milestones.Delete. */
  canDelete: boolean;
  onAdd: (payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  /**
   * Increment to open the "New dependency" form (e.g. from a topbar action).
   * The panel owns the form modal, so parents signal through this counter.
   */
  newRequestKey?: number;
}

export function MilestoneDependencyPanel({
  dependencies,
  milestones,
  canEdit,
  canDelete,
  onAdd,
  onUpdate,
  onDelete,
  newRequestKey = 0,
}: MilestoneDependencyPanelProps) {
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editDep, setEditDep] = useState<MilestoneDependency | null>(null);
  const [filter, setFilter] = useState<"all" | "met" | "blocking">("all");

  // External open requests (topbar "New dependency" action). Guarded so the
  // initial 0 never opens the form on mount.
  useEffect(() => {
    if (newRequestKey > 0) {
      setEditDep(null);
      setModalOpen(true);
    }
  }, [newRequestKey]);

  // Milestones outside the caller's department scope are absent from
  // `milestones`, so resolve each end to a real name or OTHER_DEPARTMENT_LABEL,
  // and drop rows where neither end is theirs.
  const visibleDeps = resolveDependencies(dependencies, milestones);

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete dependency", "error");
    }
  };

  // Counts describe what is on screen, so they must exclude hidden rows.
  const metCount = visibleDeps.filter((d) => d.dep.isMet).length;
  const blockingCount = visibleDeps.length - metCount;

  const filteredDeps = visibleDeps.filter(({ dep }) => {
    if (filter === "met") return dep.isMet;
    if (filter === "blocking") return !dep.isMet;
    return true;
  });

  const hiddenCount = dependencies.length - visibleDeps.length;

  return (
    <>
      <SectionCard
        title="Milestone Dependencies"
        description="Manage which milestones block others from starting"
        icon="account_tree"
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={() => { setEditDep(null); setModalOpen(true); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
            >
              <Icon name="add" size={14} />
              New dependency
            </button>
          ) : undefined
        }
      >
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <StatBox label="Total" value={visibleDeps.length} color="indigo" icon="link" />
          <StatBox label="Met" value={metCount} color="emerald" icon="check_circle" />
          <StatBox label="Blocking" value={blockingCount} color="red" icon="block" />
        </div>

        {/* Filter chips */}
        {visibleDeps.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            {(["all", "met", "blocking"] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                    active
                      ? f === "met"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : f === "blocking"
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {f === "all" && "All"}
                  {f === "met" && "Met"}
                  {f === "blocking" && "Blocking"}
                </button>
              );
            })}
          </div>
        )}

        {/* Dependency list */}
        {filteredDeps.length === 0 ? (
          <EmptyState
            icon="account_tree"
            title={visibleDeps.length === 0 ? "No dependencies defined" : "No dependencies match this filter"}
            description={
              visibleDeps.length === 0
                ? hiddenCount > 0
                  ? `${hiddenCount} ${hiddenCount === 1 ? "dependency sits" : "dependencies sit"} entirely between other departments, so ${hiddenCount === 1 ? "it is" : "they are"} not shown here.`
                  : "Add dependencies to control milestone execution order."
                : "Try a different filter to see more dependencies."
            }
            compact
            accent="warning"
          />
        ) : (
          <div className="space-y-2">
            {filteredDeps.map(({ dep, prerequisite, dependent, prereqProgress, isRuleSatisfied: prereqMet, canReadPrereqState }) => {
              return (
                <div
                  key={dep.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    dep.isMet ? "bg-emerald-50" : "bg-amber-50"
                  }`}>
                    <Icon
                      name={dep.isMet ? "check_circle" : "block"}
                      size={17}
                      className={dep.isMet ? "text-emerald-600" : "text-amber-600"}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <DependencyEndLabel end={prerequisite} strikethrough={dep.isMet} />
                      <Icon name="arrow_forward" size={13} className="text-slate-400" />
                      <DependencyEndLabel end={dependent} strikethrough={false} emphasis />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {dep.type === "CompletionBased" ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prereqMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          <Icon name={prereqMet ? "task_alt" : "schedule"} size={11} />
                          Must complete
                        </span>
                      ) : canReadPrereqState ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prereqMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          <Icon name="analytics" size={10} />
                          {prereqProgress}% / {dep.thresholdPercentage}%
                        </span>
                      ) : (
                        // The prerequisite is outside the caller's scope, so its
                        // real progress is unknown — don't render a fake 0%.
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          <Icon name="analytics" size={10} />
                          Progress threshold {dep.thresholdPercentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setEditDep(dep); setModalOpen(true); }}
                          className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(dep.id)}
                          className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <DependencyFormModal
        open={modalOpen}
        editDep={editDep}
        milestones={milestones}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onClose={() => { setModalOpen(false); setEditDep(null); }}
      />
    </>
  );
}

/**
 * One end of a dependency: the milestone name, or OTHER_DEPARTMENT_LABEL when
 * the milestone sits outside the caller's department scope. The placeholder is
 * styled muted and italic so it never reads like a milestone actually named
 * "Other department".
 */
export function DependencyEndLabel({
  end,
  strikethrough = false,
  emphasis = false,
  className = "text-sm font-semibold",
}: {
  end: DependencyEnd;
  strikethrough?: boolean;
  /** True for the dependent (right-hand) end, which is the one at risk. */
  emphasis?: boolean;
  className?: string;
}) {
  if (!end.isVisible) {
    return (
      <span
        className={`${className} italic text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5`}
        title="Owned by a department you don't have access to"
      >
        {end.label}
      </span>
    );
  }

  return (
    <span
      className={`${className} ${
        emphasis
          ? strikethrough
            ? "text-slate-800"
            : "text-red-600"
          : strikethrough
            ? "text-slate-500 line-through decoration-slate-300"
            : "text-slate-800"
      }`}
    >
      {end.label}
    </span>
  );
}

function StatBox({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3 flex items-center gap-2`}>
      <Icon name={icon} size={16} className={c.text} />
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase">{label}</p>
        <p className={`text-lg font-bold ${c.text} leading-tight`}>{value}</p>
      </div>
    </div>
  );
}
