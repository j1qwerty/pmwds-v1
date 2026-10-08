import { useEffect, useState, type FormEvent } from "react";
import type { Milestone, MilestoneDependency } from "../../../types";
import { Modal, ModalCancelButton, ModalPrimaryButton, useToast } from "../../shared/index";

interface DependencyFormModalProps {
  open: boolean;
  editDep: MilestoneDependency | null;
  milestones: Milestone[];
  onAdd: (payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

const SELECT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

const LABEL_CLASS =
  "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1";

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

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
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
    <Modal
      open={open}
      onClose={onClose}
      title={editDep ? "Edit Dependency" : "New Dependency"}
      description={editDep ? "Update the dependency condition" : "Define which milestone blocks another"}
      icon="link"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSave()}
            loading={submitting}
            label={editDep ? "Update" : "Add Dependency"}
            icon="check"
          />
        </>
      }
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* Prerequisite + Dependent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>
              Prerequisite <span className="text-red-500">*</span>
            </label>
            <select
              value={form.prerequisiteMilestoneId}
              onChange={(e) => setForm({ ...form, prerequisiteMilestoneId: e.target.value })}
              disabled={!!editDep}
              className={SELECT_CLASS}
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
            <label className={LABEL_CLASS}>
              Dependent <span className="text-red-500">*</span>
            </label>
            <select
              value={form.dependentMilestoneId}
              onChange={(e) => setForm({ ...form, dependentMilestoneId: e.target.value })}
              disabled={!!editDep}
              className={SELECT_CLASS}
            >
              <option value="">Select...</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id} disabled={m.id === form.prerequisiteMilestoneId}>
                  {m.name} ({m.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flow indicator */}
        {form.prerequisiteMilestoneId && form.dependentMilestoneId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="material-symbols-outlined text-base text-slate-400">flag</span>
            <span className="font-medium text-slate-700 truncate">
              {milestones.find((m) => m.id === form.prerequisiteMilestoneId)?.name ?? "—"}
            </span>
            <span className="material-symbols-outlined text-base text-indigo-500 mx-1">arrow_forward</span>
            <span className="font-medium text-slate-700 truncate">
              {milestones.find((m) => m.id === form.dependentMilestoneId)?.name ?? "—"}
            </span>
          </div>
        )}

        {/* Condition radios */}
        <div>
          <label className={LABEL_CLASS}>Condition</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "CompletionBased" })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                form.type === "CompletionBased"
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-500/10"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  form.type === "CompletionBased" ? "border-indigo-500" : "border-slate-300"
                }`}
              >
                {form.type === "CompletionBased" && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </span>
              <span>Must complete</span>
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "ProgressThreshold" })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                form.type === "ProgressThreshold"
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-500/10"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  form.type === "ProgressThreshold" ? "border-indigo-500" : "border-slate-300"
                }`}
              >
                {form.type === "ProgressThreshold" && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                )}
              </span>
              <span>Reach progress %</span>
            </button>
          </div>
        </div>

        {/* Threshold slider */}
        {form.type === "ProgressThreshold" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={LABEL_CLASS + " mb-0"}>Threshold</label>
              <span className="text-sm font-bold text-indigo-600 tabular-nums">
                {form.thresholdPercentage}%
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={form.thresholdPercentage}
              onChange={(e) => setForm({ ...form, thresholdPercentage: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Hidden submit so Enter inside form submits */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Modal>
  );
}
