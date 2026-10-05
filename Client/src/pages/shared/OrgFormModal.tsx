import { useState, type FormEvent } from "react";
import type { OrganizationRecord } from "../../types";
import { InputF } from "./InputF";

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
            {initialData ? "edit_business" : "add_business"}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? "Edit Organization" : "Create Organization"}
          </h2>
          <p className="text-sm text-slate-500">
            {initialData ? "Update organization details" : "Add a new organization to your structure"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <InputF label="Organization Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        
        <div className="grid grid-cols-2 gap-4">
          <InputF label="Tax ID" value={form.taxId} onChange={(v) => setForm({ ...form, taxId: v })} />
          <InputF label="Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
        </div>
        
        <InputF label="Email" type="email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
        <InputF label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <InputF label="Founded Date" type="date" value={form.foundedDate} onChange={(v) => setForm({ ...form, foundedDate: v })} />

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
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : (initialData ? "Update Organization" : "Create Organization")}
          </button>
        </div>
      </form>
    </div>
  );
}