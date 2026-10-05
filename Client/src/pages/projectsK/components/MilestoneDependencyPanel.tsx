import { useState } from "react";
import type { Milestone, MilestoneDependency } from "../../../types";
import { GlassCard, useToast } from "../../shared";
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

  return (
    <>
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Milestone Dependencies</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage which milestones block others from starting
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => { setEditDep(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label="Total" value={dependencies.length} color="indigo" />
        <StatBox label="Met" value={dependencies.filter((d) => d.isMet).length} color="emerald" />
        <StatBox label="Blocking" value={dependencies.filter((d) => !d.isMet).length} color="rose" />
      </div>

      {/* Dependency list */}
      <div className="space-y-2">
        {dependencies.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">account_tree</span>
            <p className="text-sm font-medium text-slate-500">No dependencies defined</p>
            <p className="text-xs mt-1">Add dependencies to control milestone execution order</p>
          </div>
        )}

        {dependencies.map((dep) => {
          const prereqProgress = getMilestoneProgress(dep.prerequisiteMilestoneId);
          const prereqStatus = getMilestoneStatus(dep.prerequisiteMilestoneId);
          return (
            <div
              key={dep.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                dep.isMet ? "bg-emerald-100" : "bg-amber-100"
              }`}>
                <span className={`material-symbols-outlined text-base ${
                  dep.isMet ? "text-emerald-600" : "text-amber-600"
                }`}>
                  {dep.isMet ? "check_circle" : "block"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm font-semibold ${dep.isMet ? "text-slate-500" : "text-slate-800"}`}>
                    {getMilestoneName(dep.prerequisiteMilestoneId)}
                  </span>
                  <span className="material-symbols-outlined text-sm text-slate-400">arrow_forward</span>
                  <span className={`text-sm font-semibold ${dep.isMet ? "text-slate-800" : "text-red-600"}`}>
                    {getMilestoneName(dep.dependentMilestoneId)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {dep.type === "CompletionBased" ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      prereqStatus === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      Must complete{prereqStatus === "Completed" ? " ✓" : ""}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      prereqProgress >= (dep.thresholdPercentage || 0) ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {prereqProgress}% / {dep.thresholdPercentage}% threshold
                    </span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditDep(dep); setModalOpen(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                    title="Edit"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(dep.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </GlassCard>
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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
    rose: { bg: "bg-rose-50", text: "text-rose-600" },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`rounded-lg border ${c.bg} p-3 text-center`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase">{label}</p>
      <p className={`text-lg font-bold ${c.text}`}>{value}</p>
    </div>
  );
}
