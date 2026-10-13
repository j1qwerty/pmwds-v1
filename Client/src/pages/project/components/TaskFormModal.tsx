import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Department, Milestone, Project, Task, User } from "../../../types";
import { priorities } from "../../constants";
import { Sheet, ModalCancelButton, ModalPrimaryButton, AvatarStack, ScopedUserSelect, getProjectDepartmentIds, usePermission } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";
import {
  clampToWindow,
  formatDate,
  taskScheduleWindow,
  todayInputValue,
  validateTaskSchedule,
  type ScheduleViolation,
  type TaskScheduleWindow,
} from "../../../lib/datetime";

// "Today" in IST. `new Date().toISOString()` gives the UTC day, so between midnight and
// 05:30 IST the form opened pre-filled with tomorrow.
const getToday = () => todayInputValue();

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
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const TEXTAREA_CLASS =
  "w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-y";

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5";

/** Divider + label row used to separate modal form sections */
function SectionLabel({ icon, children }: { icon: string; children: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <Icon name={icon} size={13} className="text-slate-400 shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
        {children}
      </span>
      <span className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

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

  // A milestone has one date of its own: its due date. A task has a start and a due date, so
  // the pair is checked against the *span* the milestone allows - from the milestone's
  // creation date through to its due date - rather than against that single date. The old
  // check compared each task date for inequality with the milestone date, so any task that
  // did not land on exactly that one day raised a warning.
  const selectedProject = projects.find((p) => p.id === form.projectId);
  const selectedMilestone = useMemo(
    () => milestones.find((m) => m.id === form.milestoneId) ?? null,
    [form.milestoneId, milestones],
  );
  const scheduleWindow = useMemo(
    () => taskScheduleWindow(selectedMilestone, selectedProject),
    [selectedMilestone, selectedProject],
  );
  const scheduleViolation = useMemo(
    () => validateTaskSchedule(form.startDate, form.dueDate, scheduleWindow),
    [form.startDate, form.dueDate, scheduleWindow],
  );

  const initialMilestoneId = initialData?.milestoneId || defaultMilestoneId;
  const initialMilestone = useMemo(
    () => milestones.find((milestone) => milestone.id === initialMilestoneId) ?? null,
    [initialMilestoneId, milestones],
  );

  useEffect(() => {
    if (open) {
      setErrors({});
      // Default the pair to a date the milestone actually allows, so opening the form never
      // presents a warning the user has to clear.
      const window = taskScheduleWindow(initialMilestone, selectedProject);
      const start = clampToWindow(
        initialData?.startDate?.slice(0, 10) || getToday(),
        window,
      );
      setForm({
        title: initialData?.title || "",
        description: initialData?.description || "",
        startDate: start,
        dueDate: clampToWindow(
          initialData?.dueDate?.slice(0, 10) || window.latestDue || start,
          window,
        ),
        estimatedHours: initialData?.estimatedHours || 8,
        projectId: initialData?.projectId || defaultProjectId,
        milestoneId: initialMilestoneId,
        assignedToUserIds:
          initialData?.assignees?.map((a) => a.userId) ||
          (initialData?.assignedToUserId ? [initialData.assignedToUserId] : []),
        priority: initialData?.priority || "Medium",
      });
    }
  }, [
    open,
    initialData,
    defaultProjectId,
    initialMilestone,
    selectedProject,
  ]);

  const assignedUsers = useMemo(() => {
    return form.assignedToUserIds.map((id) => {
      const user = users.find((u) => u.id === id);
      return { id, fullName: user?.fullName ?? "Unknown", profilePictureUrl: user?.profilePictureUrl ?? null, isActive: user?.isActive ?? true };
    });
  }, [form.assignedToUserIds, users]);

  // Sheet handles open/closed internally (stays mounted so the exit animation plays)
  const perm = usePermission();
  // Assigning is TASK_ASSIGN, not a create/edit proxy: the server's TaskEditor
  // policy accepts TaskAssign (and TaskManage holders expand down to it via the
  // coverage map), but a create-only or edit-only grant must not see the
  // assignee field. SuperAdmin is the only role short-circuit.
  const canAssignMilestone =
    perm.isSuperAdmin || perm.canModule("assign", "task");
  const projectMilestones = milestones.filter((m) => m.projectId === form.projectId);
  // Every department the project spans, not just the first. Narrowing to
  // `getProjectDepartmentIds(project)[0]` left the picker at "0 users" whenever
  // the caller's own department happened not to be that one — which is the
  // normal case for a multi-department project, because the order comes from
  // the project record rather than from anything meaningful.
  const projectDepartmentIds = selectedProject ? getProjectDepartmentIds(selectedProject) : [];
  const selectedDepartment = departments.find((d) => d.id === projectDepartmentIds[0]);

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

  const handleSubmit = async (e?: FormEvent) => {
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
    // Awaited + reset in finally so a slow/failing save can't wedge the
    // footer button on its loading state (same bug as MilestoneFormModal).
    try {
      await onSubmit(submission);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initialData ? "Edit task" : "New task"}
      description="Track work to be done for this project"
      icon={initialData ? "edit" : "check-circle"}
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label={initialData ? "Save changes" : "Create task"}
            icon="check"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Details ───────────────────────────────────────── */}
        <div className="space-y-4">
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
            {errors.title && <span className="text-xs text-red-600 mt-1 block">{errors.title}</span>}
          </div>

          <div>
            <label className={LABEL_CLASS}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add more details (optional)"
              className={TEXTAREA_CLASS}
            />
          </div>
        </div>

        {/* ── Schedule ──────────────────────────────────────── */}
        <SectionLabel icon="calendar">Schedule</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL_CLASS}>Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className={INPUT_CLASS}
            />
            {errors.startDate && <span className="text-xs text-red-600 mt-1 block">{errors.startDate}</span>}
            {scheduleViolation?.field === "startDate" && (
              <ScheduleWarning violation={scheduleViolation} window={scheduleWindow} label="Start date" />
            )}
          </div>
          <div>
            <label className={LABEL_CLASS}>Due date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={INPUT_CLASS}
            />
            {errors.dueDate && <span className="text-xs text-red-600 mt-1 block">{errors.dueDate}</span>}
            {scheduleViolation?.field === "dueDate" && (
              <ScheduleWarning violation={scheduleViolation} window={scheduleWindow} label="Due date" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {errors.projectId && <span className="text-xs text-red-600 mt-1 block">{errors.projectId}</span>}
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
                // Picking a milestone seeds the schedule with a valid pair rather than
                // pinning both dates to the milestone's single due date, which used to
                // make every task look due on exactly the milestone day.
                const window = taskScheduleWindow(
                  milestones.find((milestone) => milestone.id === v) ?? null,
                  selectedProject,
                );
                setForm((current) => {
                  if (initialData) return { ...current, milestoneId: v };
                  const start = clampToWindow(current.startDate || getToday(), window);
                  return {
                    ...current,
                    milestoneId: v,
                    startDate: start,
                    dueDate: clampToWindow(current.dueDate || window.latestDue || start, window),
                  };
                });
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
                <Icon name="warning" size={14} className="text-amber-600 mt-0.5 shrink-0" />
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

        {/* ── Assignment ────────────────────────────────────── */}
        <SectionLabel icon="group">Assignment</SectionLabel>

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
          departmentIds={projectDepartmentIds}
          label="Assignees"
          multiple
          onChange={(userId) => setForm({ ...form, assignedToUserIds: userId ? [userId] : [] })}
          onMultiChange={(assignedToUserIds) => setForm({ ...form, assignedToUserIds })}
        />

        {/* Hidden submit so Enter inside form submits */}
        <button type="submit" className="hidden" aria-hidden="true" />
      </form>
    </Sheet>
  );
}

function ScheduleWarning({
  violation,
  window,
  label,
}: {
  violation: Exclude<ScheduleViolation, null>;
  window: TaskScheduleWindow;
  label: string;
}) {
  const message =
    violation.kind === "before-window"
      ? `${label} is before this milestone was created (${formatDate(window.earliestStart)}).`
      : `${label} is after the milestone due date (${formatDate(window.latestDue)}).`;

  return (
    <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
      <Icon name="warning" size={13} className="shrink-0 mt-0.5" />
      <span>
        {message} Tasks in this milestone can run from {formatDate(window.earliestStart)} to{" "}
        {formatDate(window.latestDue)}.
      </span>
    </div>
  );
}
