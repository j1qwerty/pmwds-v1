import type { Milestone } from "../../../types";
import { getStatusColor } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

interface MilestoneCardProps {
  milestone: Milestone;
  isSelected: boolean;
  index: number;
  onSelectMilestone: (id: string) => void;
  onViewMilestone?: (milestone: Milestone) => void;
  onEditMilestone?: (milestone: Milestone) => void;
  canManage?: boolean;
}

export function MilestoneCard({ milestone, isSelected, index, onSelectMilestone, onViewMilestone, onEditMilestone, canManage = false }: MilestoneCardProps) {
  const statusColors = getStatusColor(milestone.status);
  const progress = milestone.progressPercentage || 0;

  const handleSelect = () => onSelectMilestone(milestone.id);

  return (
  <div
  key={milestone.id}
  role="button"
  tabIndex={0}
  onClick={handleSelect}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  }}
  className={`text-left p-3 rounded-xl shadow-sm border cursor-pointer transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-blue-400 overflow-hidden ${
    isSelected
      ? "bg-indigo-50 border-blue-500 border-b hover:bg-blue-100"
      : milestone.isBlocked
      ? " border-amber-200 hover:shadow-md hover:border-amber-400"
      : "bg-white border-slate-100 hover:shadow-md hover:border-blue-500 hover:shadow-blue-300 transition-shadow duration-200"
  }`}
  style={{ animation: `slideIn 0.3s ease ${index * 0.05}s both` }}
>
  {/* Row 1: Small icon and name (full name wrap text) */}
  <div className="flex items-start gap-2 mb-2 min-w-0">
    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
      milestone.isBlocked ? "bg-amber-100" : milestone.isCritical ? "bg-red-100" : "bg-slate-100"
    }`}>
      <span className={`material-symbols-outlined text-sm ${
        milestone.isBlocked ? "text-amber-600" : milestone.isCritical ? "text-red-500" : "text-slate-400"
      }`}>
        {milestone.isBlocked ? "lock" : milestone.status === "Completed" ? "check_circle" : "flag"}
      </span>
    </div>
    <span className="font-semibold text-sm text-slate-800 leading-tight break-words min-w-0 flex-1">
      {milestone.name}
    </span>
  </div>

  {/* Row 2: Status, progress bar and progress percent */}
  <div className="flex items-center gap-2 mb-2">
    <span className="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">
      {Math.round(progress)}%
    </span>
    
    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden min-w-0">
      <div
        className={`h-full rounded-full transition-all duration-500 ${statusColors.dot}`}
        style={{ width: `${progress}%` }}
      />
    </div>
    
    <span className={`text-[10px] font-medium shrink-0 ${statusColors.text}`}>
      {milestone.status}
    </span>
  </div>

  {/* Row 3: Critical tag and action buttons */}
  <div className="flex items-start justify-between gap-2">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 flex-1">
      {milestone.departmentName && (
        <span className="text-[10px] text-slate-400 break-words">
          {milestone.departmentName}
        </span>
      )}
      {milestone.dueDate && (
        <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
          Due {new Date(milestone.dueDate).toLocaleDateString()}
        </span>
      )}
      {milestone.isCritical && (
        <span className="text-[8px] font-bold text-red-500 uppercase bg-red-50 px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
          Critical
        </span>
      )}
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {onViewMilestone && (
        <button
          title="View milestone"
          className="p-1 text-slate-400 hover:text-cyan-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onViewMilestone(milestone);
          }}
        >
          <Icon name="view" size={16} />
        </button>
      )}
      {canManage && onEditMilestone && (
        <button
          title="Edit milestone"
          className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onEditMilestone(milestone);
          }}
        >
          <Icon name="edit" size={16} />
        </button>
      )}
    </div>
  </div>

  {/* Blocked message */}
  {milestone.isBlocked && milestone.blockedByMessage && (
    <div className="flex items-start gap-1 mt-2 min-w-0">
      <span className="material-symbols-outlined text-xs text-amber-500 shrink-0 mt-0.5">warning</span>
      <span className="text-[9px] text-amber-600 break-words min-w-0">{milestone.blockedByMessage}</span>
    </div>
  )}
</div>
  );
}