import { useState, useEffect } from "react";
import type { PermissionRecord } from "../../types";
import {
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
} from "../shared";

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

  const handleSave = () => {
    if (submitting) return;
    setSubmitting(true);
    onSubmit({ ...form, code: form.code || undefined });
  };

  const canSubmit = !!form.name.trim() && (!!initialData || !!form.code.trim());

  return (
    <Modal
      open
      onClose={onCancel}
      title={initialData ? "Edit Permission" : "Create Permission"}
      description="Define a granular access permission"
      icon={initialData ? "edit" : "lock"}
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={handleSave}
            loading={submitting}
            disabled={!canSubmit}
            label={initialData ? "Update Permission" : "Create Permission"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!initialData && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Code *
            </label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g., PROJECTS.VIEW"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Name *
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., View Projects"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Module
          </label>
          <select
            value={form.module}
            onChange={(e) => setForm({ ...form, module: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">Select module...</option>
            {PERMISSION_MODULES.map((mod) => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Describe what this permission allows"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
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
      </div>
    </Modal>
  );
}
