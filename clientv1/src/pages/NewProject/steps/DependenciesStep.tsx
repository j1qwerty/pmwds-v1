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

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const LABEL_CLASS =
  "text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5";

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

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Dependencies are optional. Add them only if a milestone must wait on another.
      </p>
      {milestones.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon="account_tree"
            title="No milestones yet"
            description="Add milestones first before defining dependencies."
          />
        </GlassCard>
      ) : (
        <>
          {/* Existing dependencies */}
          {dependencies.length > 0 && (
            <div className="space-y-2">
              {dependencies.map((dep, idx) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-200 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Icon name="account_tree" size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-800 truncate">
                        {getMilestoneName(dep.prerequisiteMilestoneId)}
                      </span>
                      <Icon name="arrow_forward" size={15} className="text-slate-400 shrink-0" />
                      <span className="font-semibold text-sm text-slate-800 truncate">
                        {getMilestoneName(dep.dependentMilestoneId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {dep.type === "CompletionBased" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">Must complete</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100 uppercase">Reach {dep.thresholdPercentage}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEdit(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit dependency"
                      aria-label="Edit dependency"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(dep.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove dependency"
                      aria-label="Remove dependency"
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
            <GlassCard>
              <EmptyState
                icon="account_tree"
                title="No dependencies yet"
                description="Define which milestones depend on others. Dependent milestones will show a warning that tasks may be blocked."
                accent="warning"
              />
            </GlassCard>
          )}

          {/* Add dependency form */}
          {showForm ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASS}>Prerequisite milestone <span className="text-red-500">*</span></label>
                  <select
                    value={form.prerequisiteMilestoneId}
                    onChange={(e) => setForm({ ...form, prerequisiteMilestoneId: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select milestone...</option>
                    {milestones.filter((m) => m.id !== form.dependentMilestoneId).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Dependent milestone <span className="text-red-500">*</span></label>
                  <select
                    value={form.dependentMilestoneId}
                    onChange={(e) => setForm({ ...form, dependentMilestoneId: e.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select milestone...</option>
                    {milestones.filter((m) => m.id !== form.prerequisiteMilestoneId).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Condition</label>
                  <div className="flex items-center gap-3 h-9">
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="depType"
                        checked={form.type === "CompletionBased"}
                        onChange={() => setForm({ ...form, type: "CompletionBased" })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Must complete
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="depType"
                        checked={form.type === "ProgressThreshold"}
                        onChange={() => setForm({ ...form, type: "ProgressThreshold" })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Reach %
                    </label>
                  </div>
                </div>
                {form.type === "ProgressThreshold" && (
                  <div>
                    <label className={LABEL_CLASS}>Threshold %</label>
                    <div className="flex items-center gap-2 h-9">
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={form.thresholdPercentage}
                        onChange={(e) => setForm({ ...form, thresholdPercentage: Number(e.target.value) })}
                        className="flex-1 accent-indigo-600"
                        aria-label="Threshold percentage"
                      />
                      <span className="text-sm font-semibold text-slate-700 w-10 text-right">{form.thresholdPercentage}%</span>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                  <Icon name="error" size={16} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-100">
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
                  className="inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                >
                  {editIdx !== null ? "Update dependency" : "Add dependency"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50 transition-all w-full justify-center"
            >
              <Icon name="add" size={16} />
              Add dependency
            </button>
          )}
        </>
      )}
    </div>
  );
}
