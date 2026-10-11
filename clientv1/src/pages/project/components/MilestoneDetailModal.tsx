import { useMemo } from "react";
import type { Milestone, MilestoneDependency, Project, Task, User } from "../../../types";
import { useAppData } from "../../../appData";
import { formatDate } from "../../../lib/formatters";
import { Sheet, ModalCancelButton, ModalDangerButton, getStatusColor } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";
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

  // Shared department directory (read-only) — used to resolve the assigned
  // department name when the milestone itself only carries an id.
  const { data: appData } = useAppData();

  if (!open || !milestone) return null;

  const statusColors = getStatusColor(milestone.status);
  const progress = milestone.progressPercentage || 0;
  const hasTasks = milestone.hasTasks ?? milestoneTasks.length > 0;
  const completedTasks = milestoneTasks.filter((t) => t.status === "Completed").length;
  const isCompleted = milestone.status === "Completed";

  // Prefer the milestone's own denormalized name; fall back to the department
  // directory by id. Missing department simply renders no department tile.
  const departmentName =
    milestone.departmentName ||
    appData.departments.find((d) => d.id === milestone.departmentId)?.name ||
    null;

  return (
    <Sheet
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
                <Icon name="edit" size={14} />
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
        {/* Status + flags */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColors.badgeBg} ${statusColors.badgeText} ${statusColors.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
            {milestone.status}
          </span>
          {milestone.isCritical && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
              <Icon name="priority_high" size={12} />
              Critical
            </span>
          )}
          {milestone.isBlocked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              <Icon name="lock" size={12} />
              Blocked
            </span>
          )}
        </div>

        {/* Description */}
        {milestone.description && (
          <p className="text-sm text-slate-600 leading-relaxed">{milestone.description}</p>
        )}

        {/* Meta grid — gains a third DEPARTMENT tile when one is assigned */}
        <div className={`grid grid-cols-1 gap-3 ${departmentName ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/70 bg-slate-50/60">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Icon name="calendar" size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Due date</p>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {milestone.dueDate ? formatDate(milestone.dueDate) : "Not set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/70 bg-slate-50/60">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Icon name="task_alt" size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tasks</p>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {completedTasks}/{milestoneTasks.length} completed
              </p>
            </div>
          </div>
          {departmentName && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/70 bg-slate-50/60 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Icon name="apartment" size={15} className="text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Department</p>
                <p className="text-sm font-semibold text-slate-800 truncate" title={departmentName}>
                  {departmentName}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar (fill follows the milestone status color) */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">
              Progress
              {hasTasks && <span className="ml-1 text-indigo-500">(avg of tasks)</span>}
            </span>
            <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${statusColors.dot}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status actions */}
        {isAdmin && (
          <div className="space-y-2.5">
            {hasTasks && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-start gap-2">
                <Icon name="info" size={14} className="text-indigo-500 mt-0.5 shrink-0" />
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      active
                        ? `${st.bg} ${st.text} ${st.border} cursor-default shadow-sm`
                        : "border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? st.dot : "bg-slate-300"}`} />
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dependencies section */}
        {dependencies && dependencies.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="link" size={15} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">Dependencies</h3>
              {milestone.isBlocked && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Blocked</span>
              )}
            </div>
            {milestone.blockedByMessage && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-3 flex items-start gap-2">
                <Icon name="warning" size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <span>{milestone.blockedByMessage}</span>
              </div>
            )}
            <div className="space-y-2">
              {dependencies.map((dep) => {
                const prereqName = dep.prerequisiteMilestoneName || allMilestones?.find((m) => m.id === dep.prerequisiteMilestoneId)?.name || "Unknown";
                const depName = dep.dependentMilestoneName || allMilestones?.find((m) => m.id === dep.dependentMilestoneId)?.name || "Unknown";
                return (
                  <div key={dep.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      dep.isMet ? "bg-emerald-50" : "bg-amber-50"
                    }`}>
                      <Icon
                        name={dep.isMet ? "check_circle" : "block"}
                        size={14}
                        className={dep.isMet ? "text-emerald-600" : "text-amber-600"}
                      />
                    </div>
                    <div className="text-xs flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-semibold text-slate-700">{prereqName}</span>
                        <Icon name="arrow_forward" size={12} className="text-slate-400" />
                        <span className="font-semibold text-slate-700">{depName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {dep.type === "CompletionBased" ? "Must complete" : `Reach ${dep.thresholdPercentage}%`}
                      </span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      dep.isMet ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      {dep.isMet ? "Met" : "Unmet"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks section */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="task_alt" size={15} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Tasks</h3>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
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
                    if (p >= 50) return "bg-sky-400";
                    if (p >= 25) return "bg-red-400";
                    return "bg-slate-300";
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Icon name="task_alt" size={22} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-400">No tasks yet for this milestone.</p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
