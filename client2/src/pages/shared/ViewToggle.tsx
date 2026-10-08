import { Icon } from "../../components/ui/Icon";

export type ViewMode = "card" | "list" | "grid" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Hide modes that don't make sense for the page */
  available?: ViewMode[];
  size?: "sm" | "md";
}

const ICON_MAP: Record<ViewMode, string> = {
  card: "grid_view",
  list: "view_list",
  grid: "apps",
  table: "table_rows",
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
 * Visually similar to Notion / Linear view toggles — compact, with
 * icon-only buttons and a tooltip title.
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
  const iconSize = size === "sm" ? 15 : 17;

  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 border border-slate-200/60">
      {modes.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            title={`${LABEL_MAP[mode]} view`}
            aria-pressed={active}
            className={`${sizeCls} flex items-center justify-center rounded-md transition-all ${
              active
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-700 hover:bg-white/50"
            }`}
          >
            <Icon name={ICON_MAP[mode]} size={iconSize} />
          </button>
        );
      })}
    </div>
  );
}
