import { useState } from "react";
import type { Milestone, MilestoneDependency } from "../../../types";
import { useToast, EmptyState, SectionCard } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";
import { DependencyFormModal } from "./DependencyFormModal";

interface MilestoneDependencyPanelProps {
  dependencies: MilestoneDependency[];
  milestones: Milestone[];
  projectId: string;
  canManage: boolean;
  onAdd: (payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function MilestoneDependencyPanel({
  dependencies,
  milestones,
  canManage,
  onAdd,
  onUpdate,
  onDelete,
}: MilestoneDependencyPanelProps) {
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editDep, setEditDep] = useState<MilestoneDependency | null>(null);
  const [filter, setFilter] = useState<"all" | "met" | "blocking">("all");

  const getMilestoneName = (id: string) => milestones.find((m) => m.id === id)?.name || "Unknown";
  const getMilestoneStatus = (id: string) => milestones.find((m) => m.id === id)?.status || "";
  const getMilestoneProgress = (id: string) => milestones.find((m) => m.id === id)?.progressPercentage || 0;

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete dependency", "error");
    }
  };

  const metCount = dependencies.filter((d) => d.isMet).length;
  const blockingCount = dependencies.filter((d) => !d.isMet).length;

  const filteredDeps = dependencies.filter((d) => {
    if (filter === "met") return d.isMet;
    if (filter === "blocking") return !d.isMet;
    return true;
  });

  return (
    <>
      <SectionCard
        title="Milestone Dependencies"
        description="Manage which milestones block others from starting"
        icon="account_tree"
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => { setEditDep(null); setModalOpen(true); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm shadow-amber-500/20 transition-all"
            >
              <Icon name="add" size={14} />
              New Dependency
            </button>
          ) : undefined
        }
      >
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <StatBox label="Total" value={dependencies.length} color="indigo" icon="link" />
          <StatBox label="Met" value={metCount} color="emerald" icon="check_circle" />
          <StatBox label="Blocking" value={blockingCount} color="rose" icon="block" />
        </div>

        {/* Filter chips */}
        {dependencies.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            {(["all", "met", "blocking"] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all ${
                    active
                      ? f === "met"
                        ? "bg-emerald-600 text-white"
                        : f === "blocking"
                          ? "bg-rose-600 text-white"
                          : "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
            title={dependencies.length === 0 ? "No dependencies defined" : "No dependencies match this filter"}
            description={
              dependencies.length === 0
                ? "Add dependencies to control milestone execution order."
                : "Try a different filter to see more dependencies."
            }
            compact
            accent="warning"
          />
        ) : (
          <div className="space-y-2">
            {filteredDeps.map((dep) => {
              const prereqProgress = getMilestoneProgress(dep.prerequisiteMilestoneId);
              const prereqStatus = getMilestoneStatus(dep.prerequisiteMilestoneId);
              const prereqMet =
                dep.type === "CompletionBased"
                  ? prereqStatus === "Completed"
                  : prereqProgress >= (dep.thresholdPercentage || 0);

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
                      <span className={`text-sm font-semibold ${
                        dep.isMet ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"
                      }`}>
                        {getMilestoneName(dep.prerequisiteMilestoneId)}
                      </span>
                      <Icon name="arrow_forward" size={13} className="text-slate-400" />
                      <span className={`text-sm font-semibold ${
                        dep.isMet ? "text-slate-800" : "text-rose-600"
                      }`}>
                        {getMilestoneName(dep.dependentMilestoneId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {dep.type === "CompletionBased" ? (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prereqMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          <Icon name={prereqMet ? "task_alt" : "schedule"} size={11} />
                          Must complete
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prereqMet ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          <Icon name="percent" size={10} />
                          {prereqProgress}% / {dep.thresholdPercentage}%
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => { setEditDep(dep); setModalOpen(true); }}
                        className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Edit"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dep.id)}
                        className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Icon name="delete" size={14} />
                      </button>
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
    rose: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
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
