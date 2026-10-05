import { useMemo } from "react";
import type { Milestone, MilestoneDependency, Project, Task, User } from "../../../types";
import { formatDate } from "../../../lib/formatters";
import { ModalOverlay, getStatusColor } from "../../shared";
import { TaskCard } from "./TaskCard";

interface MilestoneDetailModalProps {
  open: boolean;
  milestone: Milestone | null;
  tasks: Task[];
  project?: Project | null;
  users: User[];
  onClose: () => void;
  onComplete: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  dependencies?: MilestoneDependency[];
  allMilestones?: Milestone[];
}

export function MilestoneDetailModal({
  open,
  milestone,
  tasks,
  project,
  onClose,
  onComplete,
  onStatusChange,
  onEdit,
  onDelete,
  isAdmin,
  dependencies,
  allMilestones,
}: MilestoneDetailModalProps) {
  const milestoneTasks = useMemo(
    () => (milestone ? tasks.filter((t) => t.milestoneId === milestone.id && !t.parentTaskId) : []),
    [milestone, tasks]
  );

  if (!open || !milestone) return null;

  const statusColors = getStatusColor(milestone.status);
  const progress = milestone.progressPercentage || 0;
  const hasTasks = milestone.hasTasks ?? milestoneTasks.length > 0;
  const completedTasks = milestoneTasks.filter((t) => t.status === "Completed").length;
  const isCompleted = milestone.status === "Completed";

  return (
    <ModalOverlay onClose={onClose} widthClassName="max-w-3xl">
      <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
        <div className="p-6 space-y-6">
          {/* Milestone Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md shrink-0 ${
                  milestone.isCritical ? "bg-red-500 shadow-red-500/25" : "bg-indigo-600 shadow-indigo-500/25"
                }`}
              >
                <span className="material-symbols-outlined text-2xl text-white">
                  {milestone.status === "Completed" ? "check_circle" : "flag"}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">{milestone.name}</h2>
                {project && <p className="text-xs text-slate-500 mt-0.5">{project.name}</p>}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && (
                <>
                  <button
                    onClick={onEdit}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit milestone"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button
                    onClick={onDelete}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete milestone"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status, badges, description */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${statusColors.bg} ${statusColors.text}`}
            >
              {milestone.status}
            </span>
            {milestone.isCritical && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase bg-red-50 text-red-600">
                Critical
              </span>
            )}
          </div>

          {milestone.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{milestone.description}</p>
          )}

          {/* Info chips */}
          <div className="flex flex-wrap gap-3">
            <Chip icon="calendar_today" label="Due" value={milestone.dueDate ? formatDate(milestone.dueDate) : "Not set"} />
            <Chip icon="task_alt" label="Tasks" value={`${completedTasks}/${milestoneTasks.length} completed`} />
            {/* {milestone.order ? <Chip icon="format_list_numbered" label="Order" value={`#${milestone.order}`} /> : null} */}
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-medium">
                Progress
                {hasTasks && <span className="ml-1 text-indigo-500">(avg of tasks)</span>}
              </span>
              <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCompleted
                    ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                    : milestone.isCritical
                    ? "bg-gradient-to-r from-red-400 to-red-500"
                    : "bg-gradient-to-r from-indigo-400 to-indigo-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Status Actions */}
          {isAdmin && (
            <div className="space-y-2">
              {hasTasks && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Progress is auto-calculated from associated tasks. 
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {["Pending", "InProgress", "Completed", "Delayed"].map((status) => {
                  const st = getStatusColor(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={milestone.status === status}
                      onClick={() => (status === "Completed" ? onComplete() : onStatusChange(status))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        milestone.status === status
                          ? `${st.bg} ${st.text} cursor-default shadow-sm`
                          : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dependencies Section */}
          {dependencies && dependencies.length > 0 && (
            <>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">
                  {milestone.isBlocked ? "🔒" : "✓"} Dependencies
                  {milestone.isBlocked && (
                    <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Blocked</span>
                  )}
                </h3>
                {milestone.blockedByMessage && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">warning</span>
                    <span>{milestone.blockedByMessage}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {dependencies.map((dep) => {
                    const prereqName = dep.prerequisiteMilestoneName || allMilestones?.find((m) => m.id === dep.prerequisiteMilestoneId)?.name || "Unknown";
                    const depName = dep.dependentMilestoneName || allMilestones?.find((m) => m.id === dep.dependentMilestoneId)?.name || "Unknown";
                    return (
                      <div key={dep.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                          dep.isMet ? "bg-emerald-100" : "bg-amber-100"
                        }`}>
                          <span className={`material-symbols-outlined text-sm ${
                            dep.isMet ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            {dep.isMet ? "check_circle" : "block"}
                          </span>
                        </div>
                        <div className="text-xs flex-1">
                          <span className="font-medium text-slate-700">{prereqName}</span>
                          <span className="material-symbols-outlined text-sm text-slate-400 mx-1">arrow_forward</span>
                          <span className="font-medium text-slate-700">{depName}</span>
                          <span className="ml-2 text-[10px] text-slate-400">
                            {dep.type === "CompletionBased" ? "(must complete)" : `(reach ${dep.thresholdPercentage}%)`}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          dep.isMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {dep.isMet ? "Met" : "Unmet"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-slate-100" />
            </>
          )}

          {/* Tasks Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Tasks</h3>
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {milestoneTasks.length}
              </span>
            </div>

            {milestoneTasks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {milestoneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={isAdmin}
                    onViewTask={undefined}
                    onEditTask={undefined}
                    getProgressColor={(p) => {
                      if (p === 100) return "bg-emerald-500";
                      if (p >= 75) return "bg-amber-400";
                      if (p >= 50) return "bg-cyan-400";
                      if (p >= 25) return "bg-rose-400";
                      return "bg-slate-300";
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-2xl text-slate-400">task</span>
                </div>
                <p className="text-xs text-slate-400">No tasks yet for this milestone.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

function Chip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-xs">
      <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
