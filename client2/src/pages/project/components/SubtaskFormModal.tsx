import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Task, User } from "../../../types";
import { priorities } from "../../constants";
import { Modal, ModalCancelButton, ModalPrimaryButton, ScopedUserSelect } from "../../shared/index";
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

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
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
    <Modal
      open={true}
      onClose={onClose}
      title="New Subtask"
      description={
        <>
          for <span className="font-semibold text-indigo-600">{parentTask.title}</span>
        </>
      }
      icon="hi-clipboard"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            disabled={!form.title.trim()}
            label={submitting ? "Saving..." : "Create Subtask"}
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
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
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
    </Modal>
  );
}

const INPUT_CLASS =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
