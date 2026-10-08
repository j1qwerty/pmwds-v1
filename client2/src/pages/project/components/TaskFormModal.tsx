import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Department, Milestone, Project, Task, User } from "../../../types";
import { RoleKey, hasAnyRoleKey } from "../../../permissions";
import { priorities } from "../../constants";
import { Modal, ModalCancelButton, ModalPrimaryButton, AvatarStack, ScopedUserSelect, getProjectDepartmentIds } from "../../shared/index";

const getToday = () => new Date().toISOString().slice(0, 10);

interface TaskFormModalProps {
  open: boolean;
  initialData?: Task;
  defaultProjectId?: string;
  defaultMilestoneId?: string;
  projects: Project[];
  departments?: Department[];
  milestones: Milestone[];
  users: User[];
  organizationId?: string | null;
  roles?: string[];
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

interface FieldErrors {
  title?: string;
  projectId?: string;
  startDate?: string;
  dueDate?: string;
}

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const LABEL_CLASS =
  "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1";

export function TaskFormModal({
  open,
  initialData,
  defaultProjectId = "",
  defaultMilestoneId = "",
  projects,
  departments = [],
  milestones,
  users,
  organizationId,
  roles = [],
  onSubmit,
  onClose,
}: TaskFormModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: getToday(),
    dueDate: "",
    estimatedHours: 8,
    projectId: defaultProjectId,
    milestoneId: defaultMilestoneId,
    assignedToUserIds: [] as string[],
    priority: "Medium",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedMilestoneDueDate = useMemo(() => {
    if (!form.milestoneId) return "";
    const ms = milestones.find((m) => m.id === form.milestoneId);
    return ms?.dueDate?.slice(0, 10) || "";
  }, [form.milestoneId, milestones]);
  const initialMilestoneId = initialData?.milestoneId || defaultMilestoneId;
  const initialMilestoneDueDate = milestones.find((milestone) => milestone.id === initialMilestoneId)?.dueDate?.slice(0, 10) || "";

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm({
        title: initialData?.title || "",
        description: initialData?.description || "",
        startDate: initialData?.startDate?.slice(0, 10) || initialMilestoneDueDate || getToday(),
        dueDate: initialData?.dueDate?.slice(0, 10) || initialMilestoneDueDate,
        estimatedHours: initialData?.estimatedHours || 8,
        projectId: initialData?.projectId || defaultProjectId,
        milestoneId: initialMilestoneId,
        assignedToUserIds:
          initialData?.assignees?.map((a) => a.userId) ||
          (initialData?.assignedToUserId ? [initialData.assignedToUserId] : []),
        priority: initialData?.priority || "Medium",
      });
    }
  }, [open, initialData, defaultProjectId, initialMilestoneId, initialMilestoneDueDate]);

  const assignedUsers = useMemo(() => {
    return form.assignedToUserIds.map((id) => {
      const user = users.find((u) => u.id === id);
      return { id, fullName: user?.fullName ?? "Unknown", profilePictureUrl: user?.profilePictureUrl ?? null, isActive: user?.isActive ?? true };
    });
  }, [form.assignedToUserIds, users]);

  if (!open) return null;

  const canAssignMilestone = hasAnyRoleKey(roles, [RoleKey.SuperAdmin, RoleKey.Director]);
  const projectMilestones = milestones.filter((m) => m.projectId === form.projectId);
  const selectedProject = projects.find((p) => p.id === form.projectId);
  const selectedDepartment = selectedProject
    ? departments.find((d) => d.id === getProjectDepartmentIds(selectedProject)[0])
    : undefined;
  const projectDepartmentId = selectedProject
    ? getProjectDepartmentIds(selectedProject)[0]
    : undefined;

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!defaultProjectId && !form.projectId) errs.projectId = "Project is required";
    if (!form.startDate) errs.startDate = "Start date is required";
    if (!form.dueDate) errs.dueDate = "Due date is required";
    if (form.startDate && form.dueDate && form.startDate > form.dueDate)
      errs.dueDate = "Due date must be after start date";
    return errs;
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    const submission: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate,
      dueDate: form.dueDate,
      estimatedHours: form.estimatedHours,
      priority: form.priority,
      projectId: form.projectId,
      assignedToUserIds: form.assignedToUserIds,
    };
    if (form.milestoneId) submission.milestoneId = form.milestoneId;
    if (form.assignedToUserIds[0]) submission.assignedToUserId = form.assignedToUserIds[0];
    onSubmit(submission);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Task" : "New Task"}
      description="Track work to be done for this project"
      icon={initialData ? "edit" : "task_alt"}
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={initialData ? "Save Changes" : "Create Task"}
            icon="check"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className={LABEL_CLASS}>
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?"
            className={INPUT_CLASS}
            autoFocus
          />
          {errors.title && <span className="text-xs text-red-500 mt-1 block">{errors.title}</span>}
        </div>

        {/* Description */}
        <div>
          <label className={LABEL_CLASS}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add more details (optional)"
            className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-y"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={INPUT_CLASS}
            />
            {errors.startDate && <span className="text-xs text-red-500 mt-1 block">{errors.startDate}</span>}
            {form.startDate && selectedMilestoneDueDate && form.startDate !== selectedMilestoneDueDate && (
              <DateRangeWarning
                direction={form.startDate < selectedMilestoneDueDate ? "before" : "after"}
                milestoneDate={selectedMilestoneDueDate}
                label="Start date"
              />
            )}
          </div>
          <div>
            <label className={LABEL_CLASS}>Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={INPUT_CLASS}
            />
            {errors.dueDate && <span className="text-xs text-red-500 mt-1 block">{errors.dueDate}</span>}
            {form.dueDate && selectedMilestoneDueDate && form.dueDate !== selectedMilestoneDueDate && (
              <DateRangeWarning
                direction={form.dueDate < selectedMilestoneDueDate ? "before" : "after"}
                milestoneDate={selectedMilestoneDueDate}
                label="Due date"
              />
            )}
          </div>
        </div>

        {/* Priority + Project row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={INPUT_CLASS}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {!defaultProjectId && (
            <div>
              <label className={LABEL_CLASS}>
                Project <span className="text-red-500">*</span>
              </label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value, milestoneId: "" })}
                className={INPUT_CLASS}
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.projectId && <span className="text-xs text-red-500 mt-1 block">{errors.projectId}</span>}
            </div>
          )}
        </div>

        {/* Milestone */}
        {canAssignMilestone && (
          <div>
            <label className={LABEL_CLASS}>Milestone</label>
            <select
              value={form.milestoneId || ""}
              onChange={(e) => {
                const v = e.target.value;
                const milestoneDate = milestones.find((milestone) => milestone.id === v)?.dueDate?.slice(0, 10) || "";
                setForm((current) => ({
                  ...current,
                  milestoneId: v,
                  ...(!initialData && milestoneDate ? { startDate: milestoneDate, dueDate: milestoneDate } : {}),
                }));
              }}
              className={INPUT_CLASS}
            >
              <option value="">None</option>
              {projectMilestones.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Blocked milestone warning */}
        {form.milestoneId && (() => {
          const selectedMilestone = milestones.find((m) => m.id === form.milestoneId);
          if (selectedMilestone?.isBlocked) {
            return (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">warning</span>
                <div className="text-xs text-amber-800">
                  <span className="font-semibold">Milestone is blocked:</span>
                  <p>{selectedMilestone.blockedByMessage}</p>
                  <p className="text-[10px] text-amber-600 mt-1">
                    Tasks can still be created but the milestone cannot progress until dependencies are met.
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Assignees summary chip */}
        {assignedUsers.length > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs w-fit">
            <AvatarStack people={assignedUsers} size="xs" />
            <span className="text-slate-600 font-medium truncate max-w-50">
              {assignedUsers.map((u, i) => (
                <span key={u.id} className={u.isActive === false ? "text-red-500" : ""}>{i > 0 ? ", " : ""}{u.fullName}</span>
              ))}
            </span>
          </div>
        )}

        {/* Assignee picker (kept as-is — already matches the design language) */}
        <ScopedUserSelect
          users={users}
          values={form.assignedToUserIds}
          organizationId={organizationId ?? selectedDepartment?.organizationId}
          departmentId={projectDepartmentId}
          label="Assignees"
          multiple
          onChange={(userId) => setForm({ ...form, assignedToUserIds: userId ? [userId] : [] })}
          onMultiChange={(assignedToUserIds) => setForm({ ...form, assignedToUserIds })}
        />

        {/* Hidden submit so Enter inside form submits */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Modal>
  );
}

function DateRangeWarning({
  direction,
  milestoneDate,
  label,
}: {
  direction: "before" | "after";
  milestoneDate: string;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
      <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
      <span>
        {label} {direction === "before" ? "precedes" : "exceeds"} milestone date ({new Date(milestoneDate).toLocaleDateString()}).
      </span>
    </div>
  );
}
