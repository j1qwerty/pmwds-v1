import { SectionCard, useToast } from "../shared";
import { Icon } from "../../components/ui/Icon";
import {
  resetUserPreferences,
  setUserPreference,
  useUserPreferences,
  type UserPreferences,
} from "../../lib/userPreferences";

/**
 * Settings → Preferences. Display choices that belong to the person, not the
 * workspace. Saved in this browser per user and applied immediately.
 */

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300 ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function PreferencesSettings() {
  const prefs = useUserPreferences();
  const { addToast } = useToast();

  const set = <K extends keyof UserPreferences>(key: K) => (value: UserPreferences[K]) =>
    setUserPreference(key, value);

  return (
    <SectionCard
      icon="tune"
      title="Display preferences"
      description="Saved on this device for your account and applied straight away."
      actions={
        <button
          type="button"
          onClick={() => {
            resetUserPreferences();
            addToast("Preferences reset to defaults.");
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all"
        >
          <Icon name="restart_alt" size={13} />
          Reset to defaults
        </button>
      }
    >
      <div className="divide-y divide-slate-100">
        <ToggleRow
          title="Reduce motion"
          description="Turn off page transitions and animations. Useful if movement is distracting or tiring."
          checked={prefs.reduceMotion}
          onChange={set("reduceMotion")}
        />
        <ToggleRow
          title="Start with a compact sidebar"
          description="Open the app with the sidebar collapsed to icons. You can still expand it any time."
          checked={prefs.sidebarCompact}
          onChange={set("sidebarCompact")}
        />
      </div>
    </SectionCard>
  );
}
