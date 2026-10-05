import type { Task } from "../../../types";
import { getPriorityColor, getStatusColor } from "../colors";

type HighRiskInterventionsProps = {
  tasks?: Task[];
  onOpenTask?: (task: Task) => void | Promise<void>;
};

export function HighRiskInterventions({ tasks = [], onOpenTask }: HighRiskInterventionsProps) {
  return (
    <section className="max-w-150 flex flex-col gap-[clamp(1px,0.4vw,8px)] bg-white rounded-2xl p-6 shadow-md  p-[clamp(8px,2vw,32px)] border border-slate-100 hover:shadow-blue-200 h-[430px] overflow-hidden">
      <div className="flex items-center gap-[clamp(4px,1vw,8px)] border-b border-slate-300 pb-1 shrink-0">
        <span className="material-symbols-outlined text-error text-[clamp(16px,2vw,24px)]">warning</span>
        <h2 className="text-[clamp(12px,1.5vw,16px)] font-semibold text-on-surface">High-Risk Escalations</h2>
        {tasks.length > 0 && (
          <span className="px-[clamp(6px,1vw,8px)] py-[clamp(2px,0.4vw,4px)] rounded-full bg-red-100 text-red-600 text-[clamp(8px,1vw,10px)] font-bold">
            {tasks.length} escalated
          </span>
        )}
      </div>

      <div className="flex flex-col gap-[clamp(4px,0.8vw,6px)] flex-1 min-h-0 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const priorityColor = getPriorityColor(task.priority);
          const statusColor = getStatusColor(task.status);

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => void onOpenTask?.(task)}
              className={`w-full text-left shrink-0 p-[clamp(8px,1.5vw,12px)] rounded-lg border ${statusColor.border} ${statusColor.bg} relative overflow-hidden hover:shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300`}
            >
              <div className={`absolute top-[clamp(6px,1vw,8px)] right-[clamp(6px,1vw,8px)] w-[clamp(6px,0.8vw,8px)] h-[clamp(6px,0.8vw,8px)] rounded-full ${statusColor.dot}`} />
              
              <div className="flex items-center gap-[clamp(4px,0.8vw,8px)] mb-[clamp(2px,0.4vw,4px)]">
                <span className={`px-[clamp(4px,0.8vw,6px)] py-[clamp(2px,0.4vw,4px)] rounded text-[clamp(8px,1vw,10px)] font-bold uppercase ${priorityColor.bg} ${priorityColor.text} ${priorityColor.border} border`}>
                  {task.priority}
                </span>
                <h3 className="text-[clamp(11px,1.4vw,14px)] font-semibold text-on-surface truncate flex-1">{task.title}</h3>
              </div>
              
              <p className="text-[clamp(9px,1.1vw,11px)] text-on-surface-variant truncate">
                {task.projectName || "General"}
                {task.assignedToUserName && ` • ${task.assignedToUserName}`}
                {task.dueDate && ` • Due ${new Date(task.dueDate).toLocaleDateString()}`}
              </p>
            </button>
          );
        })}

        {tasks.length === 0 && (
          <div className="p-[clamp(12px,2vw,16px)]  text-center">
            <span className="material-symbols-outlined text-outline text-[clamp(18px,2.5vw,24px)] mb-[clamp(2px,0.4vw,4px)]">check_circle</span>
            <p className="text-[clamp(9px,1.1vw,11px)] text-slate-500">No escalated tasks</p>
          </div>
        )}
      </div>
    </section>
  );
}