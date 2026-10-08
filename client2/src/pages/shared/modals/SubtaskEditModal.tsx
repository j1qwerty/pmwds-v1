import { useState } from "react";
import { FiCalendar, FiFlag, FiTrash2 } from "react-icons/fi";
import type { Task } from "../../../types";
import { Modal, ModalCancelButton, ModalPrimaryButton, useToast } from "..";
import { ProgressStatusEditor } from "../../project/components/ProgressStatusEditor";
import { priorities } from "../../constants";
import { Icon } from "../../../components/ui/Icon";

interface SubtaskEditModalProps {
  subtask: Task;
  mayEdit: boolean;
  onClose: () => void;
  onUpdate: (subtaskId: string, data: { progress: number; status: string; priority: string }) => Promise<void>;
  onAddComment: (subtaskId: string, text: string) => Promise<void>;
  onDelete: (subtaskId: string) => Promise<void>;
}

export function SubtaskEditModal({
  subtask,
  mayEdit,
  onClose,
  onUpdate,
  onAddComment,
  onDelete,
}: SubtaskEditModalProps) {
  const { addToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editProgress, setEditProgress] = useState(subtask.progressPercentage || 0);
  const [editStatus, setEditStatus] = useState(subtask.status);
  const [selectedPriority, setSelectedPriority] = useState(subtask.priority || "Medium");
  const [commentText, setCommentText] = useState("");

  const handleDelete = async () => {
    if (!confirm(`Delete subtask "${subtask.title}"?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(subtask.id);
      addToast("Subtask deleted.");
      onClose();
    } catch {
      setIsDeleting(false);
      addToast("Failed to delete subtask.");
    }
  };

  const handleUpdate = async () => {
    if (!mayEdit) return;
    setIsUpdating(true);
    try {
      await onUpdate(subtask.id, {
        progress: editProgress,
        status: editStatus,
        priority: selectedPriority,
      });
      if (commentText.trim()) {
        await onAddComment(subtask.id, commentText.trim());
      }
      addToast("Subtask updated.");
      onClose();
    } catch {
      addToast("Failed to update subtask.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProgressStatusChange = (data: { progress: number; status: string }) => {
    setEditProgress(data.progress);
    setEditStatus(data.status);
  };

  const hasChanges =
    editProgress !== (subtask.progressPercentage || 0) ||
    editStatus !== subtask.status ||
    selectedPriority !== (subtask.priority || "Medium") ||
    commentText.trim().length > 0;

  const headerAccent =
    editStatus === "Completed" ? "success" : editStatus === "InProgress" ? "info" : "neutral";

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={subtask.title}
      description="Subtask"
      icon="check-circle"
      accent={headerAccent}
      size="md"
      footer={
        mayEdit ? (
          <>
            <div className="flex-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete subtask"
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
        {/* Quick info row: due date + priority */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {subtask.dueDate && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Due <strong className="text-slate-700">{new Date(subtask.dueDate).toLocaleDateString()}</strong>
              </span>
            </div>
          )}
          {subtask.priority && (
            <div className="inline-flex items-center gap-1.5">
              <FiFlag className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</span>
              {mayEdit ? (
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-semibold text-slate-700">{selectedPriority}</span>
              )}
            </div>
          )}
        </div>

        {mayEdit && (
          <ProgressStatusEditor
            progress={editProgress}
            status={editStatus}
            mayEdit={mayEdit}
            onChange={handleProgressStatusChange}
            entityType="subtask"
          />
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
            You don't have permission to edit this subtask.
          </div>
        )}
      </div>
    </Modal>
  );
}
