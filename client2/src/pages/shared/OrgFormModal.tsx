import { useState, type FormEvent, type ReactNode } from "react";
import type { OrganizationRecord } from "../../types";
import { Modal, ModalCancelButton, ModalPrimaryButton } from "./Modal";

interface OrgFormModalProps {
  initialData?: OrganizationRecord;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function OrgFormModal({ initialData, onSubmit, onCancel }: OrgFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    taxId: initialData?.taxId || "",
    address: initialData?.address || "",
    contactEmail: initialData?.contactEmail || "",
    contactPhone: initialData?.contactPhone || "",
    foundedDate: initialData?.foundedDate?.slice(0, 10) || "",
  });

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit(form);
  };

  const isEdit = !!initialData;

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={isEdit ? "Edit Organization" : "Create Organization"}
      description={isEdit ? "Update organization details" : "Add a new organization to your workspace"}
      icon="account_balance"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={isEdit ? "Update Organization" : "Create Organization"}
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Organization Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tax ID">
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Address">
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Founded Date">
          <input
            type="date"
            value={form.foundedDate}
            onChange={(e) => setForm({ ...form, foundedDate: e.target.value })}
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
