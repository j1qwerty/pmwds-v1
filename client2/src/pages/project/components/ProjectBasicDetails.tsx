import type { Project } from "../../../types";
import { formatDate, formatLakhs } from "../../../lib/formatters";
import { GlassCard, getStatusColor, getPriorityColor } from "../../shared/index";
import { Avatar } from "../../shared/Avatar";
import { HiOutlineChevronDown } from "react-icons/hi";
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

  const handleStatusToggle = useCallback(() => {
    if (canManage && onStatusChange) {
      setShowStatusDropdown(prev => !prev);
    }
  }, [canManage, onStatusChange]);

  const handleStatusSelect = useCallback((status: string) => {
    onStatusChange?.(status);
    setShowStatusDropdown(false);
  }, [onStatusChange]);

  const content = (
    <div className="flex items-start gap-4">
      {/* Project info */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 truncate">
            {project.name}
          </h2>

          {/* Status badge with dropdown */}
          <div className="status-dropdown relative shrink-0">
            <button
              type="button"
              onClick={handleStatusToggle}
              disabled={!canManage || !onStatusChange}
              className={`
                inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                ${statusColors.badgeBg} ${statusColors.badgeText} border ${statusColors.border}
                disabled:opacity-70 disabled:cursor-not-allowed
                ${canManage && onStatusChange ? "hover:shadow-sm transition-all cursor-pointer" : ""}
              `}
              aria-expanded={showStatusDropdown}
              aria-haspopup="listbox"
              title={canManage && onStatusChange ? "Change status" : project.status}
            >
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
                {project.status}
                {canManage && onStatusChange && (
                  <HiOutlineChevronDown className="w-3 h-3" />
                )}
              </span>
            </button>

            {/* Status dropdown */}
            {showStatusDropdown && canManage && onStatusChange && (
              <div
                className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-lg
                  border border-slate-200 py-1 min-w-[150px] view-fade"
                role="listbox"
              >
                {STATUS_OPTIONS.map((status) => {
                  const st = getStatusColor(status);
                  const isActive = project.status === status;

                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusSelect(status)}
                      role="option"
                      aria-selected={isActive}
                      className={`
                        w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2
                        ${isActive
                          ? `${st.badgeBg} ${st.badgeText}`
                          : 'text-slate-600 hover:bg-slate-50'
                        }
                      `}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot || 'bg-current'}`} />
                      {status}
                      {isActive && (
                        <Icon name="check" size={12} className="ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Priority badge */}
          <span
            className={`
              text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0
              inline-flex items-center gap-1.5
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

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {/* Milestones & tasks */}
          <div className="flex items-center gap-3 text-slate-600">
            <div className="flex items-center gap-1.5" title="Milestones">
              <Icon name="hi-flag" size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">{milestonesCount}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Tasks">
              <Icon name="hi-clipboard" size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">{project.totalTasks}</span>
            </div>
          </div>

          {/* Date range */}
          <div
            className="flex items-center gap-2 text-slate-600"
            title={`${formatDate(project.plannedStartDate)} - ${formatDate(project.plannedEndDate)}`}
          >
            <Icon name="calendar_today" size={14} className="shrink-0 text-slate-400" />
            <span className="text-xs font-medium truncate">
              {formatDate(project.plannedStartDate)} - {formatDate(project.plannedEndDate)}
            </span>
          </div>

          {/* Budget */}
          <div className="flex items-center gap-2 text-slate-600">
            <Icon name="hi-cash" size={15} className="shrink-0 text-slate-400" />
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
              <Avatar
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
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm mb-3">
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
              type="button"
              onClick={handleForceComplete}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Yes, complete all
            </button>
            <button
              type="button"
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

  if (bare) return <div className="p-1">{warningBanner}{content}</div>;

  return (
    <GlassCard className="p-4">
      {warningBanner}{content}
    </GlassCard>
  );
}
