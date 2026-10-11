import { Icon } from "../../components/ui/Icon";

export type ViewMode = "card" | "list" | "grid" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Hide modes that don't make sense for the page */
  available?: ViewMode[];
  size?: "sm" | "md";
}

/**
 * Icon names are keys of the shared Icon component's iconMap
 * (src/components/ui/Icon.tsx). Names that are NOT in the map render as
 * nothing — which used to turn this control into an empty white pill.
 */
const ICON_MAP: Record<ViewMode, string> = {
  card: "hi-view-grid",
  list: "hi-view-list",
  grid: "grid",
  table: "hi-table",
};

const LABEL_MAP: Record<ViewMode, string> = {
  card: "Card",
  list: "List",
  grid: "Grid",
  table: "Table",
};

/**
 * Segmented control for switching between card / list / grid / table views.
 *
 * Visually similar to Notion / Linear view toggles — icon-only buttons on a
 * slate track with an obvious white active pill, so the control never
 * disappears into the background.
 */
export function ViewToggle({
  value,
  onChange,
  available = ["card", "list"],
  size = "sm",
}: ViewToggleProps) {
  const modes = available.filter((m) => m === "card" || m === "list" || m === "grid" || m === "table");
  if (modes.length <= 1) return null;

  const sizeCls = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? 16 : 18;

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 shadow-sm"
    >
      {modes.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            title={`${LABEL_MAP[mode]} view`}
            aria-pressed={active}
            className={`${sizeCls} flex items-center justify-center rounded-lg transition-all ${
              active
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/80"
                : "text-slate-500 border border-transparent hover:text-slate-700 hover:bg-white/80"
            }`}
          >
            <Icon name={ICON_MAP[mode]} size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
