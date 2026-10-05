import { useState, useEffect, type FormEvent } from "react";
import type { PermissionRecord } from "../../types";

const PERMISSION_MODULES = [
  "Dashboard",
  "Projects",
  "Tasks",
  "Users",
  "Resources",
  "Roles",
  "Reports",
  "Settings",
  "Notifications",
  "Operations",
  "AIInsights",
];

interface PermissionFormModalProps {
  initialData?: PermissionRecord;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function PermissionFormModal({ initialData, onSubmit, onCancel }: PermissionFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: initialData?.code || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    module: initialData?.module || "",
    isGlobal: initialData?.isGlobal || false,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        code: initialData.code || "",
        name: initialData.name || "",
        description: initialData.description || "",
        module: initialData.module || "",
        isGlobal: initialData.isGlobal || false,
      });
    }
  }, [initialData]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({ ...form, code: form.code || undefined });
  };

  return (
    <div className="bg-white rounded-2xl p-8 w-[540px] max-w-[95vw] shadow-xl border border-slate-200">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-violet-600 text-2xl">
            {initialData ? "edit" : "lock"}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? "Edit Permission" : "Create Permission"}
          </h2>
          <p className="text-sm text-slate-500">Define a granular access permission</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!initialData && (
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Code *</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white font-mono focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="e.g., PROJECTS.VIEW"
            />
          </div>
        )}

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            placeholder="e.g., View Projects"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Module</label>
          <select
            value={form.module}
            onChange={(e) => setForm({ ...form, module: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">Select module...</option>
            {PERMISSION_MODULES.map((mod) => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Describe what this permission allows"
          />
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isGlobal}
            onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-medium text-slate-700">Global permission</div>
            <div className="text-xs text-slate-400">Applies to all scopes and departments</div>
          </div>
        </label>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !form.name || (!initialData && !form.code)} className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Saving..." : (initialData ? "Update Permission" : "Create Permission")}
          </button>
        </div>
      </form>
    </div>
  );
}