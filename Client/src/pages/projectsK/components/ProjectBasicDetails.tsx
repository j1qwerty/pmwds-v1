import type { Project } from "../../../types";
import { formatDate, formatLakhs } from "../../../ui";
import { GlassCard, getStatusColor, getPriorityColor } from "../../shared";
import { Avatark } from "../../shared/Avatark";
import { 
  HiOutlineCalendar, 
  HiOutlineFlag, 
  HiOutlineClipboardList,
  HiOutlineChevronDown,
} from "react-icons/hi";
import { Icon } from "../../../components/ui/Icon";
import { useEffect, useState, useMemo, useCallback } from "react";

interface ProjectBasicDetailsProps {
  project: Project;
  canManage: boolean;
  onViewProject?: (project: Project) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  bare?: boolean;
  users?: any[];
  milestonesCount?: number;
  onClose?: () => void;
  pendingWarning?: {
    incompleteCount: number;
    totalCount: number;
  } | null;
  setPendingWarning?: (
    warning: { incompleteCount: number; totalCount: number } | null
  ) => void;
  handleForceComplete?: () => void | Promise<void>;
}

const STATUS_OPTIONS = [
  "NotStarted", 
  "InProgress", 
  "OnHold", 
  "Completed", 
  "Cancelled", 
  "Delayed"
] as const;

export function ProjectBasicDetails({
  project,
  canManage,
  onStatusChange,
  bare = false,
  users = [],
  milestonesCount = 0,
  pendingWarning,
  setPendingWarning,
  handleForceComplete,
}: ProjectBasicDetailsProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Memoized values
  const statusColors = useMemo(() => getStatusColor(project.status), [project.status]);
  const priorityColors = useMemo(() => getPriorityColor(project.priority), [project.priority]);
  
  const manager = useMemo(
    () => users?.find((u: any) => u.id === project.projectManagerId),
    [users, project.projectManagerId]
  );

  const progressPercentage = useMemo(
    () => Math.min(Math.max(project.progressPercentage || 0, 0), 100),
    [project.progressPercentage]
  );

  useEffect(() => {
    setAnimatedProgress(progressPercentage);
  }, [progressPercentage]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showStatusDropdown) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.status-dropdown')) {
        setShowStatusDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusDropdown]);

  // Callbacks
  const handleStatusToggle = useCallback(() => {
    if (canManage && onStatusChange) {
      setShowStatusDropdown(prev => !prev);
    }
  }, [canManage, onStatusChange]);

  const handleStatusSelect = useCallback((status: string) => {
    onStatusChange?.(status);
    setShowStatusDropdown(false);
  }, [onStatusChange]);

  // Calculate circle properties
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedProgress / 100) * circumference;

  const content = (
    <div className="flex items-start gap-4">
      {/* Progress Ring */}
      {/* <div className="relative flex items-center justify-center shrink-0">
        <svg 
          className="size-14 -rotate-90" 
          viewBox="0 0 128 128"
          aria-label={`Project progress: ${Math.round(animatedProgress)}%`}
          role="progressbar"
          aria-valuenow={Math.round(animatedProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <circle 
            className="stroke-slate-200" 
            cx="64" cy="64" 
            fill="none" 
            r={radius} 
            strokeWidth="8" 
          />
          <circle
            className="stroke-indigo-500 transition-all duration-700 ease-out"
            cx="64" cy="64" 
            fill="none" 
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            strokeWidth="8"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-800">
            {Math.round(animatedProgress)}%
          </span>
        </div>
      </div> */}

      {/* Project Info */}
      <div className="flex-1 min-w-0">
        {/* Title Row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h2 className="text-lg font-bold text-slate-900 truncate">
            {project.name}
          </h2>

          {/* Status Badge with Dropdown */}
          <div className="status-dropdown relative shrink-0">
            <button
              onClick={handleStatusToggle}
              disabled={!canManage || !onStatusChange}
              className={`
                px-2.5 py-1 rounded-md text-[10px] font-bold uppercase 
                ${statusColors.bg} ${statusColors.text} border ${statusColors.border}
                disabled:opacity-70 disabled:cursor-not-allowed
              `}
              aria-expanded={showStatusDropdown}
              aria-haspopup="listbox"
            >
              <span className="flex items-center gap-1">
                {project.status}
                {canManage && onStatusChange && (
                  <HiOutlineChevronDown className="w-3 h-3" />
                )}
              </span>
            </button>

            {/* Status Dropdown */}
            {showStatusDropdown && canManage && onStatusChange && (
              <div 
                className="absolute top-full mt-1 left-0 z-20 bg-white rounded-lg shadow-lg 
                  border border-slate-200 py-1 min-w-[150px]"
                role="listbox"
              >
                {STATUS_OPTIONS.map((status) => {
                  const st = getStatusColor(status);
                  const isActive = project.status === status;
                  
                  return (
                    <button
                      key={status}
                      onClick={() => handleStatusSelect(status)}
                      role="option"
                      aria-selected={isActive}
                      className={`
                        w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2
                        ${isActive 
                          ? `${st.bg} ${st.text}` 
                          : 'text-slate-600 hover:bg-slate-50'
                        }
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot || 'bg-current'}`} />
                      {status}
                      {isActive && (
                        <Icon name="check-circle" size={12} className="ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Priority Badge */}
          <span 
            className={`
              text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 
              flex items-center gap-1.5
              ${priorityColors.bg} ${priorityColors.text} 
              border ${priorityColors.border}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priorityColors.dot}`} />
            {project.priority}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Milestones & Tasks */}
          <div className="flex items-center gap-3 text-slate-600">
            <div className="flex items-center gap-1.5" title="Milestones">
              <HiOutlineFlag className="size-4 text-slate-400" />
              <span className="text-xs font-semibold">{milestonesCount}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Tasks">
              <HiOutlineClipboardList className="size-4 text-slate-400" />
              <span className="text-xs font-semibold">{project.totalTasks}</span>
            </div>
          </div>

          {/* Date Range */}
          <div 
            className="flex items-center gap-2 text-slate-600"
            title={`${formatDate(project.plannedStartDate)} - ${formatDate(project.plannedEndDate)}`}
          >
            <HiOutlineCalendar className="size-4 shrink-0 text-slate-400" />
            <span className="text-xs font-medium truncate">
              {formatDate(project.plannedStartDate)} - {formatDate(project.plannedEndDate)}
            </span>
          </div>

          {/* Budget */}
          <div className="flex items-center gap-2 text-slate-600">
            <Icon name="hi-cash" size={16} className="shrink-0 text-slate-400" />
            <span className="text-xs font-semibold" title={`${formatLakhs(project.plannedBudget)} (shown in lakhs)`}>
              {formatLakhs(project.plannedBudget)}
            </span>
          </div>

          {/* Manager */}
          {project.projectManagerId && (
            <div 
              className="flex items-center gap-2 text-slate-600"
              title="Project Manager"
            >
              <Avatark 
                person={manager} 
                name={project.projectManagerName} 
                size="xs" 
              />
              <span className="text-xs font-medium truncate">
                <span className={manager?.isActive === false ? "text-red-500" : ""}>{manager?.fullName || project.projectManagerName}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const warningBanner = pendingWarning && (
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm">
      <div className="flex items-start gap-2.5">
        <Icon name="warning" size={20} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Incomplete milestones detected</p>
          <p className="text-xs text-amber-700 mt-1">
            <strong>{pendingWarning.incompleteCount}</strong> of <strong>{pendingWarning.totalCount}</strong> milestone(s) in this project are not completed.
            Continuing will mark all milestones as completed at 100% progress.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleForceComplete}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Yes, complete all
            </button>
            <button
              onClick={() => setPendingWarning?.(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (bare) return <div className="p-4">{warningBanner}{content}</div>;
  
  return (
    <GlassCard className="p-4">
      {warningBanner}{content}
    </GlassCard>
  );
}