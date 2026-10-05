import type { RefObject } from "react";
import { motion } from "framer-motion";
import { FiEdit, FiTrash2, FiAlertTriangle, FiCalendar, FiFlag, FiNavigation, FiX } from "react-icons/fi";
import type { Milestone, Project, Task, User } from "../../../types";
import { formatDate } from "../../../ui";
import { AvatarStack } from "../../shared";
import { StatusBadgeMinimal } from "../../shared/StatusBadgeMinimal";
import { PriorityBadge } from "../../shared";
import { StatusDropdown } from "../../nested/components/StatusDropdown";
import { InfoChip } from "../../nested/components/InfoChip";

interface TaskHeaderCardProps {
  task: Task;
  users: User[];
  project?: Project | null;
  milestone?: Milestone | null;
  mayEdit: boolean;
  hasSubTasks: boolean;
  subtaskCount: number;
  progress: number;
  progressColor: string;
  progressBarRef: RefObject<HTMLDivElement | null>;
  onProgressBarClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onProgressBarDrag: (e: React.MouseEvent<HTMLDivElement>) => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onEscalate: () => void;
  onDelete: () => void;
  onClose?: () => void;
  hideCloseButton: boolean;
}

export function TaskHeaderCard({
  task,
  users,
  project,
  milestone,
  mayEdit,
  hasSubTasks,
  subtaskCount,
  progress,
  progressColor,
  progressBarRef,
  onProgressBarClick,
  onProgressBarDrag,
  onStatusChange,
  onEdit,
  onEscalate,
  onDelete,
  onClose,
  hideCloseButton,
}: TaskHeaderCardProps) {
  const assignedUsers = (task.assignees && task.assignees.length > 0)
    ? task.assignees.map(a => ({ id: a.userId, fullName: a.fullName ?? undefined }))
    : (task.assignedToUserId ? [{ id: task.assignedToUserId, fullName: task.assignedToUserName ?? undefined }] : []);
  const assignedUsersResolved = assignedUsers.map(u => {
    const matched = users.find(usr => usr.id === u.id);
    return {
      id: u.id,
      fullName: u.fullName || (matched?.fullName ?? undefined),
      profilePictureUrl: matched?.profilePictureUrl ?? null,
      isActive: matched?.isActive ?? true,
    };
  });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 relative">
      {onClose && !hideCloseButton && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
        >
          <FiX className="w-5 h-5" />
        </button>
      )}

      <div className="flex items-start justify-between mb-3 pr-6">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900">
            {task.title}
            {hasSubTasks && (
              <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600">
                {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <StatusBadgeMinimal status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.isOverdue && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-600 animate-pulse">
                Overdue
              </span>
            )}
          </div>
        </div>
        {mayEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Edit task">
              <FiEdit className="w-4 h-4" />
            </button>
            <button onClick={onEscalate} className="p-2 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 cursor-pointer" title="Escalate">
              <FiAlertTriangle className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer" title="Delete task">
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <InfoChip icon={<FiNavigation className="w-3.5 h-3.5" />} label="Project" value={project?.name || task.projectName || "N/A"} />
        <InfoChip icon={<FiFlag className="w-3.5 h-3.5" />} label="Milestone" value={milestone?.name || "None"} />
        <InfoChip icon={<FiCalendar className="w-3.5 h-3.5" />} label="Due" value={task.dueDate ? formatDate(task.dueDate) : "Not set"} />
        {assignedUsersResolved.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs cursor-default">
            <AvatarStack people={assignedUsersResolved} size="xs" />
            <span className="text-slate-600 font-medium truncate max-w-[120px]">
              {assignedUsersResolved.map((u, i) => (
                <span key={u.id} className={u.isActive === false ? "text-red-500" : ""}>{i > 0 ? ", " : ""}{u.fullName}</span>
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500 font-medium">
            Progress{hasSubTasks && <span className="ml-1 text-indigo-500">(auto)</span>}
          </span>
          <span className="font-bold text-slate-700">{progress}%</span>
        </div>
        <div
          ref={progressBarRef}
          className={`w-full h-2.5 rounded-full bg-slate-100 overflow-hidden relative ${
            !hasSubTasks && mayEdit ? "cursor-pointer group" : "cursor-default"
          }`}
          onClick={onProgressBarClick}
          onMouseDown={onProgressBarDrag}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`h-full rounded-full bg-gradient-to-r ${progressColor}`}
          />
          {!hasSubTasks && mayEdit && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="w-3 h-3 bg-white rounded-full shadow border border-slate-300" />
            </div>
          )}
        </div>
      </div>

      {mayEdit ? (
        <div className="mt-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</label>
          <StatusDropdown currentStatus={task.status} onChange={onStatusChange} />
        </div>
      ) : (
        <div className="mt-2">
          <StatusBadgeMinimal status={task.status} />
        </div>
      )}

      {task.isEscalated && (
        <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs flex items-center gap-2">
          <FiAlertTriangle className="text-red-500 w-4 h-4" />
          <span className="font-semibold text-red-700">Escalated</span>
          <span className="ml-auto text-red-500">Lv.{task.escalationLevel}</span>
        </div>
      )}
    </div>
  );
}
