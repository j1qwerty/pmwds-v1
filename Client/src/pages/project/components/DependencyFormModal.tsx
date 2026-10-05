import { useEffect, useState, type FormEvent } from "react";
import type { Milestone, MilestoneDependency } from "../../../types";
import { ModalOverlay, useToast } from "../../shared/index";

interface DependencyFormModalProps {
  open: boolean;
  editDep: MilestoneDependency | null;
  milestones: Milestone[];
  onAdd: (payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export function DependencyFormModal({
  open,
  editDep,
  milestones,
  onAdd,
  onUpdate,
  onClose,
}: DependencyFormModalProps) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    prerequisiteMilestoneId: "",
    dependentMilestoneId: "",
    type: "CompletionBased" as "CompletionBased" | "ProgressThreshold",
    thresholdPercentage: 50,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editDep) {
        setForm({
          prerequisiteMilestoneId: editDep.prerequisiteMilestoneId,
          dependentMilestoneId: editDep.dependentMilestoneId,
          type: editDep.type,
          thresholdPercentage: editDep.thresholdPercentage || 50,
        });
      } else {
        setForm({ prerequisiteMilestoneId: "", dependentMilestoneId: "", type: "CompletionBased", thresholdPercentage: 50 });
      }
    }
  }, [open, editDep]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.prerequisiteMilestoneId || !form.dependentMilestoneId) {
      addToast("Please select both milestones", "error");
      return;
    }
    if (form.prerequisiteMilestoneId === form.dependentMilestoneId) {
      addToast("A milestone cannot depend on itself", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        projectId: "",
        prerequisiteMilestoneId: form.prerequisiteMilestoneId,
        dependentMilestoneId: form.dependentMilestoneId,
        type: form.type,
        thresholdPercentage: form.type === "ProgressThreshold" ? form.thresholdPercentage : null,
      };

      if (editDep) {
        await onUpdate(editDep.id, {
          type: form.type,
          thresholdPercentage: form.type === "ProgressThreshold" ? form.thresholdPercentage : null,
        });
      } else {
        await onAdd(payload);
      }
      setForm({ prerequisiteMilestoneId: "", dependentMilestoneId: "", type: "CompletionBased", thresholdPercentage: 50 });
      onClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to save dependency", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} >
      <form onSubmit={handleSave} className="bg-white rounded-2xl w-full  flex flex-col shadow-xl border border-slate-200">
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div> 
            <h3 className="text-lg font-bold text-slate-900">{editDep ? "Edit Dependency" : "New Dependency"}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {editDep ? "Update the dependency condition" : "Define which milestone blocks another"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Prerequisite <span className="text-red-500">*</span>
              </label>
              <select
                value={form.prerequisiteMilestoneId}
                onChange={(e) => setForm({ ...form, prerequisiteMilestoneId: e.target.value })}
                disabled={!!editDep}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm bg-white"
              >
                <option value="">Select...</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.id === form.dependentMilestoneId}>
                    {m.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Dependent <span className="text-red-500">*</span>
              </label>
              <select
                value={form.dependentMilestoneId}
                onChange={(e) => setForm({ ...form, dependentMilestoneId: e.target.value })}
                disabled={!!editDep}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm bg-white"
              >
                <option value="">Select...</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.id === form.prerequisiteMilestoneId}>
                    {m.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Condition</label>
              <div className="flex items-center gap-4">
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
                  Reach progress %
                </label>
              </div>
            </div>
            {form.type === "ProgressThreshold" && (
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Threshold: {form.thresholdPercentage}%
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={form.thresholdPercentage}
                  onChange={(e) => setForm({ ...form, thresholdPercentage: Number(e.target.value) })}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>1%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving..." : editDep ? "Update" : "Add"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
