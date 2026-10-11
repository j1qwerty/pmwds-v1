import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppData } from "../../appData";
import type { Project } from "../../types";
import { PERMISSION_GROUPS, usePermission } from "../shared/RoleGate";
import { getStatusColor } from "../shared/colors";
import {
  HiOutlineHome,
  HiOutlineClipboardList,
  HiOutlineFlag,
  HiOutlineDocumentText,
  HiOutlineChevronRight,
} from "react-icons/hi";

export interface ProjectsGroupTheme {
  active: string;
  hover: string;
  bgHover: string;
  borderActive: string;
  textActive: string;
  textHover: string;
  textDefault: string;
  iconActive: string;
  iconDefault: string;
  initialBg: string;
  initialText: string;
  initialActiveBg: string;
  initialActiveText: string;
}

interface ProjectsGroupProps {
  theme: ProjectsGroupTheme;
  iconClass: string;
  compact?: boolean;
  onRequestExpand?: () => void;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function isNewProject(project: Project): boolean {
  if (project.isNewForCurrentUser !== undefined) {
    return project.isNewForCurrentUser;
  }
  return (project.totalTasks ?? 0) === 0;
}

export function ProjectsGroup({
  theme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  iconClass,
  compact = false,
  onRequestExpand,
}: ProjectsGroupProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useAppData();
  const perm = usePermission();

  // Nested rows start collapsed on every mount. Expansion is per-session
  // intent only — navigating to a project page must not force a row open.
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [sectionCollapsed, setSectionCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("pmwds.sidebar.collapsedSection") === "true";
    } catch {
      return false;
    }
  });

  const [showAllProjects, setShowAllProjects] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("pmwds.sidebar.collapsedSection", String(sectionCollapsed));
    } catch {
      /* ignore */
    }
  }, [sectionCollapsed]);

  const visibleProjects = useMemo<Project[]>(() => {
    if (!perm.has(PERMISSION_GROUPS.project.view)) return [];
    return [...data.projects].sort((a, b) => {
      const aNew = isNewProject(a);
      const bNew = isNewProject(b);
      if (aNew !== bNew) return aNew ? -1 : 1;
      return new Date(b.createdDate ?? 0).getTime() - new Date(a.createdDate ?? 0).getTime();
    });
  }, [data.projects, perm]);

  const DISPLAY_LIMIT = 10;
  const displayedProjects = useMemo(() => {
    if (showAllProjects) return visibleProjects;
    return visibleProjects.slice(0, DISPLAY_LIMIT);
  }, [visibleProjects, showAllProjects]);
  const hasMore = visibleProjects.length > DISPLAY_LIMIT;
  // (rows start collapsed; toggle only changes state on explicit user click)

  

  

  const isChildActive = useCallback(
    (projectId: string) => location.pathname.startsWith(`/projects/${projectId}/`),
    [location.pathname],
  );

  const isChildExactActive = useCallback(
    (projectId: string, suffix: string) => location.pathname === `/projects/${projectId}${suffix}`,
    [location.pathname],
  );

  const toggle = (projectId: string) => {
    setExpandedIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  };

  const handleCompactClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
    onRequestExpand?.();
  };

  if (!visibleProjects.length) return null;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 border-t border-surface-variant/60 pt-2">
        {visibleProjects.map((project) => {
          const active = isChildActive(project.id);
          const isNew = isNewProject(project);
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => handleCompactClick(project.id)}
              title={project.name}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase transition-all duration-200 hover:scale-110 ${
                active
                  ? `${theme.initialActiveBg} ${theme.initialActiveText} ring-2 ring-violet-300`
                  : `${theme.initialBg} ${theme.initialText}`
              } ${isNew ? "ring-2 ring-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.45)]" : ""
              }`}
            >
              {getInitials(project.name)}
            </button>
          );
        })}
      </div>
    ); 
  }

  return (
    <div
      className="border-t border-surface-variant/60"
      style={{ paddingTop: "clamp(4px, 0.6vw, 6px)" }}
    >
      <button
        type="button"
        onClick={() => setSectionCollapsed((p) => !p)}
        className={`w-full flex items-center justify-between px-[clamp(8px,1.5vw,12px)] pb-[clamp(2px,0.5vw,4px)] text-sky-600 text-[clamp(9px,1.2vw,10px)] uppercase tracking-[0.18em] font-semibold ${theme.textDefault}`}
      >
        <span>Projects</span>
        <HiOutlineChevronRight
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${sectionCollapsed ? "" : "rotate-90"}`}
        />
      </button>

      {!sectionCollapsed && (
        <div className="space-y-[clamp(1px,0.3vw,2px)]">
        {displayedProjects.map((project) => {
          const expanded = expandedIds.includes(project.id);
          const parentActive = isChildActive(project.id);
          const childOverviewActive =
            location.pathname === `/projects/${project.id}` ||
            isChildExactActive(project.id, "/overview");
          const childTasksActive = isChildExactActive(project.id, "/tasks");
          const childMilestonesActive = isChildExactActive(project.id, "/milestones");
          const childDocumentsActive = isChildExactActive(project.id, "/documents");
          const status = getStatusColor(project.status);
          const isNew = isNewProject(project);
          return (
            <div key={project.id} className="flex flex-col">
              {/* Row: the name opens Overview, the chevron only expands/collapses. */}
              <div
                className={`relative flex items-center rounded-md transition-all duration-200 group ${
                  parentActive
                    ? `${theme.active} ${theme.borderActive}`
                    : `${theme.textDefault} ${theme.hover} border-r-[3px] border-transparent`
                } ${isNew ? "bg-emerald-50/80 ring-1 ring-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.28)]" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  title={project.name}
                  className="flex items-center gap-[clamp(2px,1.5vw,6px)] min-w-0 flex-1 pl-[clamp(2px,1.5vw,4px)] pr-1 py-[clamp(7px,1vw,9px)] text-left"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`}
                    title={project.status}
                  />
                  <span className="text-[clamp(11px,1.5vw,13px)] font-medium tracking-[0.01em] truncate">
                    {project.name}
                  </span>
                  {isNew && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      New
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggle(project.id)}
                  aria-expanded={expanded}
                  aria-label={expanded ? `Collapse ${project.name}` : `Expand ${project.name}`}
                  title={expanded ? "Collapse" : "Expand"}
                  className="shrink-0 mr-[clamp(2px,0.5vw,4px)] p-[clamp(4px,0.7vw,6px)] rounded-md hover:bg-white/10 transition-colors"
                >
                  <HiOutlineChevronRight
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      expanded ? "rotate-90" : ""
                    } ${parentActive ? theme.iconActive : theme.iconDefault}`}
                  />
                </button>
              </div>

              {expanded && (
                <div className="flex flex-col ml-[clamp(16px,2.5vw,20px)] border-l border-surface-variant/60 pl-1">
                  <Link
                    to={`/projects/${project.id}/overview`}
                    className={`flex items-center gap-[clamp(6px,1vw,10px)] px-[clamp(8px,1.5vw,12px)] py-[clamp(5px,0.8vw,7px)] rounded-md transition-all duration-200 ${
                      childOverviewActive
                        ? `${theme.active}`
                        : `${theme.textDefault} ${theme.hover}`
                    }`}
                  >
                    <HiOutlineHome className="h-[clamp(13px,1.6vw,15px)] w-[clamp(13px,1.6vw,15px)] shrink-0" />
                    <span className="text-[clamp(10px,1.3vw,12px)] font-medium">Overview</span>
                  </Link>
                  <Link
                    to={`/projects/${project.id}/milestones`}
                    className={`flex items-center gap-[clamp(6px,1vw,10px)] px-[clamp(8px,1.5vw,12px)] py-[clamp(5px,0.8vw,7px)] rounded-md transition-all duration-200 ${
                      childMilestonesActive
                        ? `${theme.active}`
                        : `${theme.textDefault} ${theme.hover}`
                    }`}
                  >
                    <HiOutlineFlag className="h-[clamp(13px,1.6vw,15px)] w-[clamp(13px,1.6vw,15px)] shrink-0" />
                    <span className="text-[clamp(10px,1.3vw,12px)] font-medium">Milestones</span>
                  </Link>
                  <Link
                    to={`/projects/${project.id}/tasks`}
                    className={`flex items-center gap-[clamp(6px,1vw,10px)] px-[clamp(8px,1.5vw,12px)] py-[clamp(5px,0.8vw,7px)] rounded-md transition-all duration-200 ${
                      childTasksActive
                        ? `${theme.active}`
                        : `${theme.textDefault} ${theme.hover}`
                    }`}
                  >
                    <HiOutlineClipboardList className="h-[clamp(13px,1.6vw,15px)] w-[clamp(13px,1.6vw,15px)] shrink-0" />
                    <span className="text-[clamp(10px,1.3vw,12px)] font-medium">Tasks</span>
                  </Link>
                  <Link
                    to={`/projects/${project.id}/documents`}
                    className={`flex items-center gap-[clamp(6px,1vw,10px)] px-[clamp(8px,1.5vw,12px)] py-[clamp(5px,0.8vw,7px)] rounded-md transition-all duration-200 ${
                      childDocumentsActive
                        ? `${theme.active}`
                        : `${theme.textDefault} ${theme.hover}`
                    }`}
                  >
                    <HiOutlineDocumentText className="h-[clamp(13px,1.6vw,15px)] w-[clamp(13px,1.6vw,15px)] shrink-0" />
                    <span className="text-[clamp(10px,1.3vw,12px)] font-medium">Documents</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}

        {hasMore && !showAllProjects && (
          <button
            type="button"
            onClick={() => setShowAllProjects(true)}
            className="w-full flex items-center justify-center gap-1 text-[clamp(10px,1.3vw,11px)] text-sky-500 hover:text-sky-400 font-medium py-[clamp(4px,0.5vw,6px)] transition-colors rounded-md hover:bg-white/5"
          >
            <span>+ Show more ({visibleProjects.length - DISPLAY_LIMIT} more)</span>
          </button>
        )}
        {showAllProjects && hasMore && (
          <button
            type="button"
            onClick={() => setShowAllProjects(false)}
            className="w-full flex items-center justify-center gap-1 text-[clamp(10px,1.3vw,11px)] text-sky-500 hover:text-sky-400 font-medium py-[clamp(4px,0.5vw,6px)] transition-colors rounded-md hover:bg-white/5"
          >
            <span>- Show less</span>
          </button>
        )}
      </div>
      )}
    </div>
  );
}
