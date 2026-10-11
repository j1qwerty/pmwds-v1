import { useState, useMemo, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Milestone, MilestoneDependency, Project, User } from "../../types";
import { GlassCard, getStatusColor, getPriorityColor, getDepartmentColor, useToast, HoverActions, type HoverActionDef } from "../shared/index";
import {
  ProjectDetailModal,
  ProjectFormModal,
  type ProjectFormState,
  ConfirmDeleteModal,
} from "./components/index";
import { Icon } from "../../components/ui/Icon";
import { formatDate, formatLakhs } from "../../lib/formatters";
import { Avatar } from "../shared/Avatar";

const emptyProjectForm = (): ProjectFormState => ({
  projectCode: "",
  name: "",
  description: "",
  category: "Monitoring",
  plannedStartDate: new Date().toISOString().split("T")[0],
  plannedEndDate: "",
  plannedBudget: 0,
  organizationId: "",
  departmentId: "",
  departmentIds: [],
  projectManagerId: "",
  priority: "Medium",
});

interface ProjectInfoCardProps {
  project: Project;
  milestonesCount: number;
  milestones: Milestone[];
  dependencies: MilestoneDependency[];
  canManageProjects?: boolean;
  users?: User[];
  onProjectUpdated: () => void;
}

export function ProjectInfoCard({
  project,
  milestonesCount,
  milestones,
  dependencies,
  canManageProjects,
  users,
  onProjectUpdated,
}: ProjectInfoCardProps) {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { addToast } = useToast();
  const { data: appData } = useAppData();

  const [viewProject, setViewProject] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm());
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);

  const manager = useMemo(
    () => users?.find((u) => u.id === project.projectManagerId),
    [users, project.projectManagerId],
  );

  const status = getStatusColor(project.status);
  const priority = getPriorityColor(project.priority);

  const deptChips = useMemo(
    () =>
      (project.departments?.length
        ? project.departments.map((d) => d.departmentName || "")
        : [project.departmentName || ""]
      ).filter(Boolean),
    [project.departments, project.departmentName],
  );

  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(project.progressPercentage || 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [project.progressPercentage]);

  const progress = Math.min(Math.round(animatedProgress), 100);

  const handleEditProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    await api.updateProject(auth.token, project.id, projectForm);
    setEditProjectOpen(false);
    addToast("Project updated");
    onProjectUpdated();
  };

  const handleDeleteProject = async () => {
    const target = deleteProjectTarget ?? project;
    if (!auth || !target) return;
    await api.deleteProject(auth.token, target.id);
    setDeleteProjectOpen(false);
    setDeleteProjectTarget(null);
    addToast("Project deleted");
    navigate("/projects");
  };

  // Same handlers/permission gates as before — now routed through HoverActions
  // in view, edit, delete order (revealed on hover/focus, per the "projects"
  // setting). HoverActions renders `always` before `onHover`, so all three
  // live in one list to keep that visual order.
  const alwaysActions: HoverActionDef[] = [];
  const hoverActions: HoverActionDef[] = [
    { icon: "view", label: "View project", onClick: () => setViewProject(true) },
  ];
  if (canManageProjects) {
    hoverActions.push({
      icon: "edit",
      label: "Edit project",
      tone: "primary",
      onClick: () => {
        setProjectForm({
          projectCode: project.projectCode ?? "",
          name: project.name,
          description: project.description ?? "",
          category: project.category ?? "Monitoring",
          plannedStartDate: project.plannedStartDate?.split("T")[0] ?? "",
          plannedEndDate: project.plannedEndDate?.split("T")[0] ?? "",
          plannedBudget: project.plannedBudget ?? 0,
          organizationId: "",
          departmentId: project.departmentId ?? "",
          departmentIds: project.departmentIds ?? [],
          projectManagerId: project.projectManagerId ?? "",
          priority: project.priority ?? "Medium",
        });
        setEditProjectOpen(true);
      },
    });
    hoverActions.push({
      icon: "delete",
      label: "Delete project",
      tone: "danger",
      onClick: () => {
        setDeleteProjectTarget(project);
        setDeleteProjectOpen(true);
      },
    });
  }

  return (
    <>
      {/* No top accent/border strip — the card sits flush under the tab row
          using the standard glass language (rounded-2xl + border-slate-200/60). */}
      <GlassCard className="group p-0 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3 flex-wrap">
            {/* Progress ring first, before the project name */}
            <div className="size-12 relative flex items-center justify-center shrink-0" title={`${progress}% complete`}>
              <svg className="size-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
                <circle
                  className="stroke-indigo-500 transition-all duration-1000 ease-out"
                  cx="18" cy="18" fill="none" r="16"
                  strokeDasharray={2 * Math.PI * 16}
                  strokeDashoffset={(2 * Math.PI * 16) - (progress / 100) * (2 * Math.PI * 16)}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              </svg>
              <span className="absolute text-[9px] font-bold text-slate-600">{progress}%</span>
            </div>

            {/* Name + chips */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-800 truncate">{project.name}</h2>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.badgeBg} ${status.badgeText}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {project.status}
                </span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${priority.bg} ${priority.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${priority.dot}`} />
                  {project.priority}
                </span>
                {project.projectCode && (
                  <span className="text-[10px] font-mono font-semibold text-slate-400">{project.projectCode}</span>
                )}
              </div>
              {project.description && (
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={project.description}>
                  {project.description}
                </p>
              )}
            </div>

            {/* Actions — view, edit, delete (revealed on hover/focus).
                Exact handlers/permission gates as before; HoverActions owns
                stop-propagation and the Settings → "Row & card actions" setting. */}
            <HoverActions
              entity="projects"
              size="md"
              className="shrink-0"
              always={alwaysActions}
              onHover={hoverActions}
            />
          </div>

          {/* Meta row: key dates · budget · departments · manager */}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3 pt-3 border-t border-slate-100">
            <span
              className="flex items-center gap-1.5 text-[11px] text-slate-500"
              title="Planned schedule"
            >
              <Icon name="calendar_today" size={12} className="text-slate-400" />
              <span className="font-medium text-slate-600">{formatDate(project.plannedStartDate)}</span>
              <span className="text-slate-300">→</span>
              <span className="font-medium text-slate-600">{formatDate(project.plannedEndDate)}</span>
            </span>

            <span className="flex items-center gap-1.5 text-[11px] text-slate-500" title="Planned budget (in lakhs)">
              <Icon name="hi-cash" size={13} className="text-slate-400" />
              <span className="font-semibold text-slate-700">{formatLakhs(project.plannedBudget)}</span>
            </span>

            <span className="flex items-center gap-1.5 text-[11px] text-slate-500" title="Milestones">
              <Icon name="hi-flag" size={12} className="text-slate-400" />
              <span className="font-semibold text-slate-700">{milestonesCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500" title="Tasks">
              <Icon name="hi-clipboard" size={12} className="text-slate-400" />
              <span className="font-semibold text-slate-700">{project.totalTasks}</span>
            </span>

            {deptChips.length > 0 && (
              <span className="flex items-center gap-1.5 flex-wrap">
                {deptChips.slice(0, 4).map((name, i) => {
                  const dc = getDepartmentColor(i);
                  return (
                    <span
                      key={`${name}-${i}`}
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}
                      title={name}
                    >
                      <span className={`w-1 h-1 rounded-full ${dc.dot}`} />
                      <span className="max-w-[140px] truncate">{name}</span>
                    </span>
                  );
                })}
                {deptChips.length > 4 && (
                  <span
                    className="text-[10px] font-semibold text-slate-400 cursor-default"
                    title={deptChips.slice(4).join(", ")}
                  >
                    +{deptChips.length - 4}
                  </span>
                )}
              </span>
            )}

            {project.projectManagerId && (
              <span className="flex items-center gap-1.5 ml-auto" title="Project Manager">
                <Avatar person={manager} name={project.projectManagerName} size="xs" />
                <span
                  className={`text-[11px] font-medium truncate max-w-[140px] ${
                    manager?.isActive === false ? "text-red-500" : "text-slate-600"
                  }`}
                >
                  {manager?.fullName || project.projectManagerName}
                </span>
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {createPortal(
        <ProjectDetailModal
          project={viewProject ? project : null}
          canManage={canManageProjects ?? false}
          authToken={auth?.token}
          users={users}
          milestones={milestones}
          dependencies={dependencies}
          onClose={() => setViewProject(false)}
          onEdit={() => navigate("/projects")}
          onStatusChange={onProjectUpdated}
        />,
        document.body,
      )}

      {createPortal(
        <ProjectFormModal
          open={editProjectOpen}
          title="Edit Project"
          submitLabel="Save"
          form={projectForm}
          setForm={setProjectForm}
          departments={appData.departments}
          organizations={appData.organizations}
          users={appData.users}
          onSubmit={handleEditProject}
          onClose={() => setEditProjectOpen(false)}
        />,
        document.body,
      )}

      {createPortal(
        <ConfirmDeleteModal
          open={deleteProjectOpen}
          name={deleteProjectTarget?.name ?? project?.name ?? "this project"}
          warning="All milestones and tasks under this project may be affected."
          onConfirm={handleDeleteProject}
          onClose={() => {
            setDeleteProjectOpen(false);
            setDeleteProjectTarget(null);
          }}
        />,
        document.body,
      )}
    </>
  );
}
