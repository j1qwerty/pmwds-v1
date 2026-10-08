import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Department, Milestone, OrganizationRecord } from "../../../types";
import { Modal, ModalCancelButton, ModalPrimaryButton } from "../../shared/index";

interface MilestoneFormModalProps {
  open: boolean;
  projectId: string;
  initialData?: Milestone;
  departments: Department[];
  organizations: OrganizationRecord[];
  isSuperAdmin: boolean;
  userOrganizationId?: string | null;
  projectEndDate: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
  serverError?: string;
}

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

export function MilestoneFormModal({ open, projectId, initialData, departments, organizations, isSuperAdmin, userOrganizationId, projectEndDate, onSubmit, onClose, serverError }: MilestoneFormModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    dueDate: "",
    progressPercentage: 0,
    isCritical: false,
    departmentId: "",
    organizationId: "",
  });
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValidationError("");
    if (open) {
      setForm({
        name: initialData?.name || "",
        description: initialData?.description || "",
        dueDate: initialData?.dueDate?.slice(0, 10) || projectEndDate,
        progressPercentage: initialData?.progressPercentage || 0,
        isCritical: initialData?.isCritical || false,
        departmentId: initialData?.departmentId || "",
        organizationId: "",
      });
    }
  }, [open, initialData, projectEndDate]);

  const filteredDepartments = useMemo(() => {
    if (isSuperAdmin) {
      if (!form.organizationId) return departments;
      return departments.filter((d) => d.organizationId === form.organizationId);
    }
    if (userOrganizationId) {
      return departments.filter((d) => d.organizationId === userOrganizationId);
    }
    return departments;
  }, [isSuperAdmin, userOrganizationId, form.organizationId, departments]);

  if (!open) return null;

  const hasTasks = initialData?.hasTasks ?? false;
  const isEditMode = !!initialData;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setValidationError("");

    if (!form.name.trim()) {
      setValidationError("Name is required");
      return;
    }
    if (!form.dueDate) {
      setValidationError("Due date is required");
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description,
      dueDate: form.dueDate,
      isCritical: form.isCritical,
      departmentId: form.departmentId || null,
      projectId,
    };
    payload.progressPercentage = 0;
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Milestone" : "New Milestone"}
      description="Track deliverables for this project"
      icon={isEditMode ? "edit" : "flag"}
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={isEditMode ? "Save Changes" : "Create Milestone"}
            icon="check"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter milestone name"
            className={INPUT_CLASS}
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add details about this milestone"
            className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-y"
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className={INPUT_CLASS}
          />
          {form.dueDate && projectEndDate && form.dueDate > projectEndDate && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mt-2">
              <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
              <span>Due date exceeds project end date ({new Date(projectEndDate).toLocaleDateString()})</span>
            </div>
          )}
        </div>

        {/* Organization (super admin only) */}
        {isSuperAdmin && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Organization
            </label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value, departmentId: "" })}
              className={INPUT_CLASS}
            >
              <option value="">All organizations</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Department */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Department
          </label>
          <select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">None</option>
            {filteredDepartments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Progress (read-only when milestone has tasks) */}
        {isEditMode && hasTasks ? (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Progress %
            </label>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-500"
                  style={{ width: `${form.progressPercentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700 tabular-nums">
                {Math.round(form.progressPercentage)}%
              </span>
            </div>
            <p className="text-[10px] text-indigo-500 mt-1">
              Progress is calculated from tasks
            </p>
          </div>
        ) : null}

        {/* Critical milestone toggle */}
        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={form.isCritical}
            onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-red-500">priority_high</span>
            Mark as critical milestone
          </span>
        </label>

        {/* Errors */}
        {(validationError || serverError) && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            <span>{validationError || serverError}</span>
          </div>
        )}

        {/* Hidden submit so Enter inside form submits */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Modal>
  );
}
