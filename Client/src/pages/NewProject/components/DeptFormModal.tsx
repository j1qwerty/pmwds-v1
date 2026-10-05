import { useState, type FormEvent } from "react";
import type { OrganizationRecord, User } from "../../../types";
import { RoleKey, hasRoleKey } from "../../../permissions";

interface DeptFormModalProps {
  organizations: OrganizationRecord[];
  users?: User[];
  selectedOrgId: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function DeptFormModal({
  organizations,
  users = [],
  selectedOrgId,
  onSubmit,
  onCancel,
}: DeptFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    organizationId: selectedOrgId,
    departmentHeadUserId: "",
    maxCapacity: 24,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      ...form,
      departmentHeadUserId: form.departmentHeadUserId || null,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-8 w-[560px] max-w-[100vw] shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-indigo-600 text-2xl">group_add</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Create Department</h2>
          <p className="text-sm text-slate-400">Add a new department to the organization</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Department name"
              required
              className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Department Code <span className="text-red-500">*</span>
            </label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. ENG"
              required
              className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
            rows={2}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Organization</label>
          <select
            value={form.organizationId}
            onChange={(e) => setForm({ ...form, organizationId: e.target.value, departmentHeadUserId: "" })}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">Select organization</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Department Head</label>
          <select
            value={form.departmentHeadUserId}
            onChange={(e) => setForm({ ...form, departmentHeadUserId: e.target.value })}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">None</option>
            {users
              .filter((u) => u.isActive !== false && !hasRoleKey(u.roleKeys ?? u.roles, RoleKey.SuperAdmin))
              .map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Maximum Capacity</label>
          <input
            type="number"
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
            min={1}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

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
            className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Department"}
          </button>
        </div>
      </form>
    </div>
  );
}
