import { useEffect, useId, useState, type ReactNode } from "react";
import type { AlertRuleRecord } from "../../types";
import {
  Sheet,
  ModalCancelButton,
  ModalPrimaryButton,
  useToast,
} from "../shared";

interface RuleFormModalProps {
  initialData?: AlertRuleRecord;
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

export function RuleFormModal({ initialData, onSubmit, onCancel }: RuleFormModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || "",
    conditionType: initialData?.conditionType || "",
    conditionExpression: initialData?.conditionExpression || "",
    actionType: initialData?.actionType || "",
    actionParameters:
      typeof initialData?.actionParameters === "string"
        ? initialData.actionParameters
        : JSON.stringify(initialData?.actionParameters || {}, null, 2),
    isEnabled: initialData?.isEnabled ?? true,
  });

  const nameId = useId();
  const conditionTypeId = useId();
  const actionTypeId = useId();
  const conditionExpressionId = useId();
  const actionParametersId = useId();
  const enabledId = useId();

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        conditionType: initialData.conditionType || "",
        conditionExpression: initialData.conditionExpression || "",
        actionType: initialData.actionType || "",
        actionParameters:
          typeof initialData.actionParameters === "string"
            ? initialData.actionParameters
            : JSON.stringify(initialData.actionParameters || {}, null, 2),
        isEnabled: initialData.isEnabled ?? true,
      });
    }
  }, [initialData]);

  // Non-blocking JSON check: invalid parameters are still saved as {} (unchanged
  // behaviour), the editor just gets an honest warning instead of silence.
  const parametersTrimmed = form.actionParameters.trim();
  let jsonWarning: string | undefined;
  if (parametersTrimmed) {
    try {
      JSON.parse(parametersTrimmed);
    } catch {
      jsonWarning = "Invalid JSON — parameters will be saved as an empty object.";
    }
  }

  const nameError = submitted && !form.name.trim() ? "Rule name is required." : undefined;
  const conditionTypeError =
    submitted && !form.conditionType.trim() ? "Condition type is required." : undefined;
  const actionTypeError = submitted && !form.actionType.trim() ? "Action type is required." : undefined;

  const handleSave = async () => {
    if (submitting) return;
    setSubmitted(true);
    if (!form.name.trim() || !form.conditionType.trim() || !form.actionType.trim()) return;
    setSubmitting(true);
    let actionParams;
    try {
      actionParams = JSON.parse(form.actionParameters);
    } catch {
      actionParams = {};
    }
    try {
      await onSubmit({
        name: form.name,
        conditionType: form.conditionType,
        conditionExpression: form.conditionExpression,
        actionType: form.actionType,
        actionParameters: actionParams,
        isEnabled: form.isEnabled,
      });
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to save alert rule", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title={initialData ? "Edit alert rule" : "New alert rule"}
      description="Define the condition that triggers a notification and the action to run"
      icon={initialData ? "edit" : "rule"}
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => void handleSave()}
            loading={submitting}
            label={initialData ? "Update rule" : "Create rule"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Rule name" htmlFor={nameId} required error={nameError}>
          <input
            id={nameId}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., High priority task alert"
            aria-invalid={nameError ? true : undefined}
            className={`${inputCls} ${nameError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Condition type" htmlFor={conditionTypeId} required error={conditionTypeError}>
            <input
              id={conditionTypeId}
              value={form.conditionType}
              onChange={(e) => setForm({ ...form, conditionType: e.target.value })}
              placeholder="e.g., task_priority"
              aria-invalid={conditionTypeError ? true : undefined}
              className={`${inputCls} ${conditionTypeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
          </Field>
          <Field label="Action type" htmlFor={actionTypeId} required error={actionTypeError}>
            <input
              id={actionTypeId}
              value={form.actionType}
              onChange={(e) => setForm({ ...form, actionType: e.target.value })}
              placeholder="e.g., send_notification"
              aria-invalid={actionTypeError ? true : undefined}
              className={`${inputCls} ${actionTypeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
          </Field>
        </div>

        <Field
          label="Condition expression"
          htmlFor={conditionExpressionId}
          hint="JSON expression evaluated against the triggering event."
        >
          <textarea
            id={conditionExpressionId}
            value={form.conditionExpression}
            onChange={(e) => setForm({ ...form, conditionExpression: e.target.value })}
            rows={3}
            placeholder='{"priority": "high"}'
            className={monoTextareaCls}
          />
        </Field>

        <Field
          label="Action parameters"
          htmlFor={actionParametersId}
          hint="JSON object passed to the action when the rule triggers."
        >
          <textarea
            id={actionParametersId}
            value={form.actionParameters}
            onChange={(e) => setForm({ ...form, actionParameters: e.target.value })}
            rows={5}
            placeholder='{"channel": "in_app", "template": "alert"}'
            className={monoTextareaCls}
          />
          {jsonWarning && <p className="mt-1 text-xs text-amber-600">{jsonWarning}</p>}
        </Field>

        <label
          htmlFor={enabledId}
          className="mt-1 flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 transition-colors hover:border-slate-300"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-700">Rule enabled</span>
            <span className="block text-xs text-slate-400">
              Disabled rules stay configured but never trigger notifications.
            </span>
          </span>
          <input
            id={enabledId}
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
            className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
          />
        </label>
      </div>
    </Sheet>
  );
}
