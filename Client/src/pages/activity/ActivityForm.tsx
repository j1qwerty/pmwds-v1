import { useState, type FormEvent } from "react";
import { GlassCard, GradientButton } from "../shared";

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ activityType: "", description: "", metadata: "{}" });
  };

  const isValidJson = (str: string) => {
    try { JSON.parse(str); return true; } catch { return false; }
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-indigo-500">note_add</span>
        Log Activity
      </h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Activity Type */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Activity Type <span className="text-red-500">*</span>
          </label>
          
          {!useCustomType ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                {COMMON_ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, activityType: type })}
                    className={`
                      px-3 py-2 rounded-lg text-xs font-medium transition-all text-left
                      ${form.activityType === type
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        : "bg-slate-50 text-slate-600 border border-slate-100 hover:border-slate-200"
                      }
                    `}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setUseCustomType(true); setForm({ ...form, activityType: "" }); }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + Custom type
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={form.activityType}
                onChange={(e) => setForm({ ...form, activityType: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="Enter custom activity type"
              />
              <button
                type="button"
                onClick={() => { setUseCustomType(false); setForm({ ...form, activityType: "" }); }}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Use common types
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
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
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
            rows={4}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-mono ${
              form.metadata && !isValidJson(form.metadata) ? "border-red-200 bg-red-50" : "border-slate-200"
            }`}
            placeholder='{"project": "main", "duration": 45}'
          />
          {form.metadata && !isValidJson(form.metadata) && (
            <p className="text-[10px] text-red-500 mt-1">Invalid JSON format</p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!form.activityType || !form.description || (form.metadata !== "{}" && !isValidJson(form.metadata))}
            className="w-full px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Activity
          </button>
        </div>
      </form>
    </GlassCard>
  );
}