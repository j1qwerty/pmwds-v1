import { useState } from "react";
import { GlassCard } from "../../shared";
import { Icon } from "../../../components/ui/Icon";

interface MilestoneEntry {
  id: string;
  departmentId?: string;
  name: string;
  description: string;
  dueDate: string;
  isCritical: boolean;
}

interface MilestonesStepProps {
  milestones: MilestoneEntry[];
  onChange: (milestones: MilestoneEntry[]) => void;
  projectEndDate: string;
}

export function MilestonesStep({ milestones, onChange, projectEndDate }: MilestonesStepProps) {
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", dueDate: "", isCritical: false });

  const resetForm = () => {
    setForm({ name: "", description: "", dueDate: projectEndDate, isCritical: false });
    setShowForm(false);
    setEditIdx(null);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.dueDate.trim()) return;
    if (editIdx !== null) {
      const updated = [...milestones];
      updated[editIdx] = { ...updated[editIdx], ...form };
      onChange(updated);
    } else {
      onChange([...milestones, { ...form, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2) }]);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    onChange(milestones.filter((m) => m.id !== id));
  };

  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setForm({
      name: milestones[idx].name,
      description: milestones[idx].description,
      dueDate: milestones[idx].dueDate,
      isCritical: milestones[idx].isCritical,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        At least one milestone is required <span className="text-red-500">*</span>
      </p>

      {/* Existing milestones */}
      {milestones.length > 0 && (
        <div className="space-y-2">
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white/80 hover:border-indigo-200 transition-colors group"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                m.isCritical ? "bg-red-100" : "bg-indigo-100"
              }`}>
                <span className={`material-symbols-outlined text-lg ${
                  m.isCritical ? "text-red-500" : "text-indigo-600"
                }`}>flag</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{m.name}</span>
                  {m.isCritical && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 uppercase">Critical</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  {m.description && <span className="truncate max-w-60">{m.description}</span>}
                  {m.dueDate && <span>Due: {new Date(m.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleEdit(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                  title="Edit milestone"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove milestone"
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {milestones.length === 0 && !showForm && (
        <GlassCard className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-indigo-400">flag</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">No milestones yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Break your project into key milestones to track progress. At least one milestone is required <span className="text-red-500">*</span></p>
        </GlassCard>
      )}

      {/* Add milestone form */}
      {showForm ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name <span className="text-red-500">*</span></label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Milestone name"
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What marks this milestone?"
                rows={2}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Due Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              {form.dueDate && projectEndDate && form.dueDate > projectEndDate && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <Icon name="warning" size={16} className="shrink-0 mt-0.5" />
                  <span>Due date exceeds project end date ({new Date(projectEndDate).toLocaleDateString()})</span>
                </div>
              )}
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isCritical}
                  onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Critical milestone
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-indigo-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.dueDate.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {editIdx !== null ? "Update" : "Add"} Milestone
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all w-full justify-center"
        >
          <Icon name="add" size={16} />
          Add Milestone
        </button>
      )}
    </div>
  );
}
