import { useMemo } from "react";
import type { Milestone, MilestoneDependency, Project, Task, User } from "../../../types";
import { formatDate } from "../../../lib/formatters";
import { Modal, ModalCancelButton, ModalDangerButton, getStatusColor } from "../../shared/index";
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
    <Modal
      open={open}
      onClose={onClose}
      title={milestone.name}
      description={project?.name}
      icon={isCompleted ? "check_circle" : "flag"}
      accent={isCompleted ? "success" : "primary"}
      size="lg"
      footer={
        <>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Edit
              </button>
              <ModalDangerButton onClick={onDelete} label="Delete" />
            </>
          )}
          <ModalCancelButton onClick={onClose} label="Close" />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Status + critical badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${statusColors.bg} ${statusColors.text}`}
          >
            {milestone.status}
          </span>
          {milestone.isCritical && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-red-50 text-red-600">
              <span className="material-symbols-outlined text-sm">priority_high</span>
              Critical
            </span>
          )}
          {milestone.isBlocked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase bg-amber-50 text-amber-700">
              <span className="material-symbols-outlined text-sm">lock</span>
              Blocked
            </span>
          )}
        </div>

        {/* Description */}
        {milestone.description && (
          <p className="text-sm text-slate-600 leading-relaxed">{milestone.description}</p>
        )}

        {/* Info chips */}
        <div className="flex flex-wrap gap-2.5">
          <Chip icon="calendar_today" label="Due" value={milestone.dueDate ? formatDate(milestone.dueDate) : "Not set"} />
          <Chip icon="task_alt" label="Tasks" value={`${completedTasks}/${milestoneTasks.length} completed`} />
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
          <div className="space-y-2.5">
            {hasTasks && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-indigo-500 mt-0.5">info</span>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Progress is auto-calculated from associated tasks.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {["Pending", "InProgress", "Completed", "Delayed"].map((status) => {
                const st = getStatusColor(status);
                const active = milestone.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={active}
                    onClick={() => (status === "Completed" ? onComplete() : onStatusChange(status))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      active
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
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3 mt-3">
              <h3 className="text-sm font-bold text-slate-800">Dependencies</h3>
              {milestone.isBlocked && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Blocked</span>
              )}
            </div>
            {milestone.blockedByMessage && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">warning</span>
                <span>{milestone.blockedByMessage}</span>
              </div>
            )}
            <div className="space-y-2">
              {dependencies.map((dep) => {
                const prereqName = dep.prerequisiteMilestoneName || allMilestones?.find((m) => m.id === dep.prerequisiteMilestoneId)?.name || "Unknown";
                const depName = dep.dependentMilestoneName || allMilestones?.find((m) => m.id === dep.dependentMilestoneId)?.name || "Unknown";
                return (
                  <div key={dep.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                      dep.isMet ? "bg-emerald-100" : "bg-amber-100"
                    }`}>
                      <span className={`material-symbols-outlined text-sm ${
                        dep.isMet ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        {dep.isMet ? "check_circle" : "block"}
                      </span>
                    </div>
                    <div className="text-xs flex-1 min-w-0">
                      <span className="font-medium text-slate-700">{prereqName}</span>
                      <span className="material-symbols-outlined text-sm text-slate-400 mx-1 align-middle">arrow_forward</span>
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
        )}

        {/* Tasks Section */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-4 mt-3">
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
    </Modal>
  );
}

function Chip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
      <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
