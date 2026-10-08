import { useState, useRef, type FormEvent, type ReactNode } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { RoleKey, hasRoleKey } from "../../permissions";
import { Modal, ModalCancelButton, ModalPrimaryButton } from "./Modal";

interface DeptFormModalProps {
  initialData?: Department;
  departments: Department[];
  organizations: OrganizationRecord[];
  users?: User[];
  selectedOrgId: string;
  showOrganization?: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function DeptFormModal({
  initialData,
  departments: _departments,
  organizations,
  users = [],
  selectedOrgId,
  showOrganization,
  onSubmit,
  onCancel,
}: DeptFormModalProps) {
  void _departments; // prop kept for backwards-compatible API; not currently used in this form
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    code: initialData?.code || "",
    description: initialData?.description || "",
    organizationId: initialData?.organizationId || selectedOrgId,
    parentDepartmentId: initialData?.parentDepartmentId || "",
    departmentHeadUserId: initialData?.departmentHeadUserId ?? "",
    maxCapacity: initialData?.maxCapacity ?? 24,
  });
  const headSelectRef = useRef<HTMLSelectElement>(null);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const rawValue = headSelectRef.current?.value ?? "";
    onSubmit({
      ...form,
      parentDepartmentId: form.parentDepartmentId || null,
      departmentHeadUserId: rawValue || null,
    });
  };

  const isEdit = !!initialData;

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={isEdit ? "Edit Department" : "Create Department"}
      description={isEdit ? "Update department details" : "Add a new department to the organization"}
      icon="groups"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={isEdit ? "Update Department" : "Create Department"}
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Department Code" required>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Description">
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>

        {showOrganization && (
          <Field label="Organization">
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value, parentDepartmentId: "" })}
              className={INPUT_CLASS}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Submit null so departments remain top-level. */}
        <Field label="Department Head">
          <select
            ref={headSelectRef}
            value={form.departmentHeadUserId}
            onChange={(e) => setForm({ ...form, departmentHeadUserId: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">None</option>
            {users
              .filter((u) => !hasRoleKey(u.roleKeys ?? u.roles, RoleKey.SuperAdmin))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Maximum Capacity">
          <input
            type="number"
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
            className={INPUT_CLASS}
          />
        </Field>

        {/* Hidden submit input so pressing Enter triggers the form onSubmit */}
        <input type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
