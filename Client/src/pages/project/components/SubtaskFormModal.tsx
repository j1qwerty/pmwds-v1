import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Task, User } from "../../../types";
import { priorities } from "../../constants";
import { Sheet, ModalCancelButton, ModalPrimaryButton, ScopedUserSelect } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

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
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubmitting(false);
      setShowErrors(false);
      setForm({
        title: "",
        description: "",
        dueDate: parentTask.dueDate?.slice(0, 10) || "",
        assignedToUserId: "",
        priority: "Medium",
      });
    }
  }, [open, parentTask.dueDate]);

  // Sheet handles open/closed internally (stays mounted so the exit animation plays)
  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    setShowErrors(true);
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

  const dueDateExceedsParent =
    form.dueDate && parentTask.dueDate && form.dueDate > parentTask.dueDate.slice(0, 10);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New subtask"
      description={
        <>
          for <span className="font-semibold text-indigo-600">{parentTask.title}</span>
        </>
      }
      icon="account_tree"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            disabled={!form.title.trim()}
            label="Create subtask"
            icon="check-circle"
          />
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title" required>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            placeholder="What needs to be done?"
            className={INPUT_CLASS}
            autoFocus
          />
          {showErrors && !form.title.trim() && (
            <span className="text-xs text-red-600 mt-1 block">Title is required</span>
          )}
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Add more details (optional)"
            className={TEXTAREA_CLASS}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={INPUT_CLASS}
            />
            {dueDateExceedsParent && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-[10px] text-amber-800 leading-relaxed">
                <Icon name="warning" size={12} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Exceeds parent task due date ({new Date(parentTask.dueDate!).toLocaleDateString()})
                </span>
              </div>
            )}
          </Field>

          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={INPUT_CLASS}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <ScopedUserSelect
          users={users}
          value={form.assignedToUserId || ""}
          organizationId={organizationId}
          label="Assignee"
          onChange={(userId) => setForm({ ...form, assignedToUserId: userId })}
        />

        {/* Hidden submit input so pressing Enter triggers the form onSubmit */}
        <input type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}

const INPUT_CLASS =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const TEXTAREA_CLASS =
  "w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
