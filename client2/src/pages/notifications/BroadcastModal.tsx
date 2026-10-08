import { useId, useState, type ReactNode } from "react";
import type { Department } from "../../types";
import {
  Sheet,
  ModalCancelButton,
  ModalPrimaryButton,
  useToast,
} from "../shared";

interface BroadcastModalProps {
  departments: Department[];
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-colors";
const textareaCls =
  "w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-colors resize-y";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-slate-400";

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <label htmlFor={htmlFor} className={labelCls}>
          {label}
        </label>
        {required && (
          <span aria-hidden="true" className="text-[11px] font-bold text-red-500">
            *
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function BroadcastModal({ departments, onSubmit, onCancel }: BroadcastModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    departmentId: "",
    actionUrl: "",
  });

  const titleId = useId();
  const messageId = useId();
  const departmentId = useId();
  const actionUrlId = useId();

  const titleError = submitted && !form.title.trim() ? "Title is required." : undefined;
  const messageError = submitted && !form.message.trim() ? "Message is required." : undefined;

  const handleSave = async () => {
    if (submitting) return;
    setSubmitted(true);
    if (!form.title.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        departmentId: form.departmentId || null,
        actionUrl: form.actionUrl || null,
      });
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to send broadcast", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title="New broadcast"
      description="Send an announcement to all users or a single department"
      icon="hi-speakerphone"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSave()}
            loading={submitting}
            label="Send broadcast"
            icon="share"
          />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor={titleId} required error={titleError}>
          <input
            id={titleId}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Important announcement"
            aria-invalid={titleError ? true : undefined}
            className={`${inputCls} ${titleError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
          />
        </Field>

        <Field label="Message" htmlFor={messageId} required error={messageError}>
          <textarea
            id={messageId}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            placeholder="Notification message content..."
            aria-invalid={messageError ? true : undefined}
            className={`${textareaCls} ${messageError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Department scope"
            htmlFor={departmentId}
            hint="Leave on all departments to notify everyone."
          >
            <select
              id={departmentId}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className={inputCls}
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Action URL" htmlFor={actionUrlId} hint="Optional link the notification opens.">
            <input
              id={actionUrlId}
              value={form.actionUrl}
              onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
              placeholder="https://example.com/action"
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
