import { useState } from "react";
import type { OrganizationRecord } from "../../../types";
import { Icon } from "../../../components/ui/Icon";
import { Sheet, ModalCancelButton, ModalPrimaryButton } from "../../shared";

interface UserFormModalProps {
  organizations: OrganizationRecord[];
  defaultOrganizationId?: string;
  hideOrganization?: boolean;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function UserFormModal({ organizations, defaultOrganizationId = "", hideOrganization = false, onSubmit, onCancel }: UserFormModalProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    jobTitle: "",
    organizationId: defaultOrganizationId || (organizations[0]?.id ?? ""),
    phoneNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit =
    Boolean(form.firstName.trim()) &&
    Boolean(form.lastName.trim()) &&
    Boolean(form.email.trim()) &&
    Boolean(form.password.trim()) &&
    Boolean(form.organizationId);

  const submit = async () => {
    if (saving) return;
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        jobTitle: form.jobTitle.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        organizationId: form.organizationId,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

  return (
    <Sheet
      open={true}
      onClose={() => {
        if (!saving) onCancel();
      }}
      title="New user"
      description="Add a new user to the organization"
      icon="person_add"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void submit()}
            loading={saving}
            disabled={!canSubmit}
            label="Create user"
            icon="person_add"
          />
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-4"
      >
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            <Icon name="error" size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First name" required>
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="First name"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Last name" required>
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Last name"
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="email@organization.com"
            required
            className={inputClass}
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Set initial password"
              required
              className={`${inputClass} pr-9`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center size-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Icon name={showPassword ? "visibility_off" : "visibility"} size={15} />
            </button>
          </div>
        </Field>

        {!hideOrganization && (
          <Field label="Organization" required={!hideOrganization}>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              required={!hideOrganization}
              className={inputClass}
            >
              <option value="">Select organization</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job title">
            <input
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="Job title (optional)"
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="Phone (optional)"
              className={inputClass}
            />
          </Field>
        </div>

        {/* Hidden submit so Enter key works */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
