import { classNames } from "../../lib/formatters";
import { projectStatuses, taskStatuses } from "../constants";
import { getStatusColor } from "./colors";
import { PERMISSION_GROUPS, usePermission } from "./RoleGate";

// ─── StatusBadgeMinimal ──────────────────────────────────────────────
interface StatusBadgeMinimalProps {
  status: string;
  /** When provided, the badge becomes interactive with hover effects */
  onClick?: () => void;
  /** Whether this badge represents the currently active/selected status */
  isActive?: boolean;
  className?: string;
}

export function StatusBadgeMinimal({
  status,
  onClick,
  isActive = false,
  className,
}: StatusBadgeMinimalProps) {
  const styles = getStatusColor(status);
  const isInteractive = !!onClick;

  return (
    <span
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={classNames(
        // Base layout: minimal rounded rectangle (not circular)
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border select-none",
        "transition-all duration-200 ease-in-out",
        
        // Always render REAL colors from palette
        styles.bg,
        styles.text,
        styles.border,

        // Active state reinforcement (universal subtle dark ring)
        isActive && "ring-1 ring-offset-1 ring-slate-900/10",

        // Interactive hover: real colors + subtle physical lift
        isInteractive && !isActive && `hover:${styles.bg} hover:${styles.text} hover:${styles.border}`,
        isInteractive && "hover:shadow-sm hover:-translate-y-[1px] cursor-pointer active:scale-[0.97] active:shadow-none active:translate-y-0",
        
        // Non-interactive cursor
        !isInteractive && "cursor-default",
        
        className
      )}
    >
      <span
        className={classNames(
          "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200",
          styles.dot
        )}
      />
      <span className="leading-none">{status}</span>
    </span>
  );
}

// ─── StatusButtons ───────────────────────────────────────────────────
interface StatusButtonsProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  variant?: "project" | "task";
}

export function StatusButtonsMin({
  currentStatus,
  onStatusChange,
  variant = "project",
}: StatusButtonsProps) {
  const perm = usePermission();
  const statuses = variant === "task" ? taskStatuses : projectStatuses;
  const canUpdate =
    variant === "task"
      ? perm.has(PERMISSION_GROUPS.task.edit)
      : perm.has(PERMISSION_GROUPS.project.edit);

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => {
        const styles = getStatusColor(status);
        const isActive = currentStatus === status;

        return (
          <button
            key={status}
            onClick={canUpdate ? () => onStatusChange(status) : undefined}
            disabled={!canUpdate}
            className={classNames(
              // Minimal rounded-rect base — NOT circular
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border select-none",
              "transition-all duration-200 ease-in-out",

              // Always render REAL colors from palette
              styles.bg,
              styles.text,
              styles.border,

              // Active reinforcement (universal subtle dark ring)
              isActive && "ring-1 ring-offset-1 ring-slate-900/10",

              // Hover: real colors + subtle physical lift
              canUpdate && !isActive && `hover:${styles.bg} hover:${styles.text} hover:${styles.border}`,
              canUpdate && !isActive && "hover:shadow-sm hover:-translate-y-[1px]",
              canUpdate && "cursor-pointer active:scale-[0.97] active:shadow-none active:translate-y-0",

              // Disabled state
              !canUpdate && "cursor-default opacity-60"
            )}
            title={canUpdate ? `Change status to ${status}` : `Status: ${status}`}
          >
            <span
              className={classNames(
                "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200",
                styles.dot
              )}
            />
            <span className="leading-none">{status}</span>
            {isActive && (
              <span className="material-symbols-outlined text-[14px] leading-none transition-opacity duration-200">
                check
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
