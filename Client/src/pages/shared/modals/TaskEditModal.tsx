import { useState } from "react";
import { FiAlertTriangle, FiClock, FiCalendar, FiFlag, FiNavigation, FiTrash2, FiSave } from "react-icons/fi";
import type { Milestone, Project, Task, User } from "../../../types";
import { ModalOverlay, useToast, AvatarStack, PriorityBadge } from "..";
import { StatusBadgeMinimal } from "../../shared/StatusBadgeMinimal";
import { ProgressStatusEditor } from "../../nested/components/ProgressStatusEditor";
import { InfoChip } from "../../nested/components/InfoChip";
import { priorities } from "../../constants";
import { formatDate } from "../../../ui";

interface TaskEditModalProps {
  task: Task;
  users: User[];
  project?: Project | null;
  milestone?: Milestone | null;
  mayEdit: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, data: { progress: number; status: string; priority: string }) => Promise<void>;
  onAddComment: (taskId: string, text: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onEscalate?: () => void;
  onStartTimer: (taskId: string, description: string) => Promise<void>;
  onRefresh: () => void;
}

export function TaskEditModal({
  task,
  users,
  project,
  milestone,
  mayEdit,
  onClose,
  onUpdate,
  onAddComment,
  onDelete,
  onEscalate,
  onStartTimer,
  onRefresh,
}: TaskEditModalProps) {
  const { addToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editProgress, setEditProgress] = useState(Math.round(task.progressPercentage || 0));
  const [editStatus, setEditStatus] = useState(task.status);
  const [editPriority, setEditPriority] = useState(task.priority || "Medium");
  const [commentText, setCommentText] = useState("");
  const [timerDescription, setTimerDescription] = useState("Focused execution block");

  const subtaskCount = task.subTasks?.length ?? 0;
  const entityType = task.parentTaskId ? "subtask" : "task";

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

  const handleProgressStatusChange = (data: { progress: number; status: string }) => {
    setEditProgress(data.progress);
    setEditStatus(data.status);
  };

  const handleUpdate = async () => {
    if (!mayEdit) return;
    setIsUpdating(true);
    try {
      await onUpdate(task.id, {
        progress: editProgress,
        status: editStatus,
        priority: editPriority,
      });
      if (commentText.trim()) {
        await onAddComment(task.id, commentText.trim());
      }
      addToast("Task updated.");
      onRefresh();
      onClose();
    } catch {
      addToast("Failed to update task.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(task.id);
      addToast("Task deleted.");
      onRefresh();
      onClose();
    } catch {
      setIsDeleting(false);
      addToast("Failed to delete task.");
    }
  };

  const handleStartTimer = () => {
    onStartTimer(task.id, timerDescription);
    addToast("Timer started.");
  };

  const hasChanges =
    editProgress !== Math.round(task.progressPercentage || 0) ||
    editStatus !== task.status ||
    editPriority !== (task.priority || "Medium") ||
    commentText.trim().length > 0;

  return (
    <ModalOverlay onClose={onClose} showCloseButton={true}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 mx-auto" style={{ width: "auto", maxWidth: "100vw" }}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{task.title}</h3>

              <div className="flex items-center gap-3 text-xs flex-wrap py-1">
            {/* Project name - no label */}
            <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
              <FiNavigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-medium">{project?.name || task.projectName || "N/A"}</span>
            </div>

            {/* Milestone name - no label */}
            {(milestone?.name || task.milestoneName) && (
              <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                <FiFlag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate font-medium">{milestone?.name || task.milestoneName}</span>
              </div>
            )}

            {/* Separator dot */}
            {(task.startDate || task.dueDate) && (
              <span className="text-slate-300">•</span>
            )}

            {/* Dates */}
            {task.startDate && task.dueDate ? (
              <div className="flex items-center gap-1.5 text-slate-600">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium whitespace-nowrap">{formatDate(task.startDate)} - {formatDate(task.dueDate)}</span>
              </div>
            ) : task.startDate ? (
              <div className="flex items-center gap-1.5 text-slate-600">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium whitespace-nowrap">{formatDate(task.startDate)}</span>
              </div>
            ) : task.dueDate ? (
              <div className="flex items-center gap-1.5 text-slate-600">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium whitespace-nowrap">{formatDate(task.dueDate)}</span>
              </div>
            ) : null}
          </div>
            {task.description && (
              <p className="text-sm text-slate-500 py-1">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <StatusBadgeMinimal status={editStatus} />
              <PriorityBadge priority={editPriority} />
              {task.isOverdue && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-600">Overdue</span>
              )}
              {subtaskCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600">
                  {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {mayEdit && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {onEscalate && (
                <button
                  onClick={onEscalate}
                  className={`p-2 rounded-lg transition-colors ${
                    task.isEscalated
                      ? 'bg-amber-50 text-amber-600'
                      : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                  title="Escalate task"
                  aria-label="Escalate task"
                >
                  <FiAlertTriangle className="w-4 h-4 pointer-events-none" />
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Delete task"
                aria-label="Delete task"
              >
                <FiTrash2 className="w-4 h-4 pointer-events-none" />
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 border-b border-slate-100 ">

          {assignedUsersResolved.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs w-fit">
              <AvatarStack people={assignedUsersResolved} size="xs" />
              <span className="text-slate-600 font-medium truncate max-w-50">
                {assignedUsersResolved.map((u, i) => (
                  <span key={u.id} className={u.isActive === false ? "text-red-500" : ""}>{i > 0 ? ", " : ""}{u.fullName}</span>
                ))}
              </span>
            </div>
          )}

        </div>
        <div className="p-5 space-y-4">

          {mayEdit && subtaskCount === 0 && (
            <ProgressStatusEditor
              progress={editProgress}
              status={editStatus}
              mayEdit={mayEdit}
              onChange={handleProgressStatusChange}
              entityType={entityType}
            />
          )}
          {mayEdit && subtaskCount > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">
                Progress is auto-calculated from subtasks and cannot be edited directly.
              </p>
            </div>
          )}

          {mayEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                  Priority
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300 bg-white"
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <FiClock className="w-3.5 h-3.5" /> Timer
                </label>
                <div className="flex gap-2">
                  <input
                    value={timerDescription}
                    onChange={(e) => setTimerDescription(e.target.value)}
                    placeholder="What are you working on?"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300"
                  />
                  <button
                    onClick={handleStartTimer}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <FiClock className="w-3.5 h-3.5" /> Start
                  </button>
                </div>
              </div>
            </div>
          )}

          {mayEdit && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                Comment
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment with this update..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
              />
            </div>
          )}

          {mayEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating || !hasChanges}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <FiSave className="w-3.5 h-3.5" />
                {isUpdating ? "Updating..." : "Update"}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
