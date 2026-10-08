import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Department, Milestone, OrganizationRecord } from "../../../types";
import { Sheet, ModalCancelButton, ModalPrimaryButton } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

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
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const TEXTAREA_CLASS =
  "w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-y";

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5";

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

  // Sheet handles open/closed internally (stays mounted so the exit animation plays)
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

  // Inline presentation of the existing single validation error (logic unchanged)
  const nameError = validationError.toLowerCase().includes("name") ? validationError : undefined;
  const dueDateError = validationError.toLowerCase().includes("due date") ? validationError : undefined;
  const bannerError = validationError && !nameError && !dueDateError ? validationError : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit milestone" : "New milestone"}
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
            label={isEditMode ? "Save changes" : "Create milestone"}
            icon="check"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className={LABEL_CLASS}>
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
          {nameError && <span className="text-xs text-red-600 mt-1 block">{nameError}</span>}
        </div>

        {/* Description */}
        <div>
          <label className={LABEL_CLASS}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add details about this milestone"
            className={TEXTAREA_CLASS}
          />
        </div>

        {/* Due Date */}
        <div>
          <label className={LABEL_CLASS}>
            Due date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className={INPUT_CLASS}
          />
          {dueDateError && <span className="text-xs text-red-600 mt-1 block">{dueDateError}</span>}
          {form.dueDate && projectEndDate && form.dueDate > projectEndDate && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mt-2">
              <Icon name="warning" size={13} className="shrink-0 mt-0.5" />
              <span>Due date exceeds project end date ({new Date(projectEndDate).toLocaleDateString()})</span>
            </div>
          )}
        </div>

        {/* Organization + Department pair */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isSuperAdmin && (
            <div>
              <label className={LABEL_CLASS}>Organization</label>
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

          <div className={isSuperAdmin ? "" : "sm:col-span-2"}>
            <label className={LABEL_CLASS}>Department</label>
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
        </div>

        {/* Progress (read-only when milestone has tasks) */}
        {isEditMode && hasTasks ? (
          <div>
            <label className={LABEL_CLASS}>Progress</label>
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
            <p className="text-[11px] text-indigo-500 mt-1">
              Progress is calculated from tasks
            </p>
          </div>
        ) : null}

        {/* Critical milestone toggle */}
        <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isCritical}
            onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <span className="inline-flex items-center gap-1.5">
            <Icon name="priority_high" size={14} className="text-red-500" />
            Mark as critical milestone
          </span>
        </label>

        {/* Errors */}
        {(bannerError || serverError) && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <Icon name="error" size={14} className="mt-0.5 shrink-0" />
            <span>{bannerError || serverError}</span>
          </div>
        )}

        {/* Hidden submit so Enter inside form submits */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Sheet>
  );
}
