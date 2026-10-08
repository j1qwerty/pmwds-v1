import { useState, type FormEvent } from "react";
import { SectionCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ActivityFormProps {
  onSubmit: (form: { activityType: string; description: string; metadata: string }) => void;
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

export function ActivityForm({ onSubmit }: ActivityFormProps) {
  const [form, setForm] = useState({
    activityType: "",
    description: "",
    metadata: "{}",
  });
  const [useCustomType, setUseCustomType] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    onSubmit(form);
    setForm({ activityType: "", description: "", metadata: "{}" });
    // Reset saving flag shortly after — parent toast/fetch handles actual completion
    setTimeout(() => setSaving(false), 400);
  };

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

  return (
    <SectionCard
      title="Log Activity"
      description="Record what you just worked on"
      icon="note_add"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Activity Type */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icon name="check" size={14} />
              Save Activity
            </>
          )}
        </button>
      </form>
    </SectionCard>
  );
}
