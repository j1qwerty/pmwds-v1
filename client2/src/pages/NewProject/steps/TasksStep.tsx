import { useState } from "react";
import { priorities } from "../../constants";
import { GlassCard, Avatar } from "../../shared";
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
      <GlassCard className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <Icon name="task_alt" size={24} className="text-amber-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Add milestones first</p>
        <p className="text-xs text-slate-400 mt-1">Go back to the Milestones step to create milestones before adding tasks.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {milestones.map((ms) => {
        const msTasks = activeMilestoneTasks(ms.id);
        const isFormOpen = activeFormMilestone === ms.id;

        return (
          <div key={ms.id} className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
            {/* Milestone header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                ms.isCritical ? "bg-red-100" : "bg-indigo-100"
              }`}>
                <span className={`material-symbols-outlined text-base ${
                  ms.isCritical ? "text-red-500" : "text-indigo-600"
                }`}>flag</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800">{ms.name}</span>
                {ms.description && (
                  <span className="text-xs text-slate-400 ml-2 truncate">{ms.description}</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{msTasks.length} tasks</span>
              {!isFormOpen && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm(getMilestoneDueDate(ms.id));
                    setShowFormForMilestone(ms.id);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Icon name="add" size={15} />
                  Task
                </button>
              )}
            </div>

            {/* Tasks list */}
            {msTasks.length > 0 && (
              <div className="divide-y divide-slate-100">
                {msTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      task.priority === "Critical" ? "bg-red-500" :
                      task.priority === "High" ? "bg-amber-500" :
                      task.priority === "Medium" ? "bg-blue-500" : "bg-slate-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{task.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider
                          ${task.priority === 'Critical' ? 'bg-red-50 text-red-600' :
                            task.priority === 'High' ? 'bg-amber-50 text-amber-600' :
                            task.priority === 'Medium' ? 'bg-blue-50 text-blue-600' :
                            'bg-slate-50 text-slate-500'}`}>
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
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {msTasks.length === 0 && !isFormOpen && (
              <div className="px-4 py-6 text-center text-slate-400">
                <p className="text-xs">No tasks yet. Click "Task" to add one.</p>
              </div>
            )}

            {/* Add/Edit task form */}
            {isFormOpen && (
              <div className="p-4 bg-indigo-50/30 border-t border-indigo-100 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Task title"
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Due Date</label>
                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                    >
                      {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Est. Hours</label>
                    <input
                      type="number"
                      value={form.estimatedHours}
                      onChange={(e) => setForm({ ...form, estimatedHours: Number(e.target.value) })}
                      min={0}
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Assignees</label>
                  <div className="flex flex-wrap gap-1.5">
                    {users.filter(u => u.isActive !== false).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAssignee(u.id)}
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
                <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!form.title.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {editTaskId ? "Update" : "Add"} Task
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
