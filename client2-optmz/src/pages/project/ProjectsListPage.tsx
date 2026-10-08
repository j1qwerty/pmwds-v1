import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Project } from "../../types";
import {
  AnimatedBackground,
  Modal,
  PERMISSION_GROUPS,
  useNavHeader,
  usePermission,
  useToast,
  projectBelongsToAnyDepartment,
  projectBelongsToDepartment,
  getStatusColor,
  getPriorityColor,
  ViewToggle,
  type ViewMode,
  FilterBar,
  FilterDropdown,
  SortDropdown,
  EmptyState,
  PageContainer,
  StatCard,
  Avatar,
  Skeleton,
  HoverActions,
  type HoverActionDef,
  getDepartmentColor,
} from "../shared/index";
import { useUserOrganization } from "../shared/useUserOrganization";
import { LazyNewProjectPage, WizardBoundary, useWarmWizard, preloadWizard } from "../NewProject/lazyWizard";
import { Icon } from "../../components/ui/Icon";
import { formatLakhs } from "../../lib/formatters";
import {
  ProjectDetailModal,
  ProjectFormModal,
  ConfirmDeleteModal,
  type ProjectFormState,
} from "./components/index";

type SortKey =
  | "newest"
  | "oldest"
  | "nameAsc"
  | "nameDesc"
  | "startAsc"
  | "endAsc"
  | "progressDesc"
  | "progressAsc";

type DateField = "plannedEnd" | "plannedStart" | "created";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "endAsc", label: "Deadline (soonest)" },
  { value: "startAsc", label: "Start date (soonest)" },
  { value: "progressDesc", label: "Progress (high → low)" },
  { value: "progressAsc", label: "Progress (low → high)" },
];

const DATE_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "plannedEnd", label: "End date" },
  { value: "plannedStart", label: "Start date" },
  { value: "created", label: "Created date" },
];

const STATUS_LABELS: Record<string, string> = {
  NotStarted: "Not Started",
  InProgress: "In Progress",
  OnHold: "On Hold",
  Completed: "Completed",
  Delayed: "Delayed",
  Cancelled: "Cancelled",
};

/** Status chip order for the filter row (only statuses present in data appear). */
const STATUS_ORDER = ["NotStarted", "InProgress", "OnHold", "Delayed", "Completed", "Cancelled"];

function toIsoDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const SESSION_NOW = Date.now();

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

/** Edit-form initialization — mirrors ProjectInfoCard's exact mapping. */
const toProjectForm = (project: Project): ProjectFormState => ({
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

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { data: appData, refresh: refreshAppData } = useAppData();
  const perm = usePermission();
  const canManageProjects = perm.has(PERMISSION_GROUPS.project.manage);
  const isSuperAdmin = perm.isSuperAdmin;
  const { addToast } = useToast();
  const { setNavHeader } = useNavHeader();

  const [projects, setProjects] = useState<Project[]>([]);
  const { departments, organizations, users } = appData;
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [orgId, setOrgId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [dateField, setDateField] = useState<DateField>("plannedEnd");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newProjectWizardOpen, setNewProjectWizardOpen] = useState(false);
  useWarmWizard();
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // Card/row quick actions (HoverActions): quick-view detail sheet, edit sheet, delete confirm.
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);

  useEffect(() => {
    const actions = canManageProjects
      ? [{ label: "New Project", onClick: () => setNewProjectWizardOpen(true), icon: "add_circle" }]
      : [];
    setNavHeader({
      title: "Projects",
      description: "Browse, search and filter every project in your workspace",
      actions,
    });
  }, [setNavHeader, canManageProjects]);

  const loadProjects = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      setProjects(await api.getProjects(auth.token));
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  }, [auth, addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  const effectiveOrgId = orgId;
  const dropdownOrgId =
    orgId || (shouldFilterByOrg && userOrganizationId ? userOrganizationId : "");

  const visibleOrganizations = useMemo(() => {
    if (shouldFilterByOrg && userOrganizationId) {
      return organizations.filter((org) => org.id === userOrganizationId);
    }
    return organizations;
  }, [organizations, shouldFilterByOrg, userOrganizationId]);

  const orgOptions = useMemo(
    () => visibleOrganizations.map((o) => ({ value: o.id, label: o.name })),
    [visibleOrganizations]
  );

  const deptOptions = useMemo(() => {
    const scoped = dropdownOrgId
      ? departments.filter((d) => d.organizationId === dropdownOrgId)
      : departments;
    return scoped.map((d) => ({ value: d.id, label: d.name }));
  }, [departments, dropdownOrgId]);

  /* ── KPI stats (derived, no extra fetching) ── */
  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "InProgress").length;
    const delayed = projects.filter((p) => p.status === "Delayed").length;
    const completed = projects.filter((p) => p.status === "Completed").length;
    return { total: projects.length, active, delayed, completed };
  }, [projects]);

  const statusChipOptions = useMemo(
    () =>
      STATUS_ORDER.filter((s) => projects.some((p) => p.status === s)).map((s) => ({
        value: s,
        label: STATUS_LABELS[s] || s,
        count: projects.filter((p) => p.status === s).length,
        color: { dot: getStatusColor(s).dot },
      })),
    [projects]
  );

  const priorityOptions = useMemo(
    () =>
      [...new Set(projects.map((p) => p.priority).filter(Boolean))].map((p) => ({
        value: p,
        label: p,
        dot: getPriorityColor(p).dot,
      })),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = projects;

    if (effectiveOrgId) {
      const orgDeptIds = departments.filter((d) => d.organizationId === effectiveOrgId).map((d) => d.id);
      if (orgDeptIds.length > 0) {
        list = list.filter((p) => projectBelongsToAnyDepartment(p, orgDeptIds));
      }
    }
    if (deptId) {
      const narrowed = list.filter((p) => projectBelongsToDepartment(p, deptId));
      if (narrowed.length > 0 || list.length === 0) list = narrowed;
    }

    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    if (priorityFilter) list = list.filter((p) => p.priority === priorityFilter);

    if (overdueOnly) {
      list = list.filter(
        (p) =>
          p.status !== "Completed" &&
          !!p.plannedEndDate &&
          new Date(p.plannedEndDate).getTime() < SESSION_NOW
      );
    }

    if (dateFrom || dateTo) {
      list = list.filter((p) => {
        const raw =
          dateField === "created"
            ? p.createdDate
            : dateField === "plannedStart"
              ? p.plannedStartDate
              : p.plannedEndDate;
        if (!raw) return false;
        const value = toIsoDate(raw);
        if (dateFrom && value < dateFrom) return false;
        if (dateTo && value > dateTo) return false;
        return true;
      });
    }

    if (term) {
      list = list.filter((p) => {
        const haystack = [
          p.name,
          p.projectCode,
          p.description,
          p.category,
          p.departmentName,
          p.projectManagerName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    const byName = (a: Project, b: Project) => a.name.localeCompare(b.name);
    const byCreated = (a: Project, b: Project) =>
      new Date(a.createdDate ?? 0).getTime() - new Date(b.createdDate ?? 0).getTime();
    const byStart = (a: Project, b: Project) =>
      new Date(a.plannedStartDate ?? 0).getTime() - new Date(b.plannedStartDate ?? 0).getTime();
    const byEnd = (a: Project, b: Project) =>
      new Date(a.plannedEndDate ?? 0).getTime() - new Date(b.plannedEndDate ?? 0).getTime();
    const byProgress = (a: Project, b: Project) =>
      (a.progressPercentage ?? 0) - (b.progressPercentage ?? 0);

    const sorted = [...list];
    switch (sortKey) {
      case "newest":
        sorted.sort((a, b) => -byCreated(a, b));
        break;
      case "oldest":
        sorted.sort(byCreated);
        break;
      case "nameAsc":
        sorted.sort(byName);
        break;
      case "nameDesc":
        sorted.sort((a, b) => -byName(a, b));
        break;
      case "startAsc":
        sorted.sort(byStart);
        break;
      case "endAsc":
        sorted.sort(byEnd);
        break;
      case "progressDesc":
        sorted.sort((a, b) => -byProgress(a, b));
        break;
      case "progressAsc":
        sorted.sort(byProgress);
        break;
    }
    return sorted;
  }, [
    projects,
    departments,
    query,
    statusFilter,
    priorityFilter,
    effectiveOrgId,
    deptId,
    overdueOnly,
    dateField,
    dateFrom,
    dateTo,
    sortKey,
  ]);

  const activeFilterCount =
    (query ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (deptId ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (overdueOnly ? 1 : 0);

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("");
    setPriorityFilter("");
    setDeptId("");
    setDateFrom("");
    setDateTo("");
    setOverdueOnly(false);
  };

  /* ── Card/row quick actions (same flows as ProjectInfoCard) ── */
  const openProjectEdit = (project: Project) => {
    setEditProject(project);
    setProjectForm(toProjectForm(project));
    setEditProjectOpen(true);
  };

  const requestProjectDelete = (project: Project) => {
    setDeleteProjectTarget(project);
    setDeleteProjectOpen(true);
  };

  const handleEditProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth || !editProject) return;
    await api.updateProject(auth.token, editProject.id, projectForm);
    setEditProjectOpen(false);
    setEditProject(null);
    addToast("Project updated");
    void loadProjects();
    void refreshAppData();
  };

  const handleDeleteProject = async () => {
    const target = deleteProjectTarget;
    if (!auth || !target) return;
    await api.deleteProject(auth.token, target.id);
    setDeleteProjectOpen(false);
    setDeleteProjectTarget(null);
    addToast("Project deleted");
    void loadProjects();
    void refreshAppData();
  };

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Total projects" value={stats.total} color="indigo" icon="folder_open" />
            <StatCard label="In progress" value={stats.active} color="blue" icon="clock" />
            <StatCard label="Delayed" value={stats.delayed} color="amber" icon="warning" />
            <StatCard label="Completed" value={stats.completed} color="emerald" icon="check-circle" />
          </>
        }
        filters={
          <div className="space-y-2">
            <FilterBar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search by name, code, description..."
              chipGroups={
                statusChipOptions.length > 0
                  ? [{ key: "status", options: statusChipOptions, value: statusFilter, onChange: setStatusFilter }]
                  : []
              }
              leftExtras={
                <span className="hidden md:inline text-xs text-slate-400 whitespace-nowrap">
                  Showing <strong className="text-slate-600">{filteredProjects.length}</strong> of {projects.length}
                </span>
              }
              actions={
                <>
                  <FilterDropdown
                    value={deptId}
                    onChange={setDeptId}
                    label="Dept"
                    icon="apartment"
                    options={deptOptions}
                    width="min-w-[160px]"
                  />
                  <FilterDropdown
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    label="Priority"
                    icon="priority_high"
                    options={priorityOptions}
                    width="min-w-[150px]"
                  />
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      filtersOpen || activeFilterCount > 0
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <Icon name="track_changes" size={14} />
                    More
                    {activeFilterCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <SortDropdown value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} />
                  <ViewToggle value={viewMode} onChange={setViewMode} available={["card", "list"]} />
                </>
              }
            />

            {filtersOpen && (
              <div className="p-4 bg-white rounded-xl border border-slate-200/70 shadow-sm view-fade">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {isSuperAdmin && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Organization
                      </p>
                      <FilterDropdown
                        value={orgId}
                        onChange={(val) => {
                          setOrgId(val);
                          setDeptId("");
                        }}
                        options={orgOptions}
                        label=""
                        width="w-full"
                      />
                    </div>
                  )}

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Date field
                    </p>
                    <FilterDropdown
                      value={dateField}
                      onChange={(val) => setDateField(val as DateField)}
                      options={DATE_FIELD_OPTIONS}
                      label=""
                      width="w-full"
                    />
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      From
                    </p>
                    <input
                      type="date"
                      aria-label="From date"
                      className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      To
                    </p>
                    <input
                      type="date"
                      aria-label="To date"
                      className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                    Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setOverdueOnly(false);
                    }}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all ${
                      !dateFrom && !dateTo && !overdueOnly
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All dates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      setDateField("plannedEnd");
                      setDateFrom(toIsoDate(monthStart.toISOString()));
                      setDateTo(toIsoDate(monthEnd.toISOString()));
                    }}
                    className="h-7 px-2.5 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Ends this month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const end = new Date(now);
                      end.setDate(end.getDate() + 30);
                      setDateField("plannedEnd");
                      setDateFrom(toIsoDate(now.toISOString()));
                      setDateTo(toIsoDate(end.toISOString()));
                    }}
                    className="h-7 px-2.5 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Next 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverdueOnly((v) => !v)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all ${
                      overdueOnly
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Overdue only
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      Reset all
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="h-7 px-3 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      >
        {/* ── Project cards / list ── */}
        {loading ? (
          <ProjectsSkeleton view={viewMode} />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="No projects match your filters"
            description={
              activeFilterCount > 0
                ? "Try clearing some filters to see more projects."
                : "Get started by creating your first project."
            }
            accent="primary"
            action={
              activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                >
                  <Icon name="filter_alt_off" size={14} />
                  Clear all filters
                </button>
              ) : canManageProjects ? (
                <button
                  type="button"
                  onClick={() => setNewProjectWizardOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                >
                  <Icon name="add" size={14} />
                  New Project
                </button>
              ) : undefined
            }
          />
        ) : viewMode === "card" ? (
          <div key="card" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10 view-fade">
            {filteredProjects.map((project, idx) => (
              <div
                key={project.id}
                className="card-stagger"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <ProjectSummaryCard
                  project={project}
                  canManage={canManageProjects}
                  onOpen={() => navigate(`/projects/${project.id}`)}
                  onView={setDetailProject}
                  onEdit={openProjectEdit}
                  onDelete={requestProjectDelete}
                />
              </div>
            ))}
          </div>
        ) : (
          <div key="list" className="pb-10 view-fade">
            <ProjectListView
              projects={filteredProjects}
              canManage={canManageProjects}
              onOpen={(id) => navigate(`/projects/${id}`)}
              onView={setDetailProject}
              onEdit={openProjectEdit}
              onDelete={requestProjectDelete}
            />
          </div>
        )}
      </PageContainer>

      {newProjectWizardOpen && (
        <Modal
          open={newProjectWizardOpen}
          onClose={() => setNewProjectWizardOpen(false)}
          size="2xl"
          scrollable
          bare
        >
          <WizardBoundary><LazyNewProjectPage
            onClose={() => {
              setNewProjectWizardOpen(false);
              void loadProjects();
              void refreshAppData();
            }}
          /></WizardBoundary>
        </Modal>
      )}

      {/* Quick-view detail Sheet (HoverActions "View" on cards/rows) */}
      <ProjectDetailModal
        project={detailProject}
        canManage={canManageProjects}
        authToken={auth?.token}
        users={users}
        onClose={() => setDetailProject(null)}
        onEdit={() => {
          if (!detailProject) return;
          const target = detailProject;
          setDetailProject(null);
          openProjectEdit(target);
        }}
        onStatusChange={() => {
          void loadProjects();
          void refreshAppData();
        }}
      />

      {/* Edit Project — existing ProjectFormModal Sheet flow */}
      <ProjectFormModal
        open={editProjectOpen}
        title="Edit Project"
        submitLabel="Save"
        form={projectForm}
        setForm={setProjectForm}
        departments={departments}
        organizations={organizations}
        users={users}
        onSubmit={handleEditProject}
        onClose={() => {
          setEditProjectOpen(false);
          setEditProject(null);
        }}
      />

      {/* Delete confirm — exact existing centered ConfirmDeleteModal flow */}
      <ConfirmDeleteModal
        open={deleteProjectOpen}
        name={deleteProjectTarget?.name ?? "this project"}
        warning="All milestones and tasks under this project may be affected."
        onConfirm={handleDeleteProject}
        onClose={() => {
          setDeleteProjectOpen(false);
          setDeleteProjectTarget(null);
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectsSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/97  shadow-sm p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-2.5 w-1/5" />
            </div>
            <Skeleton className="h-2 w-24 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-7 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/60 bg-white/97  shadow-sm p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectSummaryCard({
  project,
  canManage,
  onOpen,
  onView,
  onEdit,
  onDelete,
}: {
  project: Project;
  canManage: boolean;
  onOpen: () => void;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
  const status = getStatusColor(project.status);
  const priority = getPriorityColor(project.priority);

  const alwaysActions: HoverActionDef[] = [];
  const hoverActions: HoverActionDef[] = [
    { icon: "view", label: "View project", onClick: () => onView(project) },
  ];
  if (canManage) {
    hoverActions.push({ icon: "edit", label: "Edit project", tone: "primary", onClick: () => onEdit(project) });
    hoverActions.push({ icon: "delete", label: "Delete project", tone: "danger", onClick: () => onDelete(project) });
  }

  const deptChips = (project.departments?.length
    ? project.departments.map((d) => d.departmentName || "")
    : [project.departmentName || ""]
  ).filter(Boolean);

  const compactDate = (date?: string | Date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear ? `${day} ${month}` : `${day} ${month} ${String(d.getFullYear()).slice(-2)}`;
  };

  const fullDate = (date?: string | Date) => {
    if (!date) return "Not set";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Not set";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group flex flex-col text-left h-full rounded-2xl border border-slate-200/60 bg-white/97  shadow-sm overflow-hidden transition-all duration-200 hover:shadow-xl ${status.shadowHoverColor}/10 hover:border-slate-300 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40`}
    >
      {/* Status-colored top accent */}
      <div className={`h-1 w-full ${status.dot} opacity-70`} />

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start gap-3">
          <div className="size-12 relative flex items-center justify-center shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="stroke-slate-100" cx="18" cy="18" fill="none" r="16" strokeWidth="3" />
              <circle
                className="stroke-indigo-500 transition-all duration-700"
                cx="18" cy="18" fill="none" r="16"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={(2 * Math.PI * 16) - (progress / 100) * (2 * Math.PI * 16)}
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-slate-600">{progress}%</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors"
                title={project.name}
              >
                {project.name}
              </h3>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.badgeBg} ${status.badgeText}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {STATUS_LABELS[project.status] || project.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {project.projectCode && (
                <span className="text-[10px] font-semibold text-slate-400 font-mono">{project.projectCode}</span>
              )}
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${priority.dot}`} />
                {project.priority}
              </span>
              {project.overdueTasks > 0 && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100"
                  title={`${project.overdueTasks} overdue task${project.overdueTasks > 1 ? "s" : ""}`}
                >
                  {project.overdueTasks} overdue
                </span>
              )}
            </div>
          </div>

          {/* HoverActions — delete always · view/edit revealed on hover/focus
              (respects Settings → "Row & card actions", stops propagation) */}
          <HoverActions
            entity="projects"
            className="shrink-0"
            always={alwaysActions}
            onHover={hoverActions}
          />
        </div>

        {project.description && (
          <p
            className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-2.5"
            title={project.description}
          >
            {project.description}
          </p>
        )}

        {deptChips.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            {deptChips.slice(0, 4).map((name, i) => {
              const dc = getDepartmentColor(i);
              return (
                <span
                  key={`${name}-${i}`}
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}
                  title={name}
                >
                  <span className={`w-1 h-1 rounded-full ${dc.dot}`} />
                  <span className="max-w-[120px] truncate">{name}</span>
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
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500 mt-auto pt-3 border-t border-slate-100">
          <span className="flex items-center gap-1 text-slate-400" title={`Start: ${fullDate(project.plannedStartDate)}`}>
            <Icon name="calendar_today" size={11} />
            <span>{compactDate(project.plannedStartDate)}</span>
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1 text-slate-400" title={`End: ${fullDate(project.plannedEndDate)}`}>
            <span>{compactDate(project.plannedEndDate)}</span>
          </span>

          <span
            className="flex items-center gap-1 text-slate-400"
            title={`${project.totalMilestones ?? 0} milestone${(project.totalMilestones ?? 0) === 1 ? "" : "s"}`}
          >
            <Icon name="hi-flag" size={11} />
            <span>{project.totalMilestones ?? 0}</span>
          </span>

          <span
            className="flex items-center gap-1 text-slate-400"
            title={`${project.totalTasks ?? 0} task${(project.totalTasks ?? 0) === 1 ? "" : "s"}`}
          >
            <Icon name="hi-clipboard" size={11} />
            <span>{project.totalTasks ?? 0}</span>
          </span>

          {project.projectManagerId && (
            <span className="flex items-center" title={`Manager: ${project.projectManagerName || "Unassigned"}`}>
              <Avatar person={undefined} name={project.projectManagerName} size="xs" className="ring-1" />
            </span>
          )}

          <span className="ml-auto font-medium text-slate-500" title="Planned budget (in lakhs)">
            {formatLakhs(project.plannedBudget)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectListView({
  projects,
  canManage,
  onOpen,
  onView,
  onEdit,
  onDelete,
}: {
  projects: Project[];
  canManage: boolean;
  onOpen: (id: string) => void;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const compactDate = (date?: string | Date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    const day = d.getDate();
    const month = d.toLocaleString("en-GB", { month: "short" });
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear ? `${day} ${month}` : `${day} ${month} ${String(d.getFullYear()).slice(-2)}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/97  shadow-sm overflow-hidden divide-y divide-slate-100">
      {projects.map((project, idx) => {
        const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
        const status = getStatusColor(project.status);
        const priority = getPriorityColor(project.priority);

        const alwaysActions: HoverActionDef[] = [];
        const hoverActions: HoverActionDef[] = [
          { icon: "view", label: "View project", onClick: () => onView(project) },
        ];
        if (canManage) {
          hoverActions.push({ icon: "edit", label: "Edit project", tone: "primary", onClick: () => onEdit(project) });
          hoverActions.push({ icon: "delete", label: "Delete project", tone: "danger", onClick: () => onDelete(project) });
        }
        return (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            aria-label={`Open project ${project.name}`}
            onClick={() => onOpen(project.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(project.id);
              }
            }}
            className="card-stagger w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/70 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40"
            style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
          >
            {/* Status dot */}
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`} title={STATUS_LABELS[project.status] || project.status} />

            {/* Name + code */}
            <div className="min-w-0 flex-1 md:flex-none md:w-[26%]">
              <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                {project.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                {project.projectCode && <span className="font-mono">{project.projectCode}</span>}
                {project.projectManagerName && (
                  <span className="truncate">· {project.projectManagerName}</span>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className="hidden md:block shrink-0">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.badgeBg} ${status.badgeText}`}>
                {STATUS_LABELS[project.status] || project.status}
              </span>
            </div>

            {/* Priority */}
            <div className="hidden lg:block shrink-0">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                {project.priority}
              </span>
            </div>

            {/* Progress mini bar */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 w-[110px]">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-600 w-8 text-right">{progress}%</span>
            </div>

            {/* Dates (wide enough for "15 Jan → 20 Dec 28" on one line) */}
            <div className="hidden lg:block text-[10px] text-slate-400 shrink-0 w-[150px] leading-tight">
              <div className="flex items-center gap-1 whitespace-nowrap">
                <Icon name="calendar_today" size={10} />
                {compactDate(project.plannedStartDate)} → {compactDate(project.plannedEndDate)}
              </div>
              {project.overdueTasks && project.overdueTasks > 0 ? (
                <span className="text-red-500 font-semibold whitespace-nowrap">{project.overdueTasks} overdue</span>
              ) : null}
            </div>

            {/* Team + counts */}
            <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
              <span className="flex items-center gap-1 text-[10px] text-slate-400" title={`${project.totalMilestones ?? 0} milestones`}>
                <Icon name="hi-flag" size={11} />
                {project.totalMilestones ?? 0}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400" title={`${project.totalTasks ?? 0} tasks`}>
                <Icon name="hi-clipboard" size={11} />
                {project.totalTasks ?? 0}
              </span>
              {project.projectManagerId && (
                <Avatar person={undefined} name={project.projectManagerName} size="xs" className="ring-1" />
              )}
            </div>

            {/* Budget */}
            <span className="hidden xl:inline text-xs font-medium text-slate-500 shrink-0" title="Planned budget (in lakhs)">
              {formatLakhs(project.plannedBudget)}
            </span>

            {/* HoverActions — delete always · view/edit revealed on hover/focus
                (respects Settings → "Row & card actions", stops propagation) */}
            <HoverActions
              entity="projects"
              className="shrink-0"
              always={alwaysActions}
              onHover={hoverActions}
            />
          </div>
        );
      })}
    </div>
  );
}
