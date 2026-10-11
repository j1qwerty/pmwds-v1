import { useState } from "react";
import { Sheet, ModalCancelButton, ModalPrimaryButton } from "../shared";
import { Icon } from "../../components/ui/Icon";

export interface ActivityFormValues {
  activityType: string;
  description: string;
  metadata: string;
}

interface ActivityFormProps {
  open: boolean;
  onClose: () => void;
  /** Submits the log. Resolve with `true` to reset the fields and close the modal. */
  onSubmit: (form: ActivityFormValues) => Promise<boolean> | boolean;
}

const COMMON_ACTIVITY_TYPES = [
  "Meeting",
  "Code Review",
  "Documentation",
  "Training",
  "Bug Fix",
  "Feature Development",
  "Client Call",
  "Planning",
  "Testing",
  "Deployment",
];

export function ActivityForm({ open, onClose, onSubmit }: ActivityFormProps) {
  const [form, setForm] = useState<ActivityFormValues>({
    activityType: "",
    description: "",
    metadata: "{}",
  });
  const [useCustomType, setUseCustomType] = useState(false);
  const [saving, setSaving] = useState(false);

  const isValidJson = (str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit =
    !!form.activityType &&
    !!form.description &&
    (form.metadata === "{}" || isValidJson(form.metadata));

  const attemptSubmit = async () => {
    if (saving || !canSubmit) return;
    setSaving(true);
    try {
      const ok = await onSubmit(form);
      if (ok) {
        setForm({ activityType: "", description: "", metadata: "{}" });
        setUseCustomType(false);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        // Sheet has no closeOnBackdrop option — guard here so a save in flight
        // can't be dismissed by a stray click or Escape (same intent as the old
        // closeOnBackdrop={!saving} on the centered modal).
        if (!saving) onClose();
      }}
      title="Log activity"
      description="Record what you just worked on so it shows up in the audit trail."
      icon="add"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onClose} label="Cancel" />
          <ModalPrimaryButton
            label="Save activity"
            icon="check"
            loading={saving}
            disabled={!canSubmit}
            onClick={attemptSubmit}
          />
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void attemptSubmit();
        }}
        className="space-y-4"
      >
        {/* Activity Type */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Activity Type <span className="text-red-500">*</span>
          </label>

          {!useCustomType ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {COMMON_ACTIVITY_TYPES.map((type) => {
                  const active = form.activityType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm({ ...form, activityType: type })}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all text-left border ${
                        active
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseCustomType(true);
                  setForm({ ...form, activityType: "" });
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1"
              >
                <Icon name="add" size={14} />
                Custom type
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={form.activityType}
                onChange={(e) => setForm({ ...form, activityType: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="Enter custom activity type"
              />
              <button
                type="button"
                onClick={() => {
                  setUseCustomType(false);
                  setForm({ ...form, activityType: "" });
                }}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold inline-flex items-center gap-1"
              >
                <Icon name="arrow_back" size={14} />
                Use common types
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Describe what you worked on..."
          />
        </div>

        {/* Metadata */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Metadata (JSON)
          </label>
          <textarea
            value={form.metadata}
            onChange={(e) => setForm({ ...form, metadata: e.target.value })}
            rows={3}
            className={`w-full px-3 py-2.5 rounded-lg border text-xs outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono ${
              form.metadata && !isValidJson(form.metadata) ? "border-red-200 bg-red-50" : "border-slate-200"
            }`}
            placeholder='{"project": "main", "duration": 45}'
          />
          {form.metadata && !isValidJson(form.metadata) && (
            <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
              <Icon name="error" size={12} />
              Invalid JSON format
            </p>
          )}
        </div>
      </form>
    </Sheet>
  );
}
