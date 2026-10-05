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

interface DependencyEntry {
  id: string;
  prerequisiteMilestoneId: string;
  dependentMilestoneId: string;
  type: "CompletionBased" | "ProgressThreshold";
  thresholdPercentage: number;
}

interface DependenciesStepProps {
  milestones: MilestoneEntry[];
  dependencies: DependencyEntry[];
  onChange: (dependencies: DependencyEntry[]) => void;
}

export function DependenciesStep({ milestones, dependencies, onChange }: DependenciesStepProps) {
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState({
    prerequisiteMilestoneId: "",
    dependentMilestoneId: "",
    type: "CompletionBased" as "CompletionBased" | "ProgressThreshold",
    thresholdPercentage: 50,
  });
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setForm({ prerequisiteMilestoneId: "", dependentMilestoneId: "", type: "CompletionBased", thresholdPercentage: 50 });
    setShowForm(false);
    setEditIdx(null);
    setFormError("");
  };

  const hasCircularDependency = (prereqId: string, depId: string): boolean => {
    return dependencies.some(
      (d) => d.prerequisiteMilestoneId === depId && d.dependentMilestoneId === prereqId
    );
  };

  const handleSave = () => {
    setFormError("");

    if (!form.prerequisiteMilestoneId || !form.dependentMilestoneId) {
      setFormError("Please select both milestones");
      return;
    }
    if (form.prerequisiteMilestoneId === form.dependentMilestoneId) {
      setFormError("A milestone cannot depend on itself");
      return;
    }
    if (hasCircularDependency(form.prerequisiteMilestoneId, form.dependentMilestoneId)) {
      setFormError("Circular dependency detected");
      return;
    }
    if (dependencies.some(
      (d, i) =>
        i !== editIdx &&
        d.prerequisiteMilestoneId === form.prerequisiteMilestoneId &&
        d.dependentMilestoneId === form.dependentMilestoneId
    )) {
      setFormError("This dependency already exists");
      return;
    }

    if (editIdx !== null) {
      const updated = [...dependencies];
      updated[editIdx] = { ...updated[editIdx], ...form };
      onChange(updated);
    } else {
      onChange([...dependencies, { ...form, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2) }]);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    onChange(dependencies.filter((d) => d.id !== id));
  };

  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setForm({
      prerequisiteMilestoneId: dependencies[idx].prerequisiteMilestoneId,
      dependentMilestoneId: dependencies[idx].dependentMilestoneId,
      type: dependencies[idx].type,
      thresholdPercentage: dependencies[idx].thresholdPercentage,
    });
    setShowForm(true);
  };

  const getMilestoneName = (id: string) => milestones.find((m) => m.id === id)?.name || "Unknown";

  const otherMilestones = (selectedId: string, field: "prerequisite" | "dependent") =>
    milestones.filter((m) => {
      if (field === "prerequisite") return m.id !== form.dependentMilestoneId;
      return m.id !== form.prerequisiteMilestoneId;
    });

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Dependencies are optional. Add them only if a milestone must wait on another.
      </p>
      {milestones.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-indigo-400">account_tree</span>
          </div>
          <p className="text-sm font-semibold text-slate-600">No milestones yet</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Add milestones first before defining dependencies</p>
        </GlassCard>
      ) : (
        <>
          {/* Existing dependencies */}
          {dependencies.length > 0 && (
            <div className="space-y-2">
              {dependencies.map((dep, idx) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white/80 hover:border-amber-200 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg text-amber-600">account_tree</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800">
                        {getMilestoneName(dep.prerequisiteMilestoneId)}
                      </span>
                      <span className="material-symbols-outlined text-base text-slate-400">arrow_forward</span>
                      <span className="font-semibold text-sm text-slate-800">
                        {getMilestoneName(dep.dependentMilestoneId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {dep.type === "CompletionBased" ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600 uppercase">Must complete</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-600 uppercase">Reach {dep.thresholdPercentage}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEdit(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      title="Edit dependency"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove dependency"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {dependencies.length === 0 && !showForm && (
            <GlassCard className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-amber-400">account_tree</span>
              </div>
              <p className="text-sm font-semibold text-slate-600">No dependencies yet</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Define which milestones depend on others. Dependent milestones will show a warning that tasks may be blocked.
              </p>
            </GlassCard>
          )}

          {/* Add dependency form */}
          {showForm ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prerequisite Milestone <span className="text-red-500">*</span></label>
                  <select
                    value={form.prerequisiteMilestoneId}
                    onChange={(e) => setForm({ ...form, prerequisiteMilestoneId: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
                  >
                    <option value="">Select milestone...</option>
                    {milestones.filter((m) => m.id !== form.dependentMilestoneId).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dependent Milestone <span className="text-red-500">*</span></label>
                  <select
                    value={form.dependentMilestoneId}
                    onChange={(e) => setForm({ ...form, dependentMilestoneId: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
                  >
                    <option value="">Select milestone...</option>
                    {milestones.filter((m) => m.id !== form.prerequisiteMilestoneId).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Condition</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="depType"
                        checked={form.type === "CompletionBased"}
                        onChange={() => setForm({ ...form, type: "CompletionBased" })}
                        className="accent-amber-500"
                      />
                      Must complete
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="depType"
                        checked={form.type === "ProgressThreshold"}
                        onChange={() => setForm({ ...form, type: "ProgressThreshold" })}
                        className="accent-amber-500"
                      />
                      Reach %
                    </label>
                  </div>
                </div>
                {form.type === "ProgressThreshold" && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Threshold %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={form.thresholdPercentage}
                        onChange={(e) => setForm({ ...form, thresholdPercentage: Number(e.target.value) })}
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-sm font-semibold text-slate-700 w-10 text-right">{form.thresholdPercentage}%</span>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <Icon name="error" size={16} className="mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-100">
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
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
                >
                  {editIdx !== null ? "Update" : "Add"} Dependency
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50 transition-all w-full justify-center"
            >
              <Icon name="add" size={16} />
              Add Dependency
            </button>
          )}
        </>
      )}
    </div>
  );
}
