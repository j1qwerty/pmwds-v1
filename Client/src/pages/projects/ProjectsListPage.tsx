import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, Project, User } from "../../types";
import {
  AnimatedBackground,
  LoadingPage,
  ModalOverlay,
  PERMISSION_GROUPS,
  useNavHeader,
  usePermission,
  useToast,
  projectBelongsToAnyDepartment,
  projectBelongsToDepartment,
  getStatusColor,
  getPriorityColor,
} from "../shared";
import { CustomDropdown } from "../shared/customDropdown";
import { useUserOrganization } from "../shared/useUserOrganization";
import { NewProjectPage } from "../NewProject/NewProjectPage";
import { Avatark } from "../shared/Avatark";
import { Icon } from "../../components/ui/Icon";
import { formatLakhs } from "../../ui";

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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "startAsc", label: "Start date (soonest)" },
  { value: "endAsc", label: "End date (soonest)" },
  { value: "progressDesc", label: "Progress (high → low)" },
  { value: "progressAsc", label: "Progress (low → high)" },
];

const DATE_FIELD_OPTIONS: { value: DateField; label: string }[] = [
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

function toIsoDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * "Now" is captured once at module load instead of during render, so the
 * derived filters stay pure and stable between renders.
 */
const SESSION_NOW = Date.now();

const FILTER_INPUT =
  "h-10 px-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-colors";

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

  // Escape closes the expanded filter row. No outside-click listener is needed:
  // the extra filters render inline in the card rather than in a floating
  // overlay, so there is no layer to dismiss and nothing can intercept clicks.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

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

  // Role-based org scope wins over the explicit filter, so derive it instead of
  // syncing it into state after render.
  const effectiveOrgId =
    shouldFilterByOrg && userOrganizationId ? userOrganizationId : orgId;

  const visibleOrganizations = useMemo(() => {
    if (shouldFilterByOrg && userOrganizationId) {
      return organizations.filter((org) => org.id === userOrganizationId);
    }
    return organizations;
  }, [organizations, shouldFilterByOrg, userOrganizationId]);

  const orgOptions = useMemo(
    () => [
      { value: "", label: "All Organizations" },
      ...visibleOrganizations.map((o) => ({ value: o.id, label: o.name })),
    ],
    [visibleOrganizations]
  );

  const deptOptions = useMemo(() => {
    const scoped = effectiveOrgId
      ? departments.filter((d) => d.organizationId === effectiveOrgId)
      : departments;
    return [
      { value: "", label: "All Departments" },
      ...scoped.map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [departments, effectiveOrgId]);

  const statusOptions = useMemo(
    () => [
      { value: "", label: "All Statuses" },
      ...[...new Set(projects.map((p) => p.status).filter(Boolean))].map((s) => ({
        value: s,
        label: STATUS_LABELS[s] || s,
      })),
    ],
    [projects]
  );

  const priorityOptions = useMemo(
    () => [
      { value: "", label: "All Priorities" },
      ...[...new Set(projects.map((p) => p.priority).filter(Boolean))].map((p) => ({
        value: p,
        label: p,
      })),
    ],
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();

    let list = projects;

    // Organization scope (role based first, then the explicit filter).
    if (effectiveOrgId) {
      const orgDeptIds = departments.filter((d) => d.organizationId === effectiveOrgId).map((d) => d.id);
      list = list.filter((p) => projectBelongsToAnyDepartment(p, orgDeptIds));
    }
    if (deptId) {
      list = list.filter((p) => projectBelongsToDepartment(p, deptId));
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

  const applyDatePreset = (preset: "all" | "thisMonth" | "next30" | "createdThisMonth") => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    switch (preset) {
      case "all":
        setDateFrom("");
        setDateTo("");
        setOverdueOnly(false);
        break;
      case "thisMonth":
        setDateField("plannedEnd");
        setDateFrom(toIsoDate(monthStart.toISOString()));
        setDateTo(toIsoDate(monthEnd.toISOString()));
        break;
      case "next30": {
        const end = new Date(now);
        end.setDate(end.getDate() + 30);
        setDateField("plannedEnd");
        setDateFrom(toIsoDate(now.toISOString()));
        setDateTo(toIsoDate(end.toISOString()));
        break;
      }
      case "createdThisMonth":
        setDateField("created");
        setDateFrom(toIsoDate(monthStart.toISOString()));
        setDateTo(toIsoDate(monthEnd.toISOString()));
        break;
    }
  };

  const activeFilterCount =
    (query ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (deptId ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (overdueOnly ? 1 : 0);

  /** Filters hidden inside the overflow panel, used for its badge. */
  const overflowFilterCount =
    (orgId ? 1 : 0) + (dateFrom || dateTo ? 1 : 0) + (overdueOnly ? 1 : 0);

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

      {/* ── Search + Filters ── */}
      <div
        className={`relative mb-4 rounded-2xl border border-slate-100 bg-white/90 backdrop-blur-sm p-4 shadow-sm space-y-3 ${
          // Raised while the filter row is open so dropdown menus that overflow
          // this card paint above the results meta and the project cards below,
          // which share the same z-10 stacking level.
          filtersOpen ? "z-30" : "z-10"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Icon name="search" size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              className={`${FILTER_INPUT} w-full pl-9`}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, description, department or manager..."
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Clear search"
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          <CustomDropdown
            className="w-[180px] shrink-0"
            value={deptId}
            onChange={setDeptId}
            options={deptOptions}
            placeholder="All Departments"
          />

          <CustomDropdown
            className="w-[160px] shrink-0"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="All Statuses"
          />

          <CustomDropdown
            className="w-[150px] shrink-0"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={priorityOptions}
            placeholder="All Priorities"
          />

          {/* Overflow filters (organization, sort, date) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-haspopup="true"
              title="More filters and sorting"
              className={`flex items-center gap-1.5 h-10 px-3 text-sm font-medium rounded-xl border transition-colors ${
                filtersOpen || overflowFilterCount > 0
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon name="hi-filter" size={16} />
              <span className="hidden sm:inline">Filters</span>
              {overflowFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {overflowFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                title="Clear all filters"
                className="flex items-center justify-center size-10 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
              >
                <Icon name="close" size={16} />
              </button>
            )}

            </div>
          </div>

          {/* Expanded filter row - inline, so no overlay can swallow clicks. */}
          {filtersOpen && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-end gap-2 flex-wrap">
                {isSuperAdmin && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Organization
                    </p>
                    <CustomDropdown
                      value={orgId}
                      onChange={(val) => {
                        setOrgId(val);
                        setDeptId("");
                      }}
                      options={orgOptions}
                      placeholder="All Organizations"
                    />
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Sort by
                  </p>
                  <CustomDropdown
                    value={sortKey}
                    onChange={(val) => setSortKey(val as SortKey)}
                    options={SORT_OPTIONS}
                    placeholder="Sort"
                  />
                </div>

                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Icon name="calendar" size={14} />
                    Date
                  </p>

                  <div className="flex items-center gap-2">
                    <CustomDropdown
                      className="w-[150px] shrink-0"
                      value={dateField}
                      onChange={(val) => setDateField(val as DateField)}
                      options={DATE_FIELD_OPTIONS}
                      placeholder="Date field"
                    />
                    <input
                      type="date"
                      aria-label="From date"
                      className={FILTER_INPUT}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <span className="text-slate-400 text-xs shrink-0">to</span>
                    <input
                      type="date"
                      aria-label="To date"
                      className={FILTER_INPUT}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Presets
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyDatePreset("all")}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        !dateFrom && !dateTo
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      All dates
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset("thisMonth")}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Ends this month
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset("next30")}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Next 30 days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset("createdThisMonth")}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Created this month
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverdueOnly((v) => !v)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        overdueOnly
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Overdue only
                    </button>
                  </div>
                </div>

                <div className="flex items-end gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setOrgId("");
                      setDateFrom("");
                      setDateTo("");
                      setOverdueOnly(false);
                      setSortKey("newest");
                    }}
                    className="h-10 px-3 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Reset these
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="h-10 px-3 rounded-xl text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Done
                  </button>
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
      </div>

      {/* ── Project cards ── */}
      {filteredProjects.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-24 text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white/60">
          <Icon name="folder_open" size={48} className="mb-3" />
          <p className="text-sm font-medium">No projects match your filters</p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
          {filteredProjects.map((project) => (
            <ProjectSummaryCard
              key={project.id}
              project={project}
              users={users}
              onOpen={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {newProjectWizardOpen && (
        <ModalOverlay onClose={() => setNewProjectWizardOpen(false)} widthClassName="max-w-4xl">
          <NewProjectPage
            onClose={() => {
              setNewProjectWizardOpen(false);
              void loadProjects();
              void refreshAppData();
            }}
          />
        </ModalOverlay>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProjectSummaryCard({
  project,
  users,
  onOpen,
}: {
  project: Project;
  users: User[];
  onOpen: () => void;
}) {
  const progress = Math.min(Math.round(project.progressPercentage || 0), 100);
  const status = getStatusColor(project.status);
  const priority = getPriorityColor(project.priority);
  const manager = project.projectManagerId
    ? users.find((u) => u.id === project.projectManagerId)
    : undefined;

  const deptNames = project.departments?.length
    ? project.departments.map((d) => d.departmentName).filter(Boolean).join(", ")
    : project.departmentName || "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col text-left rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
    >
      {/* Header: progress ring + name + status */}
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
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {project.projectCode && (
              <span className="text-[10px] font-semibold text-slate-400">{project.projectCode}</span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${priority.dot}`} />
              {project.priority}
            </span>
            {deptNames && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {deptNames}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-2" title={project.description}>
          {project.description}
        </p>
      )}

      {/* Manager + budget */}
      <div className="flex items-center gap-2 flex-wrap mt-3">
        {project.projectManagerId && (
          <span className="flex items-center gap-1.5" title="Project Manager">
            <Avatark person={manager} name={project.projectManagerName} size="xs" />
            <span
              className={`text-[11px] font-medium max-w-[140px] truncate ${
                manager?.isActive === false ? "text-red-500" : "text-slate-600"
              }`}
            >
              {manager?.fullName || project.projectManagerName}
            </span>
          </span>
        )}
        <span className="text-[11px] text-slate-500" title="Planned budget (in lakhs)">
          {formatLakhs(project.plannedBudget)}
        </span>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 flex-wrap">
        <Icon name="calendar" size={12} />
        <span>{formatShortDate(project.plannedStartDate)}</span>
        <span className="text-slate-300">→</span>
        <span>{formatShortDate(project.plannedEndDate)}</span>
        {project.overdueTasks > 0 && (
          <span className="text-[10px] font-bold text-red-500">
            {project.overdueTasks} overdue task{project.overdueTasks > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Footer counts */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <Icon name="hi-flag" size={14} className="text-slate-400" />
          {project.totalMilestones ?? 0} milestones
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="hi-clipboard" size={14} className="text-slate-400" />
          {project.totalTasks} tasks
        </span>
        <span className="flex items-center gap-1 text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open
          <Icon name="arrow_forward" size={12} />
        </span>
      </div>
    </button>
  );
}

