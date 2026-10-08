import { useState } from "react";
import type { Department } from "../../types";
import {
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
} from "../shared";

interface BroadcastModalProps {
  departments: Department[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function BroadcastModal({ departments, onSubmit, onCancel }: BroadcastModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    departmentId: "",
    actionUrl: "",
  });

  const handleSave = () => {
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      ...form,
      departmentId: form.departmentId || null,
      actionUrl: form.actionUrl || null,
    });
  };

  const canSubmit = !!form.title.trim() && !!form.message.trim();

  return (
    <Modal
      open
      onClose={onCancel}
      title="Broadcast Notification"
      description="Send a notification to all users or a specific department"
      icon="hi-speakerphone"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={handleSave}
            loading={submitting}
            disabled={!canSubmit}
            label="Send Broadcast"
            icon="share"
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Title *
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Important announcement"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Message *
          </label>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={4}
            placeholder="Notification message content..."
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Department Scope
          </label>
          <select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Action URL (Optional)
          </label>
          <input
            value={form.actionUrl}
            onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
            placeholder="https://example.com/action"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
      </div>
    </Modal>
  );
}
