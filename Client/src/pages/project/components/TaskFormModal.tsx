import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Department, Milestone, Project, Task, User } from "../../../types";
import { RoleKey, hasAnyRoleKey } from "../../../permissions";
import { priorities } from "../../constants";
import { ModalOverlay, InputF, SelectF, AvatarStack, ScopedUserSelect, getProjectDepartmentIds } from "../../shared/index";

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
  estimatedHours?: string;
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

  useEffect(() => {
    if (open) {
      setErrors({});
      const editing = !!initialData;
      setForm({
        title: initialData?.title || "",
        description: initialData?.description || "",
        startDate: initialData?.startDate?.slice(0, 10) || getToday(),
        dueDate: initialData?.dueDate?.slice(0, 10) || ((!editing && selectedMilestoneDueDate) ? selectedMilestoneDueDate : ""),
        estimatedHours: initialData?.estimatedHours || 8,
        projectId: initialData?.projectId || defaultProjectId,
        milestoneId: initialData?.milestoneId || defaultMilestoneId,
        assignedToUserIds:
          initialData?.assignees?.map((a) => a.userId) ||
          (initialData?.assignedToUserId ? [initialData.assignedToUserId] : []),
        priority: initialData?.priority || "Medium",
      });
    }
  }, [open, initialData, defaultProjectId, defaultMilestoneId, selectedMilestoneDueDate]);

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
    if (form.estimatedHours < 1) errs.estimatedHours = "Must be at least 1 hour";
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
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
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 text-2xl">{initialData ? "edit" : "add_task"}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{initialData ? "Edit Task" : "New Task"}</h2>
           
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <InputF label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
            {errors.title && <span className="text-xs text-red-500 mt-1 block">{errors.title}</span>}
            
          </div>
          <InputF label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputF label="Start" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} />
              {errors.startDate && <span className="text-xs text-red-500 mt-1 block">{errors.startDate}</span>}
            </div>
            <div>
              <InputF label="Due" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
              {errors.dueDate && <span className="text-xs text-red-500 mt-1 block">{errors.dueDate}</span>}
              {form.dueDate && selectedMilestoneDueDate && form.dueDate > selectedMilestoneDueDate && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                  <span>Due date exceeds milestone due date ({new Date(selectedMilestoneDueDate).toLocaleDateString()})</span>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputF label="Est. hours" type="number" value={form.estimatedHours} onChange={(v) => setForm({ ...form, estimatedHours: Number(v) })} />
              {errors.estimatedHours && <span className="text-xs text-red-500 mt-1 block">{errors.estimatedHours}</span>}
            </div>
            <SelectF
              label="Priority"
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
              options={priorities.map((p) => ({ value: p, label: p }))}
            />
          </div>
          {!defaultProjectId && (
            <div>
              <SelectF
                label="Project"
                value={form.projectId}
                onChange={(v) => setForm({ ...form, projectId: v, milestoneId: "" })}
                options={[{ value: "", label: "Select project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
              />
              {errors.projectId && <span className="text-xs text-red-500 mt-1 block">{errors.projectId}</span>}
            </div>
          )}
          {canAssignMilestone && (
            <SelectF
              label="Milestone"
              value={form.milestoneId || ""}
              onChange={(v) => setForm({ ...form, milestoneId: v })}
              options={[{ value: "", label: "None" }, ...projectMilestones.map((m) => ({ value: m.id, label: m.name }))]}
            />
          )}
          {form.milestoneId && (() => {
            const selectedMilestone = milestones.find((m) => m.id === form.milestoneId);
            if (selectedMilestone?.isBlocked) {
              return (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2">
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
          {assignedUsers.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs w-fit">
              <AvatarStack people={assignedUsers} size="xs" />
              <span className="text-slate-600 font-medium truncate max-w-50">
                {assignedUsers.map((u, i) => (
                  <span key={u.id} className={u.isActive === false ? "text-red-500" : ""}>{i > 0 ? ", " : ""}{u.fullName}</span>
                ))}
              </span>
            </div>
          )}
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
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
