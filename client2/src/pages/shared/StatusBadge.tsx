import { classNames } from "../../lib/formatters";
import { projectStatuses, taskStatuses } from "../constants";
import { getStatusColor } from "./colors";
import { PERMISSION_GROUPS, usePermission } from "./RoleGate";

interface StatusButtonsProps {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  variant?: "project" | "task";
}

export function StatusButtons({
  currentStatus,
  onStatusChange,
  variant = "project",
}: StatusButtonsProps) {
  const perm = usePermission();
  const statuses = variant === "task" ? taskStatuses : projectStatuses;
  const canUpdate = variant === "task"
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
              "px-3 py-1.5 text-xs font-bold rounded-full border transition-all flex items-center gap-1.5",
              isActive 
                ? `${styles.bg} ${styles.text} ${styles.border} ring-2 ring-offset-1`
                : "bg-white text-slate-400 border-slate-200",
              canUpdate && !isActive && `hover:${styles.bg} hover:${styles.text} hover:${styles.border}`,
              canUpdate && !isActive && "hover:shadow-sm hover:scale-105",
              canUpdate
                ? "cursor-pointer"
                : "cursor-default opacity-90"
            )}
            title={canUpdate ? `Change status to ${status}` : `Status: ${status}`}
          >
            <span className={classNames(
              "w-1.5 h-1.5 rounded-full",
              isActive ? styles.dot : "bg-slate-300",
              !isActive && `hover:${styles.dot}`
            )}></span>
            {status}
            {isActive && (
              <span className="material-symbols-outlined text-[14px]">check</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = getStatusColor(status);

  return (
    <span className={classNames(
      "px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5",
      styles.bg,
      styles.text
    )}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
      {status}
    </span>
  );
}
