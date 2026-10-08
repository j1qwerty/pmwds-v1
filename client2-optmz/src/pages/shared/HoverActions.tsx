import type { JSX, MouseEvent } from "react";
import { Icon } from "../../components/ui/Icon";
import { useActionVisibility } from "./ActionVisibilityContext";
import type { ActionVisibilityEntity } from "./ActionVisibilityContext";

/**
 * HoverActions — compact icon-button row for cards / list rows / panel headers.
 *
 * - `always`  actions (delete, add-task/milestone/subtask, create…) are always visible
 * - `onHover` actions (view, edit, more…) are revealed on hover / keyboard focus
 *   and are ALWAYS visible when the per-entity visibility setting (settings →
 *   "Row & card actions") is "always" for this entity.
 *
 * Layout contract for card grids: the row has a FIXED height matching the
 * buttons and hidden buttons keep their space via opacity (never display:none),
 * so revealing them never shifts or jumps the card layout. The root is a
 * Tailwind `group`, so a hover anywhere on an ancestor card that also carries
 * the `group` class reveals the secondary actions (same idiom as the
 * GeneratedReports rows); hovering the actions row alone works everywhere.
 */

export interface HoverActionDef {
  /** Canonical Icon name (src/components/ui/Icon.tsx iconMap). */
  icon: string;
  /** Tooltip/title + aria-label. */
  label: string;
  onClick: (e: MouseEvent) => void;
  tone?: "default" | "danger" | "primary";
  disabled?: boolean;
}

export interface HoverActionsProps {
  /** Which entity visibility setting drives the reveal behavior. */
  entity: ActionVisibilityEntity;
  /** Always visible (e.g. delete, add-task). */
  always?: HoverActionDef[];
  /** Revealed on hover/focus (e.g. view, edit). */
  onHover?: HoverActionDef[];
  size?: "sm" | "md";
  className?: string;
  /** Horizontal alignment inside the parent (default "right"). */
  align?: "right" | "left";
}

const TONE_CLASSES: Record<NonNullable<HoverActionDef["tone"]>, string> = {
  default: "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
  danger: "text-red-500 hover:bg-red-50",
  primary: "text-indigo-600 hover:bg-indigo-50",
};

function ActionButton({ action, size }: { action: HoverActionDef; size: "sm" | "md" }) {
  const box = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const iconSize = size === "sm" ? 14 : 16;
  const tone = action.tone ?? "default";
  const disabled = action.disabled === true;

  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      // stopPropagation + preventDefault so card/row click handlers never fire
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!disabled) action.onClick(e);
      }}
      className={`${box} flex shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
        disabled ? "text-slate-300 cursor-not-allowed" : TONE_CLASSES[tone]
      }`}
    >
      <Icon name={action.icon} size={iconSize} />
    </button>
  );
}

export function HoverActions({
  entity,
  always,
  onHover,
  size = "sm",
  className = "",
  align = "right",
}: HoverActionsProps): JSX.Element | null {
  const { modeFor } = useActionVisibility();

  const alwaysList = always ?? [];
  const onHoverList = onHover ?? [];
  const revealed = modeFor(entity) === "always";

  // Render nothing when there are no actions at all.
  if (alwaysList.length === 0 && onHoverList.length === 0) return null;

  const rowHeight = size === "sm" ? "h-7" : "h-8";
  const hiddenState = `opacity-0 ${
    align === "left" ? "-translate-x-1" : "translate-x-1"
  } group-hover:opacity-100 group-hover:translate-x-0 focus-within:opacity-100 focus-within:translate-x-0`;

  return (
    <div
      className={`group flex items-center gap-0.5 ${rowHeight} ${
        align === "left" ? "justify-start" : "justify-end"
      } ${className}`}
    >
      {alwaysList.map((action, i) => (
        <ActionButton key={`always-${i}-${action.icon}`} action={action} size={size} />
      ))}

      {onHoverList.length > 0 && (
        <div
          className={`flex items-center gap-0.5 transition-all duration-150 ${
            revealed ? "opacity-100 translate-x-0" : hiddenState
          }`}
        >
          {onHoverList.map((action, i) => (
            <ActionButton key={`onHover-${i}-${action.icon}`} action={action} size={size} />
          ))}
        </div>
      )}
    </div>
  );
}
