import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Project } from "../../types";
import {
  AnimatedBackground,
  LoadingPage,
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
} from "../shared/index";
import { useUserOrganization } from "../shared/useUserOrganization";
import { NewProjectPage } from "../NewProject/NewProjectPage";
import { Icon } from "../../components/ui/Icon";
import { formatLakhs } from "../../lib/formatters";

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
  { value: "startAsc", label: "Start date (soonest)" },
  { value: "endAsc", label: "End date (soonest)" },
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

const STATUS_DOT_MAP: Record<string, string> = {
  NotStarted: "bg-slate-400",
  InProgress: "bg-blue-500",
  OnHold: "bg-purple-500",
  Completed: "bg-emerald-500",
  Delayed: "bg-amber-500",
  Cancelled: "bg-red-500",
  Pending: "bg-slate-400",
  Active: "bg-blue-500",
  Planning: "bg-cyan-500",
};

function toIsoDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const SESSION_NOW = Date.now();

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
  const [viewMode, setViewMode] = useState<ViewMode>("card");

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

  const statusOptions = useMemo(
    () =>
      [...new Set(projects.map((s) => s.status).filter(Boolean))].map((s) => ({
        value: s,
        label: STATUS_LABELS[s] || s,
        dot: STATUS_DOT_MAP[s] || "bg-slate-400",
      })),
    [projects]
  );

  const priorityOptions = useMemo(
    () =>
      [...new Set(projects.map((p) => p.priority).filter(Boolean))].map((p) => ({
        value: p,
        label: p,
        dot:
          p === "Critical" || p === "High"
            ? "bg-red-500"
            : p === "Medium"
              ? "bg-blue-500"
              : "bg-slate-400",
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

  if (loading) return <LoadingPage label="Loading projects..." />;

  return (
    <div className="relative">
      <AnimatedBackground />

      {/* ── Filter Bar ── */}
      <div className="relative z-10 mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search by name, code, manager..."
          actions={
            <>
              <FilterDropdown
                value={deptId}
                onChange={setDeptId}
                label="Dept"
                icon="business"
                options={deptOptions}
                width="min-w-[160px]"
              />
              <FilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                label="Status"
                icon="flag"
                options={statusOptions}
                width="min-w-[150px]"
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
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  filtersOpen || activeFilterCount > 0
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <Icon name="tune" size={14} />
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
          <div className="mt-2 p-4 bg-white rounded-xl border border-slate-200/70 shadow-sm view-fade">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {isSuperAdmin && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  From
                </p>
                <input
                  type="date"
                  aria-label="From date"
                  className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  To
                </p>
                <input
                  type="date"
                  aria-label="To date"
                  className="w-full h-9 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
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

      {/* ── Results meta ── */}
      <div className="relative z-10 mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filteredProjects.length}</strong> of{" "}
          {projects.length} projects
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            <Icon name="filter_alt_off" size={12} />
            Clear filters
          </button>
        )}
      </div>

      {/* ── Project cards / list ── */}
      {filteredProjects.length === 0 ? (
        <div className="relative z-10">
          <EmptyState
            icon="folder_open"
            title="No projects match your filters"
            description={activeFilterCount > 0 ? "Try clearing some filters to see more projects." : "Get started by creating your first project."}
            accent="primary"
            action={
              activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
                >
                  <Icon name="filter_alt_off" size={14} />
                  Clear all filters
                </button>
              ) : canManageProjects ? (
                <button
                  type="button"
                  onClick={() => setNewProjectWizardOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
                >
                  <Icon name="add" size={14} />
                  New Project
                </button>
              ) : undefined
            }
          />
        </div>
      ) : viewMode === "card" ? (
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
          {filteredProjects.map((project, idx) => (
            <div key={project.id} className="card-stagger" style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
              <ProjectSummaryCard
                project={project}
                onOpen={() => navigate(`/projects/${project.id}`)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 pb-10 view-fade">
          <ProjectListView projects={filteredProjects} onOpen={(id) => navigate(`/projects/${id}`)} />
        </div>
      )}

      {newProjectWizardOpen && (
        <Modal
          open={newProjectWizardOpen}
          onClose={() => setNewProjectWizardOpen(false)}
          size="2xl"
          scrollable
        >
          <NewProjectPage
            onClose={() => {
              setNewProjectWizardOpen(false);
              void loadProjects();
              void refreshAppData();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectSummaryCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
  const status = getStatusColor(project.status);
  const priority = getPriorityColor(project.priority);

  const deptNames = project.departments?.length
    ? project.departments.map((d) => d.departmentName).filter(Boolean).join(", ")
    : project.departmentName || "";

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
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col text-left h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="size-12 relative flex items-center justify-center shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
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
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.bg} ${status.text}`}
            >
              {STATUS_LABELS[project.status] || project.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {project.projectCode && (
              <span className="text-[10px] font-semibold text-slate-400">{project.projectCode}</span>
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
      </div>

      {project.description && (
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-2.5" title={project.description}>
          {project.description}
        </p>
      )}

      {deptNames && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Icon name="business" size={11} className="text-slate-400" />
          <span className="text-[10px] font-medium text-slate-500 truncate">{deptNames}</span>
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

        <span className="ml-auto font-medium text-slate-500" title="Planned budget (in lakhs)">
          {formatLakhs(project.plannedBudget)}
        </span>

        <span className="flex items-center gap-1 text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open
          <Icon name="arrow_forward" size={11} />
        </span>
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectListView({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
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
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Project</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Status</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Priority</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Progress</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Dates</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Tasks</th>
              <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Budget</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
              const status = getStatusColor(project.status);
              const priority = getPriorityColor(project.priority);
              return (
                <tr
                  key={project.id}
                  onClick={() => onOpen(project.id)}
                  className="cursor-pointer hover:bg-indigo-50/30 transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 line-clamp-1">
                          {project.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {project.projectCode && <span className="font-mono">{project.projectCode}</span>}
                          {project.projectManagerName && (
                            <span className="ml-2">· {project.projectManagerName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${status.dot}`} />
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${priority.dot}`} />
                      {project.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <div>{compactDate(project.plannedStartDate)}</div>
                    <div className="text-slate-400">→ {compactDate(project.plannedEndDate)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold text-slate-600">{project.totalTasks ?? 0}</span>
                    {project.overdueTasks && project.overdueTasks > 0 ? (
                      <span className="block text-[10px] text-red-500 font-medium">{project.overdueTasks} overdue</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-slate-600">
                    {formatLakhs(project.plannedBudget)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
