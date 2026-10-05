import type { Task } from "../../../types";
import { getPriorityColor, getStatusColor } from "../colors";

type HighRiskInterventionsProps = {
  tasks?: Task[];
  onOpenTask?: (task: Task) => void | Promise<void>;
};

export function HighRiskInterventions({ tasks = [], onOpenTask }: HighRiskInterventionsProps) {
  return (
    <section className="max-w-150 flex flex-col gap-[clamp(1px,0.4vw,8px)] bg-white rounded-2xl shadow-md p-[clamp(8px,2vw,16px)] border border-slate-100 hover:shadow-blue-200 h-[360px] overflow-hidden">
      <div className="flex items-center gap-[clamp(4px,1vw,8px)] border-b border-slate-300 pb-1 shrink-0">
        <span className="material-symbols-outlined text-error text-[clamp(16px,1vw,24px)]">warning</span>
        <h2 className="text-[clamp(12px,1.5vw,16px)] font-semibold text-on-surface flex-1">High-Risk Escalations</h2>
        {tasks.length > 0 && (
          <span
            title={`${tasks.length} escalated task${tasks.length === 1 ? "" : "s"}`}
            aria-label={`${tasks.length} escalated tasks`}
            className="px-[clamp(5px,0.9vw,7px)] rounded-full bg-red-100 text-red-600 text-[clamp(9px,1.1vw,11px)] font-bold tabular-nums"
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-[clamp(2px,0.5vw,4px)] flex-1 min-h-0 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const priorityColor = getPriorityColor(task.priority);
          const statusColor = getStatusColor(task.status);

          // Project / assignee / due date stay in the tooltip instead of a second line. That
          // second line is what made each row tall enough to fit only three in the card.
          const detail = [
            task.projectName || "General",
            task.assignedToUserName,
            task.dueDate && `Due ${new Date(task.dueDate).toLocaleDateString()}`,
          ]
            .filter(Boolean)
            .join(" • ");

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => void onOpenTask?.(task)}
              title={detail}
              className={`w-full text-left shrink-0 flex items-center gap-[clamp(4px,0.8vw,8px)] px-[clamp(6px,1vw,10px)] py-[clamp(5px,0.8vw,7px)] rounded-lg border ${statusColor.border} ${statusColor.bg} relative overflow-hidden hover:shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`}
            >
              <span className={`w-[clamp(6px,0.8vw,8px)] h-[clamp(6px,0.8vw,8px)] rounded-full shrink-0 ${statusColor.dot}`} />
              <span className={`px-[clamp(3px,0.5vw,5px)] py-[clamp(1px,0.3vw,2px)] rounded text-[clamp(8px,0.9vw,9px)] font-bold uppercase shrink-0 ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border} border`}>
                {task.priority}
              </span>
              <span className="text-[clamp(11px,1.3vw,13px)] font-semibold text-on-surface truncate flex-1">
                {task.title}
              </span>
            </button>
          );
        })}

        {tasks.length === 0 && (
          <div className="p-[clamp(12px,2vw,16px)] text-center">
            <span className="material-symbols-outlined text-outline text-[clamp(18px,2.5vw,24px)] mb-[clamp(2px,0.4vw,4px)]">check_circle</span>
            <p className="text-[9px] text-slate-500">No escalated tasks</p>
          </div>
        )}
      </div>
    </section>
  );
}