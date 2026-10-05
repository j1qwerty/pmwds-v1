import { useState } from "react";
import { FiChevronDown, FiCheck, FiPlus, FiMessageSquare, FiX } from "react-icons/fi";
import type { Task } from "../../../types";
import { StatusBadge } from "../../shared";
import { StatusDropdown } from "../../nested/components/StatusDropdown";
import { SubtaskProgressBar } from "../../nested/components/SubtaskProgressBar";

interface SubtasksSectionProps {
  subtasks: Task[];
  mayEdit: boolean;
  expandedSubtaskIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleCompleted: (id: string, currentlyCompleted: boolean) => void;
  onDelete: (id: string) => void;
  onProgressUpdate: (id: string, value: number) => void;
  onAddComment: (id: string, text: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onCreateSubtask: () => void;
  showSubtaskForm: boolean;
  subtaskForm: { title: string; priority: string; dueDate: string; assignedToUserId: string };
  onSubtaskFormChange: (form: { title: string; priority: string; dueDate: string; assignedToUserId: string }) => void;
  onCancelSubtaskForm: () => void;
  onToggleShowForm: () => void;
  parentTaskDueDate?: string;
}

export function SubtasksSection({
  subtasks,
  mayEdit,
  expandedSubtaskIds,
  onToggleExpand,
  onToggleCompleted,
  onDelete,
  onProgressUpdate,
  onAddComment,
  onStatusChange,
  onCreateSubtask,
  showSubtaskForm,
  subtaskForm,
  onSubtaskFormChange,
  onCancelSubtaskForm,
  onToggleShowForm,
  parentTaskDueDate,
}: SubtasksSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Subtasks</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
            {subtasks.length}
          </span>
        </div>
        <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded && (
        <div className="border-t border-slate-100 px-4 py-2 space-y-2 max-h-64 overflow-y-auto">
          {subtasks.length === 0 && (
            <p className="text-xs text-slate-400 italic py-2">No subtasks yet.</p>
          )}
          {subtasks.map(subtask => {
            const isCompleted = subtask.status === "Completed";
            const isExpanded = expandedSubtaskIds.has(subtask.id);
            return (
              <div key={subtask.id} className="border border-slate-100 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 p-2 bg-slate-50/50 cursor-pointer"
                     onClick={() => onToggleExpand(subtask.id)}>
                  {mayEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCompleted(subtask.id, isCompleted);
                      }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white cursor-pointer"
                          : "bg-white border-slate-300 hover:border-indigo-400 cursor-pointer"
                      }`}
                    >
                      {isCompleted && <FiCheck className="w-3 h-3" />}
                    </button>
                  )}
                  <span className={`text-sm truncate flex-1 ${isCompleted ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {subtask.title}
                  </span>
                  <div className="w-12 h-1 rounded-full bg-slate-200 overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-500"
                      style={{ width: `${subtask.progressPercentage || 0}%` }}
                    />
                  </div>
                  <StatusBadge status={subtask.status} />
                  <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  {mayEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(subtask.id);
                      }}
                      className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-3 py-3 space-y-2 bg-white border-t border-slate-100 max-h-40 overflow-y-auto">
                    {mayEdit && (
                      <SubtaskProgressBar
                        value={subtask.progressPercentage || 0}
                        onChange={(val) => onProgressUpdate(subtask.id, val)}
                      />
                    )}
                    <div className="flex gap-2 items-start">
                      <FiMessageSquare className="w-4 h-4 text-slate-400 mt-1.5" />
                      <div className="flex-1 flex gap-2">
                        <input
                          placeholder="Add a comment..."
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                              onAddComment(subtask.id, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = "";
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = (e.currentTarget.previousSibling as HTMLInputElement);
                            if (input && input.value.trim()) {
                              onAddComment(subtask.id, input.value);
                              input.value = "";
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                    {mayEdit && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</label>
                        <StatusDropdown
                          currentStatus={subtask.status}
                          onChange={(status) => onStatusChange(subtask.id, status)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {mayEdit && (
            showSubtaskForm ? (
              <div className="pt-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={subtaskForm.title}
                    onChange={(e) => onSubtaskFormChange({ ...subtaskForm, title: e.target.value })}
                    placeholder="Subtask title"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300"
                  />
                  <button onClick={onCreateSubtask} disabled={!subtaskForm.title} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
                    Add
                  </button>
                  <button onClick={onCancelSubtaskForm} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 cursor-pointer">
                    Cancel
                  </button>
                </div>
                <div>
                  <input
                    type="date"
                    value={subtaskForm.dueDate}
                    onChange={(e) => onSubtaskFormChange({ ...subtaskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300"
                  />
                  {subtaskForm.dueDate && parentTaskDueDate && subtaskForm.dueDate > parentTaskDueDate.slice(0, 10) && (
                    <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                      <span>Due date exceeds parent task due date ({new Date(parentTaskDueDate).toLocaleDateString()})</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onToggleShowForm}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 cursor-pointer"
              >
                <FiPlus className="w-3.5 h-3.5" /> Add subtask
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
