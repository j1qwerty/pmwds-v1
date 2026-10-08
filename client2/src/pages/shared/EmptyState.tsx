import type { ReactNode } from "react";
import { Icon } from "../../components/ui/Icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Compact variant for in-panel empty states */
  compact?: boolean;
  /** Accent color for the icon container */
  accent?: "primary" | "warning" | "danger" | "success" | "info" | "neutral";
}

const ACCENT_MAP: Record<NonNullable<EmptyStateProps["accent"]>, string> = {
  primary: "bg-indigo-50 text-indigo-500",
  warning: "bg-amber-50 text-amber-500",
  danger: "bg-red-50 text-red-500",
  success: "bg-emerald-50 text-emerald-500",
  info: "bg-sky-50 text-sky-500",
  neutral: "bg-slate-100 text-slate-400",
};

/**
 * Empty state for tables, lists, and panels.
 *
 * Visually similar to Linear / Notion: large faded icon, bold title,
 * muted description, optional action button.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  compact = false,
  accent = "neutral",
}: EmptyStateProps) {
  const size = compact ? 36 : 56;
  const iconSize = compact ? 20 : 32;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8 px-4" : "py-16 px-6"
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-2xl ${ACCENT_MAP[accent]} mb-3`}
        style={{ width: size, height: size }}
      >
        <Icon name={icon} size={iconSize} />
      </div>
      <h3
        className={`font-bold text-slate-700 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`text-slate-500 mt-1 max-w-sm ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
