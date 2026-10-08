import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Department, OrganizationRecord, User } from "../../../types";
import { priorities } from "../../constants";
import { Sheet, ModalCancelButton, ModalPrimaryButton, ScopedUserSelect } from "../../shared/index";
import { BUDGET_INPUT_LABEL, formatRupees, lakhsToRupees, rupeesToLakhs } from "../../../lib/formatters";
import { Icon } from "../../../components/ui/Icon";

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
  }, [form.name]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBudgetLakhs(form.plannedBudget > 0 ? String(rupeesToLakhs(form.plannedBudget)) : "");
    }
  }, [open, form.plannedBudget]);

  const filteredDepartments = form.organizationId
    ? departments.filter((d) => d.organizationId === form.organizationId)
    : departments;
  const selectedDepartment = departments.find((d) => d.id === form.departmentId);
  const selectedDepartmentIds = new Set(
    form.departmentIds?.length ? form.departmentIds : form.departmentId ? [form.departmentId] : [],
  );
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

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit(e as FormEvent);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description="Set up the project details and assigned departments"
      icon="folder_open"
      accent="primary"
      size="xl"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={submitting ? "Saving..." : submitLabel}
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className={INPUT_CLASS}
            placeholder="e.g. District water quality monitoring"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="What does this project cover?"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={INPUT_CLASS}
            >
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>

          <Field label={BUDGET_INPUT_LABEL}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={budgetLakhs}
                onChange={(e) => {
                  const text = e.target.value;
                  setBudgetLakhs(text);
                  setForm((prev) => ({
                    ...prev,
                    plannedBudget: text === "" ? 0 : lakhsToRupees(Number(text)),
                  }));
                }}
                placeholder="0"
                title="Enter the project budget in lakhs (1 lakh = ₹1,00,000)"
                className={`${INPUT_CLASS} pl-7`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              In lakhs (1L = ₹1,00,000)
              {form.plannedBudget > 0 && <> &middot; {formatRupees(form.plannedBudget)}</>}
            </p>
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start">
            <input
              type="date"
              value={form.plannedStartDate}
              onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="End">
            <input
              type="date"
              value={form.plannedEndDate}
              onChange={(e) => setForm({ ...form, plannedEndDate: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {showOrganizationFilter && (
          <Field label="Organization">
            <select
              value={form.organizationId}
              onChange={(e) =>
                setForm({
                  ...form,
                  organizationId: e.target.value,
                  departmentId: "",
                  departmentIds: [],
                  projectManagerId: "",
                })
              }
              className={INPUT_CLASS}
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

        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Assigned departments
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 max-h-44 overflow-y-auto">
            {filteredDepartments.map((department) => (
              <label
                key={department.id}
                className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white rounded-md px-2 py-1 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedDepartmentIds.has(department.id)}
                  onChange={(event) => updateDepartmentSelection(department.id, event.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                />
                <span className="truncate">{department.name}</span>
              </label>
            ))}
            {filteredDepartments.length === 0 && (
              <span className="text-xs text-slate-400 px-2 py-1">No departments available.</span>
            )}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowProjectManager(!showProjectManager)}
            aria-expanded={showProjectManager}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            <Icon name={showProjectManager ? "chevron-up" : "chevron-down"} size={15} className="text-slate-400" />
            Project manager {!showProjectManager && form.projectManagerId && "(assigned)"}
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

        {/* Hidden submit input so pressing Enter triggers the form onSubmit */}
        <input type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
