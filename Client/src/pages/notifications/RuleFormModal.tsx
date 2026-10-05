import { useState, useEffect, type FormEvent } from "react";
import type { AlertRuleRecord } from "../../types";

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
    actionParameters: typeof initialData?.actionParameters === "string" 
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
        actionParameters: typeof initialData.actionParameters === "string" 
          ? initialData.actionParameters 
          : JSON.stringify(initialData.actionParameters || {}, null, 2),
        isEnabled: initialData.isEnabled ?? true,
      });
    }
  }, [initialData]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="bg-white rounded-2xl p-8 w-[560px] max-w-[95vw] shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
          <span className="material-symbols-outlined text-indigo-600 text-2xl">
            {initialData ? "edit" : "rule"}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? "Edit Alert Rule" : "Create Alert Rule"}
          </h2>
          <p className="text-sm text-slate-500">Define automated notification conditions and actions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Rule Name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g., High Priority Task Alert" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Condition Type *</label>
          <input value={form.conditionType} onChange={(e) => setForm({ ...form, conditionType: e.target.value })} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g., task_priority" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Condition Expression</label>
          <textarea value={form.conditionExpression} onChange={(e) => setForm({ ...form, conditionExpression: e.target.value })} rows={3} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono" placeholder='{"priority": "high"}' />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Action Type *</label>
          <input value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g., send_notification" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Action Parameters (JSON)</label>
          <textarea value={form.actionParameters} onChange={(e) => setForm({ ...form, actionParameters: e.target.value })} rows={5} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono" placeholder='{"channel": "in_app", "template": "alert"}' />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span>Rule enabled</span>
        </label>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={submitting || !form.name || !form.conditionType || !form.actionType} className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Saving..." : (initialData ? "Update Rule" : "Create Rule")}
          </button>
        </div>
      </form>
    </div>
  );
}