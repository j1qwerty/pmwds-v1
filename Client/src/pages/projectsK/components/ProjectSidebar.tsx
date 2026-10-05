import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom"; // Add this import
import type { Project } from "../../../types";
import { GlassCard } from "../../shared";
import { ProjectCard } from "./ProjectCard";
import { Icon } from "../../../components/ui/Icon";

const PAGE_SIZE = 10;
const PIN_THRESHOLD = 5;

interface ProjectSidebarProps {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onViewProject: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  canEdit?: boolean;
  onAdd?: () => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onViewProject,
  onEditProject,
  canEdit = false,
  onAdd,
}: ProjectSidebarProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedScrollPos, setSavedScrollPos] = useState(0);
  const [pinnedProject, setPinnedProject] = useState<Project | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredProjects = useMemo(
    () =>
      projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [projects, search]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search]);

  const visibleProjects = useMemo(
    () => filteredProjects.slice(0, visibleCount),
    [filteredProjects, visibleCount]
  );

  const remaining = filteredProjects.length - visibleCount;

  const handleSelect = useCallback((id: string) => {
    onSelectProject(id);
    const idx = filteredProjects.findIndex((p) => p.id === id);
    const project = filteredProjects.find((p) => p.id === id) ?? null;

    if (idx >= PIN_THRESHOLD) {
      setSavedScrollPos(window.scrollY);
      setPinnedProject(project);
    } else {
      setPinnedProject(null);
      setSavedScrollPos(0);
    }
  }, [onSelectProject, filteredProjects]);

  useEffect(() => {
    if (!pinnedProject) return;
    requestAnimationFrame(() => {
      const grid = listRef.current?.closest<HTMLElement>('div.grid');
      if (grid) {
        const rect = grid.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight) {
          window.scrollBy({ top: rect.top - 16, behavior: "smooth" });
        }
      }
    });
  }, [pinnedProject]);

  const handleJumpBack = () => {
    setPinnedProject(null);
    if (savedScrollPos > 0) {
      window.scrollTo({ top: savedScrollPos, behavior: "smooth" });
    }
    setSavedScrollPos(0);
  };

  return (
    <GlassCard className="p-4 h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Projects
        </span>
        {canEdit && onAdd && (
          <button type="button" onClick={onAdd} className="text-indigo-600 hover:text-indigo-800">
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        )}
      </div>

      <div className="relative mb-3 px-1 shrink-0">
        <span className="material-symbols-outlined absolute left-3 top-1.5 text-slate-400 text-[16px]">search</span>
        <input
          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow outline-none shadow-sm"
          placeholder="Filter projects..."
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div ref={listRef} className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {pinnedProject && (
          <div className="shrink-0">
            <div className="relative">
              <ProjectCard
                project={pinnedProject}
                isSelected={selectedProjectId === pinnedProject.id}
                onSelectProject={handleSelect}
                onViewProject={onViewProject}
                onEditProject={onEditProject}
                canEdit={canEdit}
              />
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200 shadow-sm">
                Pinned
              </span>
            </div>
          </div>
        )}

        {visibleProjects.map((project) => (
          <div key={project.id} data-project-id={project.id}>
            <ProjectCard
              project={project}
              isSelected={selectedProjectId === project.id}
              onSelectProject={handleSelect}
              onViewProject={onViewProject}
              onEditProject={onEditProject}
              canEdit={canEdit}
            />
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="text-center py-8">
            <div className="text-slate-400 mb-2">
              <Icon name="hi-inbox" size={32} className="mx-auto" />
            </div>
            <p className="text-xs text-slate-400">No projects match filters</p>
          </div>
        )}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium py-1.5 text-center transition-colors"
          >
            Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} remaining)
          </button>
        )}
        {visibleCount > PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setVisibleCount(PAGE_SIZE)}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium py-1 text-center transition-colors"
          >
            Show less
          </button>
        )}
      </div>

 {savedScrollPos > 0 && createPortal(
  <button
    type="button"
    onClick={handleJumpBack}
    className="fixed bottom-4 z-50 size-9 flex items-center justify-center rounded-full bg-white border border-blue-200 shadow-lg text-blue-500 transition-all max-md:!left-auto max-md:right-4 animate-[bounce-glow_2.5s_ease-in-out_infinite]"
    style={{
      left: 'calc(clamp(200px,25vw,240px) + 280px)',
    }}
    title="Back to previous position"
  >
    <Icon name="arrow-down" size={16} />
    <style>{`
      @keyframes bounce-glow {
        0%, 100% { 
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(59,130,246,0.15), 0 1px 3px rgba(0,0,0,0.08);
        }
        50% { 
          transform: translateY(-6px);
          box-shadow: 0 8px 25px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2);
        }
      }
    `}</style>
  </button>,
  document.body
)}
    </GlassCard>
  );
}