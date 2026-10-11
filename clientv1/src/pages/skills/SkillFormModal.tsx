import { useState, useEffect, type FormEvent } from "react";
import type { SkillRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { Sheet, ModalCancelButton, ModalPrimaryButton } from "../shared";

interface SkillFormModalProps {
  initialData?: SkillRecord;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

const COMMON_CATEGORIES = [
  "Programming",
  "Design",
  "Management",
  "Marketing",
  "Finance",
  "Operations",
  "Sales",
  "Support",
  "Data Science",
  "DevOps",
  "Security",
  "QA",
  "Documentation",
  "Research",
  "Other",
];

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all placeholder:text-slate-400";

export function SkillFormModal({ initialData, onSubmit, onCancel }: SkillFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState("");
  const [form, setForm] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "",
    description: initialData?.description || "",
  });
  const [customCategory, setCustomCategory] = useState(false);

  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        category: initialData.category || "",
        description: initialData.description || "",
      });
      // Check if category is custom (not in predefined list)
      if (initialData.category && !COMMON_CATEGORIES.includes(initialData.category)) {
        setCustomCategory(true);
      }
    }
  }, [initialData]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    if (!form.name.trim()) {
      setNameError("Skill name is required.");
      return;
    }
    setNameError("");
    setSubmitting(true);
    try {
      // Parent closes the modal on success; if it stays mounted the submit
      // failed (error toast shown by the parent) so restore the button.
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={true}
      onClose={onCancel}
      title={isEdit ? "Edit skill" : "New skill"}
      description={isEdit ? "Update the skill details below." : "Add a new skill to the expertise catalogue."}
      icon={isEdit ? "edit" : "school"}
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={!form.name.trim()}
            label={isEdit ? "Save changes" : "Create skill"}
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Skill name <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (nameError && e.target.value.trim()) setNameError("");
            }}
            placeholder="e.g. React, Project Management, Data Analysis"
            aria-label="Skill name"
            className={INPUT_CLASS}
          />
          {nameError && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <Icon name="warning" size={12} className="shrink-0" />
              {nameError}
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Category
          </label>

          {!customCategory ? (
            <div className="space-y-2">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                aria-label="Category"
                className={INPUT_CLASS}
              >
                <option value="">Select a category</option>
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCustomCategory(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                + Add custom category
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Enter custom category"
                aria-label="Custom category"
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => {
                  setCustomCategory(false);
                  setForm({ ...form, category: "" });
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Use predefined categories
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="Describe this skill and its applications..."
            aria-label="Description"
            className={`${INPUT_CLASS} min-h-[80px] py-2 resize-y`}
          />
        </div>

        {/* Skill preview */}
        {form.name && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon name="school" size={18} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{form.name}</p>
                {form.category && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100 mt-0.5">
                    {form.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden submit input so pressing Enter triggers the form onSubmit */}
        <input type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
