import { useState } from "react";
import { FiChevronDown, FiCheck, FiPlus, FiMessageSquare } from "react-icons/fi";
import type { Task } from "../../../types";
import { StatusBadge, HoverActions } from "../../shared/index";
import { StatusDropdown } from "./StatusDropdown";
import { SubtaskProgressBar } from "./SubtaskProgressBar";

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
          <FiMessageSquare className="w-4 h-4 text-indigo-600" />
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
              <div key={subtask.id} className="border border-slate-200/70 rounded-lg overflow-hidden hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-2 p-2 bg-slate-50/50 cursor-pointer"
                     onClick={() => onToggleExpand(subtask.id)}>
                  {mayEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCompleted(subtask.id, isCompleted);
                      }}
                      aria-label={isCompleted ? "Mark subtask as not completed" : "Mark subtask as completed"}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
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
                  <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  {mayEdit && (
                    <HoverActions
                      entity="subtasks"
                      className="shrink-0"
                      always={[
                        {
                          icon: "delete",
                          label: `Delete subtask: ${subtask.title}`,
                          tone: "danger",
                          onClick: () => onDelete(subtask.id),
                        },
                      ]}
                    />
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
                      <FiMessageSquare className="w-4 h-4 text-slate-400 mt-2 shrink-0" />
                      <div className="flex-1 flex gap-2">
                        <input
                          placeholder="Add a comment..."
                          className="flex-1 h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
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
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                    {mayEdit && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
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
                    className="flex-1 h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                  <button onClick={onCreateSubtask} disabled={!subtaskForm.title} className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer">
                    Add
                  </button>
                  <button onClick={onCancelSubtaskForm} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
                <div>
                  <input
                    type="date"
                    value={subtaskForm.dueDate}
                    onChange={(e) => onSubtaskFormChange({ ...subtaskForm, dueDate: e.target.value })}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
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
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-1 cursor-pointer transition-colors"
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
