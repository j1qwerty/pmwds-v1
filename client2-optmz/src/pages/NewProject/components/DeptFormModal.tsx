import { useState, type FormEvent, type ReactNode } from "react";
import type { OrganizationRecord, User } from "../../../types";
import { RoleKey, hasRoleKey } from "../../../permissions";
import { Icon } from "../../../components/ui/Icon";
import { Sheet, ModalCancelButton, ModalPrimaryButton } from "../../shared";

interface DeptFormModalProps {
  organizations: OrganizationRecord[];
  users?: User[];
  selectedOrgId: string;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all placeholder:text-slate-400";

export function DeptFormModal({
  organizations,
  users = [],
  selectedOrgId,
  onSubmit,
  onCancel,
}: DeptFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    organizationId: selectedOrgId,
    departmentHeadUserId: "",
    maxCapacity: 24,
  });

  const validate = () => {
    const next: { name?: string; code?: string } = {};
    if (!form.name.trim()) next.name = "Department name is required.";
    if (!form.code.trim()) next.code = "Department code is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Parent closes the modal on success; if it stays mounted the submit
      // failed (error toast shown by the parent) so restore the button.
      await onSubmit({
        ...form,
        departmentHeadUserId: form.departmentHeadUserId || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={true}
      onClose={onCancel}
      title="New department"
      description="Add a new department to the organization."
      icon="groups"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSubmit()}
            loading={submitting}
            label="Create department"
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Department name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Engineering"
              aria-label="Department name"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Department code" required error={errors.code}>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. ENG"
              aria-label="Department code"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
            aria-label="Description"
            className={`${INPUT_CLASS} min-h-[80px] py-2 resize-y`}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Organization">
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value, departmentHeadUserId: "" })}
              aria-label="Organization"
              className={INPUT_CLASS}
            >
              <option value="">Select organization</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Department head">
            <select
              value={form.departmentHeadUserId}
              onChange={(e) => setForm({ ...form, departmentHeadUserId: e.target.value })}
              aria-label="Department head"
              className={INPUT_CLASS}
            >
              <option value="">None</option>
              {users
                .filter((u) => u.isActive !== false && !hasRoleKey(u.roleKeys ?? u.roles, RoleKey.SuperAdmin))
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
            </select>
          </Field>
        </div>

        <Field label="Maximum capacity">
          <input
            type="number"
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
            min={1}
            aria-label="Maximum capacity"
            className={INPUT_CLASS}
          />
        </Field>

        {/* Hidden submit input so pressing Enter triggers the form onSubmit */}
        <input type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <Icon name="warning" size={12} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
