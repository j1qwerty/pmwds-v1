import type { Project } from "../../../types";
import { formatDate } from "../../../ui";
import { getStatusColor } from "../../shared/colors";
import { Icon } from "../../../components/ui/Icon";

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelectProject: (id: string) => void;
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  canEdit?: boolean;
}

const statusLabel: Record<string, string> = {
  NotStarted: "Not Started",
  InProgress: "On Track",
  Completed: "Completed",
  Delayed: "At Risk",
  OnHold: "On Hold",
  Cancelled: "Cancelled",
};

const progressStroke: Record<string, string> = {
  NotStarted: "stroke-slate-400",
  InProgress: "stroke-blue-500",
  Completed: "stroke-emerald-500",
  Delayed: "stroke-amber-500",
  OnHold: "stroke-purple-500",
  Cancelled: "stroke-red-500",
};

function getStatusStyles(status: string) {
  const c = getStatusColor(status);
  return {
    label: statusLabel[status] || "Not Started",
    dot: c.dot,
    textColor: c.text,
    border: c.border,
    bgSelected: c.bg,
    bgHover: c.bg.replace("100", "50"),
    progressColor: progressStroke[status] || "stroke-slate-400",
  };
}

export function ProjectCard({ project, isSelected, onSelectProject, onViewProject, onEditProject, canEdit = false }: ProjectCardProps) {
  const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
  const s = getStatusStyles(project.status);

  return (
  <div
  key={project.id}
  onClick={() => onSelectProject(project.id)}
  className={`rounded-xl p-4 shadow-sm border cursor-pointer transition-all duration-200 ${
    isSelected
      ? `${s.bgSelected} ${s.border} border-b-2`
      : `bg-white ${s.border} hover:shadow-md ${s.bgHover}`
  }`}
>
  {/* Top Section: Progress Ring + Name */}
  <div className="flex items-start gap-2 mb-3">
    {/* Progress Ring - Smaller */}
    <div className="size-11 relative flex items-center justify-center shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
        <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="14" strokeWidth="3" />
        <circle
          className={`${s.progressColor} transition-all duration-700`}
          cx="18" cy="18" fill="none" r="14"
          strokeDasharray="87.96"
          strokeDashoffset={87.96 - (progress / 100) * 87.96}
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span className={`absolute text-[10px] font-bold ${s.textColor}`}>{progress}%</span>
    </div>

    {/* Project Name and Status */}
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-medium leading-snug text-slate-700 line-clamp-2">
        {project.name}
      </h4>
      <div className="flex items-center gap-1 mt-1">
        <div className={`size-1.5 rounded-full ${s.dot} ${project.status === "Delayed" ? "animate-pulse" : ""}`} />
        <span className={`text-[10px] font-semibold ${s.textColor}`}>{s.label}</span>
      </div>
    </div>
  </div>

  {/* Bottom Section: Dates and Actions */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1 text-[10px] text-slate-500">
      <Icon name="calendar" size={14} />
      <span>{formatDate(project.createdDate)}</span>
      <span className="text-slate-300">|</span>
      <span>{formatDate(project.plannedEndDate)}</span>
    </div>

    <div className="flex items-center gap-1.5">
      <button
        title="View project"
        className="p-1 text-slate-400 hover:text-cyan-500 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onViewProject(project);
        }}
      >
        <Icon name="view" size={14} />
      </button>

      {canEdit && onEditProject && (
        <button
          title="Edit project"
          className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onEditProject(project);
          }}
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
  </div>
</div>
  );
}
