import { getPriorityColor, usePermission, HoverActions } from "../../shared/index";
import type { Task } from "../../../types";

interface TaskCardProps {
  task: Task;
  canEdit?: boolean;
  permissionEdit?: string;
  onViewTask?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  getProgressColor: (progress: number) => string;
}

export function TaskCard({ task, canEdit, permissionEdit, onViewTask, onEditTask, getProgressColor }: TaskCardProps) {
  const perm = usePermission();
  const mayEdit = canEdit ?? (permissionEdit ? perm.has(permissionEdit) : false);
  const priorityColor = getPriorityColor(task.priority);

  const handleCardOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewTask?.(task);
  };

  return (
    <div className="group bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:shadow-md  hover:border-blue-500 hover:shadow-blue-300 transition-shadow duration-200">
      <div
        className={onViewTask ? "cursor-pointer" : ""}
        onClick={handleCardOpen}
        role={onViewTask ? "button" : undefined}
        tabIndex={onViewTask ? 0 : -1}
        onKeyDown={(e) => {
          if (onViewTask && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onViewTask(task);
          }
        }}
      >
        <h4 className="text-sm font-medium text-slate-700 mb-3 leading-snug">
          {task.title}
        </h4>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 font-medium">Progress</span>
            <span className="text-[10px] font-semibold text-slate-600">
              {task.progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className={`${getProgressColor(task.progressPercentage)} h-1.5 rounded-full transition-all duration-300`}
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border}`}
        >
          {task.priority}
        </span>

        <div className="flex items-center gap-2">
          {/* Secondary actions (view / edit) revealed on card hover — the card
              root carries the `group` class. This card has no delete / add-subtask
              affordance of its own today, so none is invented here. */}
          <HoverActions
            entity="tasks"
            onHover={[
              ...(onViewTask
                ? [{ icon: "view", label: "View task", onClick: () => onViewTask(task) }]
                : []),
              ...(mayEdit && onEditTask
                ? [{ icon: "edit", label: "Edit task", onClick: () => onEditTask(task) }]
                : []),
            ]}
          />

          {task.assignees?.[0] && (
            <div
              className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[9px] font-semibold flex items-center justify-center"
              title={task.assignees[0].fullName ?? "Assignee"}
            >
              {(task.assignees[0].fullName ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
