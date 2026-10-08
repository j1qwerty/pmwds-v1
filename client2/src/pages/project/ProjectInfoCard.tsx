import { useState, useMemo, useEffect, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Milestone, MilestoneDependency, Project, User } from "../../types";
import { GlassCard, getStatusColor, getPriorityColor, useToast } from "../shared/index";
import {
  ProjectDetailModal,
  ProjectFormModal,
  type ProjectFormState,
  ConfirmDeleteModal,
} from "./components/index";
import { Icon } from "../../components/ui/Icon";
import { formatLakhs } from "../../lib/formatters";
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

  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(project.progressPercentage || 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [project.progressPercentage]);

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

  return (
    <>
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div className="size-11 relative flex items-center justify-center flex-shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <circle className="stroke-slate-200" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
              <circle
                className="stroke-indigo-500 transition-all duration-1000 ease-out"
                cx="18" cy="18" fill="none" r="16"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={(2 * Math.PI * 16) - (Math.min(animatedProgress, 100) / 100) * (2 * Math.PI * 16)}
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-slate-600">
              {Math.round(animatedProgress)}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800 truncate">{project.name}</h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(project.status).bg
                  } ${getStatusColor(project.status).text}`}
              >
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{project.description}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getPriorityColor(project.priority).bg} ${getPriorityColor(project.priority).text}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${getPriorityColor(project.priority).dot}`} />
                {project.priority}
              </span>
              <span className="text-[11px] text-slate-500" title="Planned budget (in lakhs)">{formatLakhs(project.plannedBudget)}</span>
              {project.departmentName && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                  <Icon name="hi-office-building" size={14} />
                  {project.departmentName}
                </span>
              )}
              {project.projectManagerId && (
                <div className="flex items-center gap-1.5" title="Project Manager">
                  <Avatar person={manager} name={project.projectManagerName} size="xs" />
                  <span className={`text-xs font-medium truncate max-w-[120px] ${manager?.isActive === false ? "text-red-500" : "text-slate-500"}`}>
                    {manager?.fullName || project.projectManagerName}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon name="hi-flag" size={16} />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 leading-none">{milestonesCount}</span>
              </div>
            </div>
            <Icon name="hi-clipboard" size={16} />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700 leading-none">{project.totalTasks}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              title="View project"
              onClick={(e) => { e.stopPropagation(); setViewProject(true); }}
              className="p-1.5 text-slate-400 hover:text-cyan-500 transition-colors rounded-lg hover:bg-slate-100"
            >
              <Icon name="view" size={16} />
            </button>

            {canManageProjects && (
              <button
                title="Edit project"
                onClick={(e) => {
                  e.stopPropagation();
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
                }}
                className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-slate-100"
              >
                <Icon name="edit" size={16} />
              </button>
            )}
            {canManageProjects && (
              <button
                title="Delete project"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteProjectTarget(project);
                  setDeleteProjectOpen(true);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              >
                <Icon name="delete" size={16} />
              </button>
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
