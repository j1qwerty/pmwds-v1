import { classNames } from "../../lib/formatters";
import { priorities } from "../constants";
import { getPriorityColor } from "./colors";
import { PERMISSION_GROUPS, usePermission } from "./RoleGate";

interface PriorityButtonsProps {
  currentPriority: string;
  onPriorityChange: (priority: string) => void;
}

export function PriorityButtons({
  currentPriority,
  onPriorityChange,
}: PriorityButtonsProps) {
  const perm = usePermission();
  const canUpdate = perm.hasAny(PERMISSION_GROUPS.task.edit, PERMISSION_GROUPS.project.edit);

  return (
    <div className="flex flex-wrap gap-2">
      {priorities.map((priority) => {
        const styles = getPriorityColor(priority);
        const isActive = currentPriority === priority;

        return (
          <button
            key={priority}
            onClick={canUpdate ? () => onPriorityChange(priority) : undefined}
            disabled={!canUpdate}
            className={classNames(
              "px-3 py-1.5 text-xs font-semibold rounded-full border transition-all flex items-center gap-1.5",
              styles.bg,
              styles.text,
              isActive ? `${styles.border} ring-2 ring-offset-1 ${styles.border}` : "border-transparent",
              canUpdate
                ? "cursor-pointer hover:shadow-md hover:scale-105"
                : "cursor-default opacity-90"
            )}
            title={canUpdate ? `Change priority to ${priority}` : `Priority: ${priority}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
            {priority}
            {isActive && (
              <span className="material-symbols-outlined text-[14px]">check</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface PriorityBadgeProps {
  priority: string;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const styles = getPriorityColor(priority);

  return (
    <span className={classNames(
      "px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5",
      styles.bg,
      styles.text
    )}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span>
      {priority}
    </span>
  );
}
