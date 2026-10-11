import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Department, Milestone, Project, Task, User } from "../../../types";
import { RoleKey, hasAnyRoleKey } from "../../../permissions";
import { priorities } from "../../constants";
import { Sheet, ModalCancelButton, ModalPrimaryButton, AvatarStack, ScopedUserSelect, getProjectDepartmentIds } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

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

  // Sheet handles open/closed internally (stays mounted so the exit animation plays)
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
            {form.startDate && selectedMilestoneDueDate && form.startDate !== selectedMilestoneDueDate && (
              <DateRangeWarning
                direction={form.startDate < selectedMilestoneDueDate ? "before" : "after"}
                milestoneDate={selectedMilestoneDueDate}
                label="Start date"
              />
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
            {form.dueDate && selectedMilestoneDueDate && form.dueDate !== selectedMilestoneDueDate && (
              <DateRangeWarning
                direction={form.dueDate < selectedMilestoneDueDate ? "before" : "after"}
                milestoneDate={selectedMilestoneDueDate}
                label="Due date"
              />
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
          departmentId={projectDepartmentId}
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
      <Icon name="warning" size={13} className="shrink-0 mt-0.5" />
      <span>
        {label} {direction === "before" ? "precedes" : "exceeds"} milestone date ({new Date(milestoneDate).toLocaleDateString()}).
      </span>
    </div>
  );
}
