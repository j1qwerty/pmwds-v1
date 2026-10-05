import type { Milestone, Project, Task, User } from "../../../types";
import { formatDate } from "../../../lib/formatters";
import { GlassCard, GradientButton, getStatusColor } from "../../shared/index";
import { TaskCard } from "./TaskCard";
import { Icon } from "../../../components/ui/Icon";

interface MilestoneDetailProps {
  milestone: Milestone;
  tasks: Task[];
  project?: Project | null;
  users: User[];
  onComplete: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  isAdmin: boolean;
}

const progressStrokeConfig: Record<string, string> = {
  Completed: "stroke-emerald-500",
  InProgress: "stroke-blue-500",
  Delayed: "stroke-amber-500",
  OnHold: "stroke-purple-500",
  Cancelled: "stroke-slate-400",
  Pending: "stroke-slate-400",
  NotStarted: "stroke-slate-400",
};

function getProgressStroke(status: string, isCritical: boolean): string {
  if (isCritical && status !== "Completed") return "stroke-red-500";
  return progressStrokeConfig[status] || "stroke-indigo-500";
}

export function MilestoneDetailk({ 
  milestone, 
  tasks, 
  project, 
  onComplete, 
  onStatusChange,
  onEdit, 
  onDelete,
  onAddTask,
  isAdmin 
}: MilestoneDetailProps) {
  const statusColors = getStatusColor(milestone.status);
  const progress = milestone.progressPercentage || 0;
  const hasTasks = milestone.hasTasks ?? tasks.length > 0;
  const completedTasks = tasks.filter(t => t.status === "Completed").length;

  return (
    <div className="space-y-4">
      {/* Single GlassCard with everything */}
      <GlassCard className="p-6">
        {/* Milestone Header Block */}
        <div className="mb-6 pb-6 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 ${
                milestone.isCritical ? "bg-red-500 shadow-red-500/25" : "bg-indigo-600 shadow-indigo-500/25"
              }`}>
                <span className="material-symbols-outlined text-xl text-white">
                  {milestone.status === "Completed" ? "check_circle" : "flag"}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">{milestone.name}</h3>
                {project && (
                  <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className="truncate">{project.name}</span>
                  </span>
                )}
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit milestone"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete milestone"
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Status & Critical badges + Description */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${statusColors.bg} ${statusColors.text}`}>
              {milestone.status}
            </span>
            {milestone.isCritical && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-50 text-red-600">
                Critical
              </span>
            )}
          </div>

          {milestone.description && (
            <p className="text-xs text-slate-600 mb-3 line-clamp-2">{milestone.description}</p>
          )}

          {/* Circular Progress + Info Row */}
          <div className="flex items-center gap-6 mb-4">
            <div className="relative size-24 flex items-center justify-center flex-shrink-0">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
                <circle
                  className={`transition-all duration-700 ${getProgressStroke(milestone.status, milestone.isCritical ?? false)}`}
                  cx="18" cy="18" fill="none" r="16"
                  strokeDasharray="100"
                  strokeDashoffset={100 - Math.min(progress, 100)}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <span className="absolute text-lg font-bold text-slate-800">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="calendar_today" size={14} className="text-slate-400" />
                <span>{milestone.dueDate ? formatDate(milestone.dueDate) : "No due date"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="task_alt" size={14} className="text-slate-400" />
                <span>{completedTasks}/{tasks.length} completed</span>
              </div>
              {hasTasks && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-indigo-500 font-normal">Auto-calculated from tasks</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Change & Complete Actions */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              {hasTasks && (
                <div className="w-full mb-1 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] text-indigo-600 leading-relaxed">
                    Progress is auto-calculated from associated tasks. 
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {["Pending", "InProgress", "Completed", "Delayed"].map((status) => {
                  const st = getStatusColor(status);
                  const isActive = milestone.status === status;
                  const hoverMap: Record<string, string> = {
                    Pending: "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600",
                    InProgress: "hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600",
                    Completed: "hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600",
                    Delayed: "hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700",
                  };
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={isActive}
                      onClick={() => status === "Completed" ? onComplete() : onStatusChange(status)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                        isActive
                          ? `${st.bg} ${st.border} ${st.text} cursor-default shadow-sm`
                          : `border-slate-200 text-slate-500 ${hoverMap[status] ?? "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600"}`
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tasks Panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Tasks</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </p>
            </div>
            {isAdmin && (
              <GradientButton variant="ghost" onClick={onAddTask}>
                <Icon name="add" size={16} />
                Add Task
              </GradientButton>
            )}
          </div>

          {tasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={!!isAdmin}
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
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl text-slate-400">task</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">No tasks yet</h4>
              <p className="text-xs text-slate-400 mb-4">Tasks for this milestone will appear here.</p>
              {isAdmin && (
                <GradientButton variant="ghost" onClick={onAddTask}>
                  <Icon name="add" />
                  Create First Task
                </GradientButton>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
