import { useState, useEffect } from "react";
import type { PermissionRecord } from "../../types";
import {
  Sheet,
  ModalCancelButton,
  ModalPrimaryButton,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

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

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all";
const labelCls =
  "text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5";

interface PermissionFormModalProps {
  initialData?: PermissionRecord;
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

export function PermissionFormModal({ initialData, onSubmit, onCancel }: PermissionFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
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

  const canSubmit = !!form.name.trim() && (!!initialData || !!form.code.trim());
  const codeError = attempted && !initialData && !form.code.trim() ? "Code is required" : null;
  const nameError = attempted && !form.name.trim() ? "Name is required" : null;

  const handleSave = async () => {
    if (submitting) return;
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...form, code: form.code || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title={initialData ? "Edit permission" : "Create permission"}
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
            disabled={attempted && !canSubmit}
            label={initialData ? "Update permission" : "Create permission"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!initialData && (
            <div>
              <label className={labelCls} htmlFor="permission-form-code">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                id="permission-form-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. PROJECTS.VIEW"
                aria-invalid={codeError ? true : undefined}
                className={`${inputCls} font-mono ${codeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {codeError && <p className="text-xs text-red-600 mt-1">{codeError}</p>}
            </div>
          )}

          <div className={!initialData ? "" : "sm:col-span-2"}>
            <label className={labelCls} htmlFor="permission-form-name">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="permission-form-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. View Projects"
              aria-invalid={nameError ? true : undefined}
              className={`${inputCls} ${nameError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="permission-form-module">Module</label>
          <select
            id="permission-form-module"
            value={form.module}
            onChange={(e) => setForm({ ...form, module: e.target.value })}
            className={inputCls}
          >
            <option value="">Select module...</option>
            {PERMISSION_MODULES.map((mod) => (
              <option key={mod} value={mod}>{mod}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="permission-form-description">Description</label>
          <textarea
            id="permission-form-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Describe what this permission allows"
            className="w-full px-3 py-2 min-h-[80px] rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all resize-none"
          />
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition-colors">
          <input
            type="checkbox"
            checked={form.isGlobal}
            onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
            className="mt-0.5 size-4 accent-indigo-600"
          />
          <div>
            <div className="text-sm font-semibold text-slate-700">Global permission</div>
            <div className="text-xs text-slate-400">Applies to all scopes and departments</div>
          </div>
        </label>

        {attempted && !canSubmit && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <Icon name="error" size={14} className="shrink-0" />
            Fix the highlighted fields to continue.
          </div>
        )}
      </div>
    </Sheet>
  );
}
