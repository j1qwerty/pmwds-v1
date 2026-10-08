import { Icon } from "../../components/ui/Icon";
import {
  SectionCard,
  HoverActions,
  getStatusColor,
  useActionVisibility,
  useToast,
  ActionVisibilityProvider,
  ACTION_VISIBILITY_ENTITIES,
  type ActionVisibilityEntity,
  type ActionVisibilityMode,
} from "../shared";

/**
 * Settings → "Row & card actions"
 *
 * Global "Reveal on hover" vs "Always show" toggle + per-entity overrides
 * (Default = inherit global) with the effective mode shown as a tiny badge,
 * plus a LIVE dummy preview card that reacts to the current "projects"
 * setting in real time. Persisted to localStorage via ActionVisibilityContext.
 */

const ENTITY_META: Record<ActionVisibilityEntity, { label: string; hint: string }> = {
  projects: { label: "Projects", hint: "Project cards & overview top section" },
  milestones: { label: "Milestones", hint: "Milestone cards & detail header" },
  tasks: { label: "Tasks", hint: "Task cards, rows & detail header" },
  subtasks: { label: "Subtasks", hint: "Subtask rows" },
  users: { label: "Users", hint: "People cards & directory rows" },
  departments: { label: "Departments", hint: "Department cards & rows" },
  organizations: { label: "Organizations", hint: "Organization cards & rows" },
  documents: { label: "Documents", hint: "Document panels & rows" },
  reports: { label: "Reports", hint: "Generated report rows" },
};

// ─── Segmented control (ViewToggle visual language: slate track + white pill) ──

interface SegmentedOption {
  value: string;
  label: string;
  title?: string;
}

function Segmented({
  value,
  options,
  onChange,
  ariaLabel,
  compact = false,
}: {
  value: string;
  options: SegmentedOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-sm"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.title ?? option.label}
            aria-pressed={active}
            className={`inline-flex items-center justify-center rounded-lg font-semibold border transition-all ${
              compact ? "h-7 px-2.5 text-[11px]" : "h-8 px-3 text-xs"
            } ${
              active
                ? "bg-white text-indigo-600 shadow-sm border-slate-200/80"
                : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/80"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Effective-mode badge ───────────────────────────────────────────

function EffectiveBadge({ mode }: { mode: ActionVisibilityMode }) {
  const always = mode === "always";
  return (
    <span
      title="Effective mode (override or global)"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
        always ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${always ? "bg-indigo-500" : "bg-slate-400"}`} />
      {always ? "Always" : "Hover"}
    </span>
  );
}

// ─── Inner section (inside the provider) ────────────────────────────

function ActionVisibilitySettingsBody() {
  const { settings, modeFor, setGlobal, setEntity, reset } = useActionVisibility();
  const { addToast } = useToast();

  const demoAction = (label: string) => () =>
    addToast(`Demo only — "${label}" (live preview of the Projects setting)`);

  const planning = getStatusColor("Planning");
  const previewEffective = modeFor("projects");

  return (
    <SectionCard
      icon="visibility"
      title="Row & card actions"
      description="Choose whether secondary actions (view, edit…) are revealed on hover or always visible."
      actions={
        <button
          type="button"
          onClick={reset}
          title="Restore global + per-entity defaults"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all"
        >
          <Icon name="restart_alt" size={13} />
          Reset to defaults
        </button>
      }
    >
      {/* ── Global behavior ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap py-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">Global behavior</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Applies everywhere unless an area below overrides it. Saved automatically.
          </p>
        </div>
        <Segmented
          ariaLabel="Global action visibility"
          value={settings.global}
          onChange={(value) => setGlobal(value as ActionVisibilityMode)}
          options={[
            { value: "hover", label: "Reveal on hover", title: "Secondary actions appear on hover/focus" },
            { value: "always", label: "Always show", title: "Secondary actions are always visible" },
          ]}
        />
      </div>

      {/* ── Per-entity overrides ── */}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Per-area overrides
        </p>
        <div className="mt-1 divide-y divide-slate-100">
          {ACTION_VISIBILITY_ENTITIES.map((entity) => {
            const meta = ENTITY_META[entity];
            const override = settings.entities[entity]; // undefined = inherit
            return (
              <div
                key={entity}
                className="flex items-center gap-3 py-2.5 flex-wrap sm:flex-nowrap"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700 leading-tight">{meta.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{meta.hint}</p>
                </div>
                <EffectiveBadge mode={modeFor(entity)} />
                <Segmented
                  compact
                  ariaLabel={`${meta.label} action visibility`}
                  value={override ?? "default"}
                  onChange={(value) =>
                    setEntity(entity, value === "default" ? null : (value as ActionVisibilityMode))
                  }
                  options={[
                    { value: "default", label: "Default", title: "Inherit the global setting" },
                    { value: "hover", label: "Hover", title: "Reveal on hover for this area" },
                    { value: "always", label: "Always", title: "Always visible in this area" },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Live dummy preview ── */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Live preview
        </p>

        {/* Fake project card — the HoverActions row is driven by the CURRENT "projects" setting */}
        <div className="group rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-200 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Project
              </p>
              <h4 className="text-sm font-bold text-slate-800 leading-tight mt-0.5 truncate">
                Website Redesign
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">8 tasks · 3 milestones · due Aug 30</p>
            </div>
            <HoverActions
              entity="projects"
              align="right"
              size="sm"
              always={[
                {
                  icon: "delete",
                  label: "Delete project (demo)",
                  tone: "danger",
                  onClick: demoAction("Delete"),
                },
              ]}
              onHover={[
                {
                  icon: "view",
                  label: "View project (demo)",
                  tone: "default",
                  onClick: demoAction("View"),
                },
                {
                  icon: "edit",
                  label: "Edit project (demo)",
                  tone: "primary",
                  onClick: demoAction("Edit"),
                },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${planning.badgeBg} ${planning.badgeText}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${planning.dot}`} />
              Planning
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {previewEffective === "always"
                ? "Secondary actions are always visible (Always mode)."
                : "Hover the card to reveal the view & edit actions."}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          This demo card uses the <span className="font-semibold text-slate-700">Projects</span>{" "}
          setting above — switch between Default / Hover / Always and watch it update live.
        </p>
      </div>
    </SectionCard>
  );
}

export function ActionVisibilitySettings() {
  return (
    <ActionVisibilityProvider>
      <ActionVisibilitySettingsBody />
    </ActionVisibilityProvider>
  );
}
