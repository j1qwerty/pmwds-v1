import { useState, type FormEvent } from "react";
import type { OrganizationRecord } from "../../../types";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim() || !form.organizationId) return;
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/20" onClick={onCancel}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-[480px] max-w-[95vw] shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600 text-2xl">person_add</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create User</h2>
              <p className="text-sm text-slate-400">Add a new user to the organization</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="First name"
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Last name"
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@organization.com"
                required
                className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Set initial password"
                required
                className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {!hideOrganization && (
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Organization</label>
                <select
                  value={form.organizationId}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                >
                  <option value="">Select organization</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Job Title</label>
                <input
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="Job title (optional)"
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Phone</label>
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  placeholder="Phone (optional)"
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password.trim() || !form.organizationId}
                className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
