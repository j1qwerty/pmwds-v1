import { useState, useEffect, type FormEvent } from "react";
import type { NotificationTemplateRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";

interface TemplateFormModalProps {
  initialData?: NotificationTemplateRecord;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function TemplateFormModal({ initialData, onSubmit, onCancel }: TemplateFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    templateType: initialData?.templateType || "",
    subjectTemplate: initialData?.subjectTemplate || "",
    bodyTemplate: initialData?.bodyTemplate || "",
    variables: initialData?.variables?.join("\n") || "",
    supportedChannels: initialData?.supportedChannels?.join("\n") || "",
  });

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      templateType: form.templateType,
      subjectTemplate: form.subjectTemplate,
      bodyTemplate: form.bodyTemplate,
      variables: form.variables.split("\n").filter(v => v.trim()),
      supportedChannels: form.supportedChannels.split("\n").filter(c => c.trim()),
    });
  };

  return (
    <div className="bg-white rounded-2xl p-8 w-[560px] max-w-[95vw] shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Icon name={initialData ? "edit" : "description"} size={22} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? "Edit Template" : "Create Template"}
          </h2>
          <p className="text-sm text-slate-500">Configure notification template with variables and channels</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Template Type *</label>
          <input value={form.templateType} onChange={(e) => setForm({ ...form, templateType: e.target.value })} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g., task_reminder" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Subject Template *</label>
          <input value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} required className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Task reminder: {{taskName}}" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Body Template</label>
          <textarea value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} rows={5} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none" placeholder="Hello {{userName}}, this is a reminder for {{taskName}}..." />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Variables (one per line)</label>
          <textarea value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} rows={4} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono" placeholder="userName&#10;taskName&#10;dueDate" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Supported Channels (one per line)</label>
          <textarea value={form.supportedChannels} onChange={(e) => setForm({ ...form, supportedChannels: e.target.value })} rows={4} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono" placeholder="in_app&#10;email&#10;push" />
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">Cancel</button>
          <button type="submit" disabled={submitting || !form.templateType || !form.subjectTemplate} className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Saving..." : (initialData ? "Update Template" : "Create Template")}
          </button>
        </div>
      </form>
    </div>
  );
}