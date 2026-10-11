import type { Project } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ProjectListProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
}

export function ProjectList({ projects, selectedProjectId, onSelectProject }: ProjectListProps) {
  return (
    <GlassCard className="p-4">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
        Active Projects
      </div>

      <div className="flex flex-col gap-1">
        {projects.map((project) => {
          const isSelected = selectedProjectId === project.id;
          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              aria-pressed={isSelected}
              className={`flex gap-2.5 p-2 rounded-lg text-left transition-colors w-full ${
                isSelected
                  ? "bg-indigo-50/70 ring-1 ring-indigo-100"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isSelected ? "bg-indigo-500" : "bg-slate-300"}`} />
              <div className="flex flex-col min-w-0">
                <span className={`text-xs font-bold truncate ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                  {project.name}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight truncate">
                  {project.category || "Core Project"} · {Math.round(project.progressPercentage ?? 0)}% done
                </span>
              </div>
            </button>
          );
        })}

        {projects.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Icon name="rocket_launch" size={22} className="mb-2 block" />
            <p className="text-xs">No projects loaded</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
