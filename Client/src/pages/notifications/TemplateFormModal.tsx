import { useEffect, useId, useState, type ReactNode } from "react";
import type { NotificationTemplateRecord } from "../../types";
import {
  Sheet,
  ModalCancelButton,
  ModalPrimaryButton,
  useToast,
} from "../shared";

interface TemplateFormModalProps {
  initialData?: NotificationTemplateRecord;
  onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-colors";
const textareaCls =
  "w-full min-h-[80px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-colors resize-y";
const monoTextareaCls = `${textareaCls} font-mono`;
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

export function TemplateFormModal({ initialData, onSubmit, onCancel }: TemplateFormModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    templateType: initialData?.templateType || "",
    subjectTemplate: initialData?.subjectTemplate || "",
    bodyTemplate: initialData?.bodyTemplate || "",
    variables: initialData?.variables?.join("\n") || "",
    supportedChannels: initialData?.supportedChannels?.join("\n") || "",
  });

  const templateTypeId = useId();
  const subjectTemplateId = useId();
  const bodyTemplateId = useId();
  const variablesId = useId();
  const supportedChannelsId = useId();

  useEffect(() => {
    if (initialData) {
      setForm({
        templateType: initialData.templateType || "",
        subjectTemplate: initialData.subjectTemplate || "",
        bodyTemplate: initialData.bodyTemplate || "",
        variables: initialData.variables?.join("\n") || "",
        supportedChannels: initialData.supportedChannels?.join("\n") || "",
      });
    }
  }, [initialData]);

  const templateTypeError =
    submitted && !form.templateType.trim() ? "Template type is required." : undefined;
  const subjectError =
    submitted && !form.subjectTemplate.trim() ? "Subject template is required." : undefined;

  const handleSave = async () => {
    if (submitting) return;
    setSubmitted(true);
    if (!form.templateType.trim() || !form.subjectTemplate.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        templateType: form.templateType,
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        variables: form.variables.split("\n").filter((v) => v.trim()),
        supportedChannels: form.supportedChannels.split("\n").filter((c) => c.trim()),
      });
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to save template", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title={initialData ? "Edit template" : "New template"}
      description="Define the subject and body with {{variables}} for consistent messaging"
      icon={initialData ? "edit" : "description"}
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSave()}
            loading={submitting}
            label={initialData ? "Update template" : "Create template"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Template type" htmlFor={templateTypeId} required error={templateTypeError}>
            <input
              id={templateTypeId}
              value={form.templateType}
              onChange={(e) => setForm({ ...form, templateType: e.target.value })}
              placeholder="e.g., task_reminder"
              aria-invalid={templateTypeError ? true : undefined}
              className={`${inputCls} ${templateTypeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
          </Field>
          <Field label="Subject template" htmlFor={subjectTemplateId} required error={subjectError}>
            <input
              id={subjectTemplateId}
              value={form.subjectTemplate}
              onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
              placeholder="Task reminder: {{taskName}}"
              aria-invalid={subjectError ? true : undefined}
              className={`${inputCls} ${subjectError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
          </Field>
        </div>

        <Field
          label="Body template"
          htmlFor={bodyTemplateId}
          hint="Variables in double braces are replaced when the notification is sent."
        >
          <textarea
            id={bodyTemplateId}
            value={form.bodyTemplate}
            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
            rows={5}
            placeholder="Hello {{userName}}, this is a reminder for {{taskName}}..."
            className={textareaCls}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Variables" htmlFor={variablesId} hint="One variable name per line.">
            <textarea
              id={variablesId}
              value={form.variables}
              onChange={(e) => setForm({ ...form, variables: e.target.value })}
              rows={4}
              placeholder={"userName\ntaskName\ndueDate"}
              className={monoTextareaCls}
            />
          </Field>
          <Field label="Supported channels" htmlFor={supportedChannelsId} hint="One channel per line.">
            <textarea
              id={supportedChannelsId}
              value={form.supportedChannels}
              onChange={(e) => setForm({ ...form, supportedChannels: e.target.value })}
              rows={4}
              placeholder={"in_app\nemail\npush"}
              className={monoTextareaCls}
            />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
