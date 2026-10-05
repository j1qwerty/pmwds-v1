import { useEffect, useState, type FormEvent } from "react";
import type { Task, User } from "../../../types";
import { priorities } from "../../constants";
import { ModalOverlay, InputF, SelectF, ScopedUserSelect } from "../../shared";

interface SubtaskFormModalProps {
  open: boolean;
  parentTask: Task;
  users: User[];
  organizationId?: string | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function SubtaskFormModal({
  open,
  parentTask,
  users,
  organizationId,
  onSubmit,
  onClose,
}: SubtaskFormModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignedToUserId: "",
    priority: "Medium",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSubmitting(false);
      setForm({
        title: "",
        description: "",
        dueDate: parentTask.dueDate?.slice(0, 10) || "",
        assignedToUserId: "",
        priority: "Medium",
      });
    }
  }, [open, parentTask.dueDate]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !form.title.trim()) return;
    setSubmitting(true);
    const submission: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      projectId: parentTask.projectId,
      milestoneId: parentTask.milestoneId,
      startDate: new Date().toISOString(),
    };
    if (form.dueDate) submission.dueDate = form.dueDate;
    if (form.assignedToUserId) {
      submission.assignedToUserId = form.assignedToUserId;
      submission.assignedToUserIds = [form.assignedToUserId];
    }
    onSubmit(submission);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
         
          <div>
            <h2 className="text-xl font-bold text-slate-900">New Subtask</h2>
            <p className="text-sm text-slate-500">
              for <span className="font-semibold text-indigo-600">{parentTask.title}</span>
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <InputF label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          <InputF label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <InputF label="Due" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} />
              {form.dueDate && parentTask.dueDate && form.dueDate > parentTask.dueDate.slice(0, 10) && (
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                  <span>Due date exceeds parent task due date ({new Date(parentTask.dueDate).toLocaleDateString()})</span>
                </div>
              )}
            </div>
            <SelectF
              label="Priority"
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
              options={priorities.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <ScopedUserSelect
            users={users}
            value={form.assignedToUserId || ""}
            organizationId={organizationId}
            label="Assignee"
            onChange={(userId) => setForm({ ...form, assignedToUserId: userId })}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !form.title.trim()} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Saving..." : "Create Subtask"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
