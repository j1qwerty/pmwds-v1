import { useState } from "react";
import { GlassCard, EmptyState } from "../../shared";
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

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

const LABEL_CLASS =
  "text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5";

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
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        At least one milestone is required <span className="text-red-500">*</span>
      </p>

      {/* Existing milestones */}
      {milestones.length > 0 && (
        <div className="space-y-2">
          {milestones.map((m, idx) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.isCritical ? "bg-red-50" : "bg-indigo-50"
              }`}>
                <Icon name="flag" size={16} className={m.isCritical ? "text-red-500" : "text-indigo-600"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">{m.name}</span>
                  {m.isCritical && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100 uppercase">Critical</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  {m.description && <span className="truncate max-w-60">{m.description}</span>}
                  {m.dueDate && <span>Due: {new Date(m.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => handleEdit(idx)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit milestone"
                  aria-label={`Edit milestone: ${m.name}`}
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove milestone"
                  aria-label={`Remove milestone: ${m.name}`}
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
        <GlassCard>
          <EmptyState
            icon="flag"
            title="No milestones yet"
            description="Break your project into key milestones to track progress. At least one milestone is required."
          />
        </GlassCard>
      )}

      {/* Add milestone form */}
      {showForm ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Name <span className="text-red-500">*</span></label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Milestone name"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Due date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={INPUT_CLASS}
              />
              {form.dueDate && projectEndDate && form.dueDate > projectEndDate && (
                <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <Icon name="warning" size={16} className="shrink-0 mt-0.5" />
                  <span>Due date exceeds project end date ({new Date(projectEndDate).toLocaleDateString()})</span>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What marks this milestone?"
                rows={2}
                className={`${INPUT_CLASS} min-h-[64px] py-2 resize-y`}
              />
            </div>
            <div className="md:col-span-2 flex items-center">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isCritical}
                  onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Critical milestone
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-indigo-100">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.name.trim() || !form.dueDate.trim()}
              className="inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editIdx !== null ? "Update milestone" : "Add milestone"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all w-full justify-center"
        >
          <Icon name="add" size={16} />
          Add milestone
        </button>
      )}
    </div>
  );
}
