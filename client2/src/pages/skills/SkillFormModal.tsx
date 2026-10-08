import { useState, useEffect, type FormEvent } from "react";
import type { SkillRecord } from "../../types";

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

export function SkillFormModal({ initialData, onSubmit, onCancel }: SkillFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "",
    description: initialData?.description || "",
  });
  const [customCategory, setCustomCategory] = useState(false);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit(form);
  };

  return (
    <div className="bg-white rounded-2xl p-8 w-[520px] max-w-[95vw] shadow-xl border border-slate-200">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-indigo-600 text-2xl">
            {initialData ? "edit" : "school"}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? "Edit Skill" : "Create Skill"}
          </h2>
          <p className="text-sm text-slate-500">
            {initialData ? "Update skill details" : "Add a new skill to the expertise catalogue"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Skill Name */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Skill Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            placeholder="e.g., React, Project Management, Data Analysis"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Category
          </label>
          
          {!customCategory ? (
            <div className="space-y-2">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                <option value="">Select a category</option>
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCustomCategory(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="Enter custom category"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomCategory(false);
                  setForm({ ...form, category: "" });
                }}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Use predefined categories
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Describe this skill and its applications..."
          />
        </div>

        {/* Skill Preview */}
        {form.name && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl text-indigo-600">school</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{form.name}</p>
                {form.category && (
                  <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                    {form.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !form.name}
            className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : (initialData ? "Update Skill" : "Create Skill")}
          </button>
        </div>
      </form>
    </div>
  );
}