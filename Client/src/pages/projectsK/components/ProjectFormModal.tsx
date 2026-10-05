import { useEffect, useState, type FormEvent } from "react";
import type { Department, OrganizationRecord, User } from "../../../types";
import { priorities } from "../../constants";
import { ModalOverlay, ScopedUserSelect } from "../../shared";
import { BUDGET_INPUT_LABEL, formatRupees, lakhsToRupees, rupeesToLakhs } from "../../../lib/formatters";

export type ProjectFormState = {
  projectCode: string;
  name: string;
  description: string;
  category: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedBudget: number;
  organizationId: string;
  departmentId: string;
  departmentIds: string[];
  projectManagerId: string;
  priority: string;
};

interface ProjectFormModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  form: ProjectFormState;
  setForm: React.Dispatch<React.SetStateAction<ProjectFormState>>;
  departments: Department[];
  organizations: OrganizationRecord[];
  showOrganizationFilter?: boolean;
  users: User[];
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function ProjectFormModal({
  open,
  title,
  submitLabel,
  form,
  setForm,
  departments,
  organizations,
  showOrganizationFilter = false,
  users,
  onSubmit,
  onClose,
}: ProjectFormModalProps) {
  useEffect(() => {
    if (!form.projectCode && form.name) {
      const sanitized = form.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20);
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      setForm((prev) => ({ ...prev, projectCode: `${sanitized}-${ts}-${rand}` }));
    }
  }, [form.name]);

  const [showProjectManager, setShowProjectManager] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The budget field is typed in lakhs while `form.plannedBudget` holds rupees. Keeping the
  // raw text locally stops the leading zero from sticking: with value={0} the browser edits
  // "0" as a string, so typing 20 lands as "020".
  const [budgetLakhs, setBudgetLakhs] = useState(() =>
    form.plannedBudget > 0 ? String(rupeesToLakhs(form.plannedBudget)) : "",
  );

  useEffect(() => {
    if (open) {
      setBudgetLakhs(form.plannedBudget > 0 ? String(rupeesToLakhs(form.plannedBudget)) : "");
    }
  }, [open, form.plannedBudget]);

  if (!open) return null;

  const filteredDepartments = form.organizationId
    ? departments.filter((d) => d.organizationId === form.organizationId)
    : departments;
  const selectedDepartment = departments.find((d) => d.id === form.departmentId);
  const selectedDepartmentIds = new Set(form.departmentIds?.length ? form.departmentIds : form.departmentId ? [form.departmentId] : []);
  const updateDepartmentSelection = (departmentId: string, checked: boolean) => {
    const nextDepartmentIds = checked
      ? Array.from(new Set([...selectedDepartmentIds, departmentId]))
      : Array.from(selectedDepartmentIds).filter((id) => id !== departmentId);
    setForm({
      ...form,
      departmentIds: nextDepartmentIds,
      departmentId: nextDepartmentIds[0] || "",
    });
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 text-2xl">folder</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          </div>
        </div>
        <form onSubmit={(e) => { if (submitting) return; setSubmitting(true); onSubmit(e); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Name" required>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" rows={3} />
            </Field>
          </div>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm">
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            
          </Field>
            <Field label={BUDGET_INPUT_LABEL}>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={budgetLakhs}
                onChange={(e) => {
                  const text = e.target.value;
                  setBudgetLakhs(text);
                  setForm((prev) => ({ ...prev, plannedBudget: text === "" ? 0 : lakhsToRupees(Number(text)) }));
                }}
                placeholder="0"
                title="Enter the project budget in lakhs (1 lakh = ₹1,00,000)"
                className="w-full border border-slate-200 rounded-lg p-2 pl-6 text-sm"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Enter amount in lakhs (1 lakh = ₹1,00,000)
              {form.plannedBudget > 0 && <> &middot; {formatRupees(form.plannedBudget)}</>}
            </p>
          </Field>
          <Field label="Start">
            <input type="date" value={form.plannedStartDate} onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
          </Field>
          <Field label="End">
            <input type="date" value={form.plannedEndDate} onChange={(e) => setForm({ ...form, plannedEndDate: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-sm" />
          </Field>
        
          {showOrganizationFilter && (
            <Field label="Organization">
              <select
                value={form.organizationId}
                onChange={(e) => setForm({ ...form, organizationId: e.target.value, departmentId: "", departmentIds: [], projectManagerId: "" })}
                className="w-full border border-slate-200 rounded-lg p-2 text-sm"
              >
                <option value="">Choose</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="md:col-span-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Departments</span>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3">
              {filteredDepartments.map((department) => (
                <label key={department.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedDepartmentIds.has(department.id)}
                    onChange={(event) => updateDepartmentSelection(department.id, event.target.checked)}
                  />
                  <span>{department.name}</span>
                </label>
              ))}
              {filteredDepartments.length === 0 && (
                <span className="text-xs text-slate-400">No departments available.</span>
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => setShowProjectManager(!showProjectManager)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <span className="material-symbols-outlined text-lg">
                {showProjectManager ? "expand_less" : "expand_more"}
              </span>
              Project Manager {!showProjectManager && form.projectManagerId && "(assigned)"}
            </button>
            {showProjectManager && (
              <div className="mt-2">
                <ScopedUserSelect
                  users={users}
                  value={form.projectManagerId}
                  organizationId={form.organizationId || selectedDepartment?.organizationId}
                  label=""
                  onChange={(projectManagerId) => setForm({ ...form, projectManagerId })}
                />
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {label}
        {required && " *"}
      </span>
      {children}
    </label>
  );
}