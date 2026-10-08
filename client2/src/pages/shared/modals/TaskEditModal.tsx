import { useState, type ReactNode } from "react";
import { FiAlertTriangle, FiCalendar, FiFlag, FiNavigation, FiTrash2 } from "react-icons/fi";
import type { Milestone, Project, Task, User } from "../../../types";
import { Modal, ModalCancelButton, ModalPrimaryButton, useToast, AvatarStack, PriorityBadge } from "..";
import { StatusBadgeMinimal } from "../../shared/StatusBadgeMinimal";
import { ProgressStatusEditor } from "../../project/components/ProgressStatusEditor";
import { priorities } from "../../constants";
import { formatDate } from "../../../lib/formatters";
import { Icon } from "../../../components/ui/Icon";

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
  onRefresh,
}: TaskEditModalProps) {
  const { addToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editProgress, setEditProgress] = useState(Math.round(task.progressPercentage || 0));
  const [editStatus, setEditStatus] = useState(task.status);
  const [editPriority, setEditPriority] = useState(task.priority || "Medium");
  const [commentText, setCommentText] = useState("");

  const subtaskCount = task.subTasks?.length ?? 0;
  const entityType = task.parentTaskId ? "subtask" : "task";

  const assignedUsers =
    task.assignees && task.assignees.length > 0
      ? task.assignees.map((a) => ({ id: a.userId, fullName: a.fullName ?? undefined }))
      : task.assignedToUserId
        ? [{ id: task.assignedToUserId, fullName: task.assignedToUserName ?? undefined }]
        : [];
  const assignedUsersResolved = assignedUsers.map((u) => {
    const matched = users.find((usr) => usr.id === u.id);
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

  const hasChanges =
    editProgress !== Math.round(task.progressPercentage || 0) ||
    editStatus !== task.status ||
    editPriority !== (task.priority || "Medium") ||
    commentText.trim().length > 0;

  const headerAccent =
    editStatus === "Completed" ? "success" : editStatus === "InProgress" ? "info" : "neutral";

  // Build the meta info shown under the title as inline spans (the Modal
  // wraps `description` in a <p>, so we keep this strictly inline).
  const dateText = task.startDate && task.dueDate
    ? `${formatDate(task.startDate)} - ${formatDate(task.dueDate)}`
    : task.startDate
      ? formatDate(task.startDate)
      : task.dueDate
        ? formatDate(task.dueDate)
        : "";

  const descriptionNode: ReactNode = (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <FiNavigation className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate font-medium">{project?.name || task.projectName || "N/A"}</span>
      </span>
      {(milestone?.name || task.milestoneName) && (
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <FiFlag className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate font-medium">{milestone?.name || task.milestoneName}</span>
        </span>
      )}
      {dateText && (
        <span className="inline-flex items-center gap-1.5">
          <FiCalendar className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-medium whitespace-nowrap">{dateText}</span>
        </span>
      )}
    </span>
  );

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={task.title}
      description={descriptionNode}
      icon="check-circle"
      accent={headerAccent}
      size="lg"
      footer={
        mayEdit ? (
          <>
            <div className="flex-1 flex items-center gap-1.5">
              {onEscalate && (
                <button
                  type="button"
                  onClick={onEscalate}
                  title="Escalate task"
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    task.isEscalated
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                  }`}
                >
                  <FiAlertTriangle className="w-3.5 h-3.5" />
                  {task.isEscalated ? "Escalated" : "Escalate"}
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete task"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
                ) : (
                  <FiTrash2 className="w-3.5 h-3.5" />
                )}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
            <ModalCancelButton onClick={onClose} />
            <ModalPrimaryButton
              onClick={handleUpdate}
              loading={isUpdating}
              disabled={!hasChanges}
              label={isUpdating ? "Updating..." : "Update"}
              icon="check-circle"
            />
          </>
        ) : (
          <ModalCancelButton onClick={onClose} label="Close" />
        )
      }
    >
      <div className="space-y-4">
        {/* Status + priority + flags */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadgeMinimal status={editStatus} />
          <PriorityBadge priority={editPriority} />
          {task.isOverdue && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
              Overdue
            </span>
          )}
          {subtaskCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
              {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
        )}

        {/* Assigned users */}
        {assignedUsersResolved.length > 0 && (
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <AvatarStack people={assignedUsersResolved} size="xs" />
            <span className="text-xs text-slate-600 font-medium truncate max-w-[14rem]">
              {assignedUsersResolved.map((u, i) => (
                <span key={u.id} className={u.isActive === false ? "text-red-500" : ""}>
                  {i > 0 ? ", " : ""}
                  {u.fullName}
                </span>
              ))}
            </span>
          </div>
        )}

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
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">
              Progress is auto-calculated from subtasks and cannot be edited directly.
            </p>
          </div>
        )}

        {mayEdit && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Priority
            </label>
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}

        {mayEdit && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Icon name="info" size={12} />
              Comment
            </label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment with this update..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
          </div>
        )}

        {!mayEdit && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
            You don't have permission to edit this task.
          </div>
        )}
      </div>
    </Modal>
  );
}
