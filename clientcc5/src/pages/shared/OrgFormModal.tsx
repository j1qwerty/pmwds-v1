import { useState, type FormEvent, type ReactNode } from "react";
import type { OrganizationRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { Sheet } from "./Sheet";
import { ModalCancelButton, ModalPrimaryButton } from "./Modal";

interface OrgFormModalProps {
  initialData?: OrganizationRecord;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all";

export function OrgFormModal({ initialData, onSubmit, onCancel }: OrgFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contactEmail?: string }>({});
  const [form, setForm] = useState({
    name: initialData?.name || "",
    taxId: initialData?.taxId || "",
    address: initialData?.address || "",
    contactEmail: initialData?.contactEmail || "",
    contactPhone: initialData?.contactPhone || "",
    foundedDate: initialData?.foundedDate?.slice(0, 10) || "",
  });

  const isEdit = !!initialData;

  const validate = () => {
    const next: { name?: string; contactEmail?: string } = {};
    if (!form.name.trim()) next.name = "Organization name is required.";
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      next.contactEmail = "Enter a valid email address.";
    }
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
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={true}
      onClose={onCancel}
      title={isEdit ? "Edit organization" : "New organization"}
      description={isEdit ? "Update the organization details below." : "Add a new organization to your workspace."}
      icon="account_balance"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSubmit()}
            loading={submitting}
            label={isEdit ? "Save changes" : "Create organization"}
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Organization name" required error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Acme Industries"
            aria-label="Organization name"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tax ID">
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="00-0000000"
              aria-label="Tax ID"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              aria-label="Contact phone"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Email" error={errors.contactEmail}>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder="contact@company.com"
            aria-label="Contact email"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street, city, country"
              aria-label="Address"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Founded date">
            <input
              type="date"
              value={form.foundedDate}
              onChange={(e) => setForm({ ...form, foundedDate: e.target.value })}
              aria-label="Founded date"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

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
