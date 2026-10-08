import { useState, useEffect } from "react";
import type { NotificationTemplateRecord } from "../../types";
import {
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
} from "../shared";

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

  const handleSave = () => {
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      templateType: form.templateType,
      subjectTemplate: form.subjectTemplate,
      bodyTemplate: form.bodyTemplate,
      variables: form.variables.split("\n").filter((v) => v.trim()),
      supportedChannels: form.supportedChannels.split("\n").filter((c) => c.trim()),
    });
  };

  const canSubmit = !!form.templateType.trim() && !!form.subjectTemplate.trim();

  return (
    <Modal
      open
      onClose={onCancel}
      title={initialData ? "Edit Template" : "Create Template"}
      description="Configure notification template with variables and channels"
      icon={initialData ? "edit" : "description"}
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={handleSave}
            loading={submitting}
            disabled={!canSubmit}
            label={initialData ? "Update Template" : "Create Template"}
            icon="check-circle"
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Template Type *
          </label>
          <input
            value={form.templateType}
            onChange={(e) => setForm({ ...form, templateType: e.target.value })}
            placeholder="e.g., task_reminder"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Subject Template *
          </label>
          <input
            value={form.subjectTemplate}
            onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })}
            placeholder="Task reminder: {{taskName}}"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Body Template
          </label>
          <textarea
            value={form.bodyTemplate}
            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
            rows={5}
            placeholder="Hello {{userName}}, this is a reminder for {{taskName}}..."
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Variables (one per line)
            </label>
            <textarea
              value={form.variables}
              onChange={(e) => setForm({ ...form, variables: e.target.value })}
              rows={4}
              placeholder={"userName\ntaskName\ndueDate"}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Supported Channels (one per line)
            </label>
            <textarea
              value={form.supportedChannels}
              onChange={(e) => setForm({ ...form, supportedChannels: e.target.value })}
              rows={4}
              placeholder={"in_app\nemail\npush"}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
