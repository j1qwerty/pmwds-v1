import { useState } from "react";
import { FiMessageSquare, FiTrash2, FiCheck, FiCalendar, FiFlag, FiSave } from "react-icons/fi";
import type { Task } from "../../../types";
import { ModalOverlay, useToast } from "..";
import { ProgressStatusEditor } from "../../project/components/ProgressStatusEditor";
import { priorities } from "../../constants";

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

  return (
    <ModalOverlay onClose={onClose} showCloseButton={true}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 mx-auto" style={{ width: "auto", maxWidth: "100vw" }}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${editStatus === "Completed"
                  ? "bg-emerald-100 text-emerald-600"
                  : editStatus === "InProgress"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-slate-100 text-slate-500"
                }`}
            >
              <FiCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{subtask.title}</h3>
              <p className="text-[10px] text-slate-400">Subtask</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {mayEdit && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Delete subtask"
                aria-label="Delete subtask"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {subtask.dueDate && (
                <div className="flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Due <strong className="text-slate-700">{new Date(subtask.dueDate).toLocaleDateString()}</strong></span>
                </div>
              )}
              {subtask.priority && (
                <div className="flex items-center gap-1.5">
                  <FiFlag className="w-3.5 h-3.5 text-slate-400" />
                  <span>Priority </span>
                  {mayEdit && (
                    
                      <div>

                        <select
                          value={selectedPriority}
                          onChange={(e) => setSelectedPriority(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300 bg-white"
                        >
                          {priorities.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                   
                  )}
                </div>
              )}
            </div>
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
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <FiMessageSquare className="w-3.5 h-3.5" /> Comment
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
