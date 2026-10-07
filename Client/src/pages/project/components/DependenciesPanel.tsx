import type { Milestone, MilestoneDependency } from "../../../types";

interface DependenciesPanelProps {
  dependencies: MilestoneDependency[];
  milestones: Milestone[];
  canManage: boolean;
  onNew: () => void;
  onEdit: (dep: MilestoneDependency) => void;
  onDelete: (id: string) => void;
}

export function DependenciesPanel({
  dependencies,
  milestones,
  canManage,
  onNew,
  onEdit,
  onDelete,
}: DependenciesPanelProps) {
  const getMilestoneName = (id: string) => milestones.find((m) => m.id === id)?.name || "Unknown";
  const getMilestoneProgress = (id: string) => milestones.find((m) => m.id === id)?.progressPercentage || 0;
  const getMilestoneStatus = (id: string) => milestones.find((m) => m.id === id)?.status || "";

  const metCount = dependencies.filter((d) => d.isMet).length;
  const blockingCount = dependencies.filter((d) => !d.isMet).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Dependencies</h3>
        {canManage && (
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-semibold hover:bg-amber-600 transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-sm">add</span>
            New
          </button>
        )}
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-center">
          <p className="text-[9px] font-semibold text-slate-400 uppercase">{dependencies.length}</p>
          <p className="text-[10px] font-bold text-indigo-600">Total</p>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2 text-center">
          <p className="text-[9px] font-semibold text-slate-400 uppercase">{metCount}</p>
          <p className="text-[10px] font-bold text-emerald-600">Met</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-2 text-center">
          <p className="text-[9px] font-semibold text-slate-400 uppercase">{blockingCount}</p>
          <p className="text-[10px] font-bold text-amber-600">Blocking</p>
        </div>
      </div>

      {/* Dependency list */}
      <div className="space-y-1.5  overflow-y-auto custom-scrollbar">
        {dependencies.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <span className="material-symbols-outlined text-2xl mb-1 block">account_tree</span>
            <p className="text-[10px] text-slate-500">No dependencies</p>
            {canManage && (
              <p className="text-[9px] text-slate-400 mt-0.5">Click New to add one</p>
            )}
          </div>
        )}

        {dependencies.map((dep) => {
          const prereqProgress = getMilestoneProgress(dep.prerequisiteMilestoneId);
          const prereqStatus = getMilestoneStatus(dep.prerequisiteMilestoneId);
          return (
            <div
              key={dep.id}
              className={`p-2 rounded-lg border ${
                dep.isMet ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"
              }`}
            >
              <div className="flex items-start gap-1.5">
                <span className={`material-symbols-outlined text-sm mt-0.5 ${
                  dep.isMet ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {dep.isMet ? "check_circle" : "block"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-slate-700 truncate leading-tight">
                    {getMilestoneName(dep.prerequisiteMilestoneId)}
                  </p>
                  <p className="text-[9px] text-slate-400">blocks</p>
                  <p className="text-[10px] font-medium text-slate-700 truncate leading-tight">
                    {getMilestoneName(dep.dependentMilestoneId)}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {dep.type === "CompletionBased" ? (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                        prereqStatus === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        Must complete{prereqStatus === "Completed" ? " ✓" : ""}
                      </span>
                    ) : (
                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                        prereqProgress >= (dep.thresholdPercentage || 0) ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {prereqProgress}% / {dep.thresholdPercentage}%
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(dep)}
                      className="p-0.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      title="Edit"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(dep.id)}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
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
