import { useState, useEffect } from "react";
import type { AlertRuleRecord } from "../../types";
import {
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
} from "../shared";

interface RuleFormModalProps {
  initialData?: AlertRuleRecord;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function RuleFormModal({ initialData, onSubmit, onCancel }: RuleFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
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

  const handleSave = () => {
    if (submitting) return;
    setSubmitting(true);
    let actionParams;
    try {
      actionParams = JSON.parse(form.actionParameters);
    } catch {
      actionParams = {};
    }
    onSubmit({
      name: form.name,
      conditionType: form.conditionType,
      conditionExpression: form.conditionExpression,
      actionType: form.actionType,
      actionParameters: actionParams,
      isEnabled: form.isEnabled,
    });
  };

  const canSubmit =
    !!form.name.trim() && !!form.conditionType.trim() && !!form.actionType.trim();

  return (
    <Modal
      open
      onClose={onCancel}
      title={initialData ? "Edit Alert Rule" : "Create Alert Rule"}
      description="Define automated notification conditions and actions"
      icon={initialData ? "edit" : "rule"}
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={handleSave}
            loading={submitting}
            disabled={!canSubmit}
            label={initialData ? "Update Rule" : "Create Rule"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Rule Name *
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., High Priority Task Alert"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Condition Type *
            </label>
            <input
              value={form.conditionType}
              onChange={(e) => setForm({ ...form, conditionType: e.target.value })}
              placeholder="e.g., task_priority"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Action Type *
            </label>
            <input
              value={form.actionType}
              onChange={(e) => setForm({ ...form, actionType: e.target.value })}
              placeholder="e.g., send_notification"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Condition Expression
          </label>
          <textarea
            value={form.conditionExpression}
            onChange={(e) => setForm({ ...form, conditionExpression: e.target.value })}
            rows={3}
            placeholder='{"priority": "high"}'
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Action Parameters (JSON)
          </label>
          <textarea
            value={form.actionParameters}
            onChange={(e) => setForm({ ...form, actionParameters: e.target.value })}
            rows={5}
            placeholder='{"channel": "in_app", "template": "alert"}'
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="font-medium">Rule enabled</span>
        </label>
      </div>
    </Modal>
  );
}
