import { useState } from "react";
import { priorities } from "../../constants";
import { GlassCard, Avatar, EmptyState } from "../../shared";
import { getPriorityColor } from "../../shared/colors";
import type { User } from "../../../types";
import { Icon } from "../../../components/ui/Icon";

interface MilestoneEntry {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  isCritical: boolean;
}

interface TaskEntry {
  id: string;
  title: string;
  description: string;
  priority: string;
  milestoneId: string;
  assignedToUserIds: string[];
  estimatedHours: number;
  startDate: string;
  dueDate: string;
}

interface TasksStepProps {
  milestones: MilestoneEntry[];
  tasks: TaskEntry[];
  onChange: (tasks: TaskEntry[]) => void;
  users: User[];
}

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

const LABEL_CLASS =
  "text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5";

export function TasksStep({ milestones, tasks, onChange, users }: TasksStepProps) {
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "Medium",
    assignedToUserIds: [] as string[],
    estimatedHours: 8,
    startDate: new Date().toISOString().split("T")[0],
    dueDate: "",
  });

  const getMilestoneDueDate = (milestoneId: string) => {
    const ms = milestones.find((m) => m.id === milestoneId);
    return ms?.dueDate || "";
  };

  const resetForm = (defaultDueDate = "") => {
    setForm({ title: "", description: "", priority: "Medium", assignedToUserIds: [], estimatedHours: 8, startDate: new Date().toISOString().split("T")[0], dueDate: defaultDueDate });
    setShowFormForMilestone(null);
    setEditTaskId(null);
  };

  const handleSave = () => {
    if (!form.title.trim() || !showFormForMilestone) return;
    if (editTaskId) {
      const updated = tasks.map((t) =>
        t.id === editTaskId ? { ...t, ...form, milestoneId: showFormForMilestone } : t
      );
      onChange(updated);
    } else {
      onChange([
        ...tasks,
        {
          ...form,
          id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          milestoneId: showFormForMilestone,
        },
      ]);
    }
    resetForm();
  };

  const handleEdit = (task: TaskEntry) => {
    setEditTaskId(task.id);
    setShowFormForMilestone(task.milestoneId);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assignedToUserIds: task.assignedToUserIds,
      estimatedHours: task.estimatedHours,
      startDate: task.startDate,
      dueDate: task.dueDate,
    });
  };

  const handleDelete = (id: string) => {
    onChange(tasks.filter((t) => t.id !== id));
  };

  const toggleAssignee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedToUserIds: prev.assignedToUserIds.includes(userId)
        ? prev.assignedToUserIds.filter((id) => id !== userId)
        : [...prev.assignedToUserIds, userId],
    }));
  };

  const activeFormMilestone = showFormForMilestone;
  const activeMilestoneTasks = (milestoneId: string) => tasks.filter((t) => t.milestoneId === milestoneId);

  if (milestones.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          icon="task_alt"
          title="Add milestones first"
          description="Go back to the Milestones step to create milestones before adding tasks."
          accent="warning"
        />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {milestones.map((ms) => {
        const msTasks = activeMilestoneTasks(ms.id);
        const isFormOpen = activeFormMilestone === ms.id;

        return (
          <div key={ms.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Milestone header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                ms.isCritical ? "bg-red-50" : "bg-indigo-50"
              }`}>
                <Icon name="flag" size={15} className={ms.isCritical ? "text-red-500" : "text-indigo-600"} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800">{ms.name}</span>
                {ms.description && (
                  <span className="text-xs text-slate-400 ml-2 truncate">{ms.description}</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">{msTasks.length} task{msTasks.length !== 1 ? "s" : ""}</span>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm(getMilestoneDueDate(ms.id));
                    setShowFormForMilestone(ms.id);
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                >
                  <Icon name="add" size={14} />
                  Task
                </button>
              )}
            </div>

            {/* Tasks list */}
            {msTasks.length > 0 && (
              <div className="divide-y divide-slate-100">
                {msTasks.map((task) => {
                  const pColor = getPriorityColor(task.priority);
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 transition-colors group">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${pColor.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-700">{task.title}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                            {task.priority}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.description && (
                            <span className="text-xs text-slate-400 truncate max-w-60">{task.description}</span>
                          )}
                          {task.estimatedHours > 0 && (
                            <span className="text-[10px] text-slate-400">{task.estimatedHours}h</span>
                          )}
                          {task.startDate && (
                            <span className="text-[10px] text-slate-400">Start: {new Date(task.startDate).toLocaleDateString()}</span>
                          )}
                          {task.dueDate && (
                            <span className="text-[10px] text-slate-400">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {task.assignedToUserIds.length > 0 && (
                          <div className="flex -space-x-1 mr-2">
                            {task.assignedToUserIds.slice(0, 3).map((uid) => {
                              const u = users.find((user) => user.id === uid);
                              return u ? <Avatar key={uid} person={u} size="xs" className="ring-2 ring-white" /> : null;
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEdit(task)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit task"
                          aria-label={`Edit task: ${task.title}`}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remove task"
                          aria-label={`Remove task: ${task.title}`}
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {msTasks.length === 0 && !isFormOpen && (
              <div className="px-4 py-5 text-center text-slate-400">
                <p className="text-xs">No tasks yet. Click "Task" to add one.</p>
              </div>
            )}

            {/* Add/Edit task form */}
            {isFormOpen && (
              <div className="p-3 bg-indigo-50/30 border-t border-indigo-100 space-y-3">
                <div>
                  <label className={LABEL_CLASS}>Title <span className="text-red-500">*</span></label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Task title"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                    className={`${INPUT_CLASS} min-h-[64px] py-2 resize-y`}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Start date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Due date</label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className={INPUT_CLASS}
                    />
                    {form.dueDate && showFormForMilestone && (() => {
                      const msDue = getMilestoneDueDate(showFormForMilestone);
                      return msDue && form.dueDate > msDue ? (
                        <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          <Icon name="warning" size={16} className="shrink-0 mt-0.5" />
                          <span>Due date exceeds milestone due date ({new Date(msDue).toLocaleDateString()})</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Est. hours</label>
                    <input
                      type="number"
                      value={form.estimatedHours}
                      onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })}
                      min={0}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Assignees</label>
                  <div className="flex flex-wrap gap-1.5">
                    {users.filter(u => u.isActive !== false).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAssignee(u.id)}
                        aria-pressed={form.assignedToUserIds.includes(u.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          form.assignedToUserIds.includes(u.id)
                            ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                        }`}
                      >
                        <Avatar person={u} size="xs" />
                        {u.fullName}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-indigo-100">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!form.title.trim()}
                    className="inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editTaskId ? "Update task" : "Add task"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
