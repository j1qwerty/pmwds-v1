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
      
      <div className="flex flex-col gap-1.5">
        {projects.map((project, index) => {
          const isSelected = selectedProjectId === project.id;
          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`
                p-3 rounded-xl text-left transition-all duration-200 flex flex-col gap-1.5
                ${isSelected
                  ? "bg-indigo-50 border-l-4 border-indigo-500 shadow-sm"
                  : "hover:bg-slate-50 border-l-4 border-transparent"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                  {project.name}
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  isSelected 
                    ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)] animate-pulse" 
                    : "bg-slate-300"
                }`}></span>
              </div>
              <span className="text-[11px] text-slate-400">
                {project.category || "Core Project"}
              </span>
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