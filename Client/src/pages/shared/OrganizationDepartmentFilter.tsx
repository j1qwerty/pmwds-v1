import { useMemo, useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { usePermission } from "./RoleGate";
import { useUserOrganization } from "./useUserOrganization";

type OrganizationDepartmentFilterProps = {
  organizations: OrganizationRecord[];
  departments: Department[];
  users: User[];
  selectedOrganizationId: string;
  selectedDepartmentId: string;
  onOrganizationChange: (organizationId: string) => void;
  onDepartmentChange: (departmentId: string) => void;
  allOrganizationsLabel?: string;
  allDepartmentsLabel?: string;
  className?: string;
  /**
   * "toolbar" (default) renders a standalone row of selects.
   * "fields" renders each control as a labelled field (no wrapper element) so
   * the parent can drop them straight into its own filter grid.
   */
  variant?: "toolbar" | "fields";
  searchPlaceholder?: string;
};

const SELECT_CLASS =
  "rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

const SEARCH_CLASS =
  "w-full rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

export function OrganizationDepartmentFilter({
  organizations,
  departments,
  users,
  selectedOrganizationId,
  selectedDepartmentId,
  onOrganizationChange,
  onDepartmentChange,
  allOrganizationsLabel = "All Organizations",
  allDepartmentsLabel = "All Departments",
  className = "",
  variant = "toolbar",
  searchPlaceholder = "Search ...",
}: OrganizationDepartmentFilterProps) {
  const perm = usePermission();
  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);
  const [search, setSearch] = useState("");

  const effectiveOrganizationId = shouldFilterByOrg ? userOrganizationId ?? selectedOrganizationId : selectedOrganizationId;
  const visibleOrganizations = useMemo(() => {
    const scoped = shouldFilterByOrg && userOrganizationId
      ? organizations.filter((organization) => organization.id === userOrganizationId)
      : organizations;
    const term = search.trim().toLowerCase();
    return term ? scoped.filter((organization) => organization.name.toLowerCase().includes(term)) : scoped;
  }, [organizations, search, shouldFilterByOrg, userOrganizationId]);

  const visibleDepartments = useMemo(() => {
    const scoped = departments.filter((department) => {
      if (effectiveOrganizationId) return department.organizationId === effectiveOrganizationId;
      if (shouldFilterByOrg && userOrganizationId) return department.organizationId === userOrganizationId;
      return true;
    });
    const term = search.trim().toLowerCase();
    return term
      ? scoped.filter((department) =>
          department.name.toLowerCase().includes(term) ||
          department.code.toLowerCase().includes(term))
      : scoped;
  }, [departments, effectiveOrganizationId, search, shouldFilterByOrg, userOrganizationId]);

  const showOrganizationFilter = perm.isSuperAdmin;

  const handleOrganizationChange = (organizationId: string) => {
    onOrganizationChange(organizationId);
    onDepartmentChange("");
  };

  const searchField = (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon name="search" size={14} />
      </span>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search"
        className={`${SEARCH_CLASS} h-9 pl-8 pr-3`}
      />
    </div>
  );

  // "fields" variant: bare labelled fields so the host can place them inside its
  // own filter grid alongside Project / Status / dates.
  if (variant === "fields") {
    return (
      <>
        {showOrganizationFilter && (
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Organization
            </label>
            <select
              value={selectedOrganizationId}
              onChange={(event) => handleOrganizationChange(event.target.value)}
              className={`h-9 w-full px-3 ${SELECT_CLASS}`}
            >
              <option value="">{allOrganizationsLabel}</option>
              {visibleOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Department
          </label>
          <select
            value={selectedDepartmentId}
            onChange={(event) => onDepartmentChange(event.target.value)}
            className={`h-9 w-full px-3 ${SELECT_CLASS}`}
          >
            <option value="">{allDepartmentsLabel}</option>
            {visibleDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Search
          </label>
          {searchField}
        </div>
      </>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm">
        {showOrganizationFilter && (
          <select
            value={selectedOrganizationId}
            onChange={(event) => handleOrganizationChange(event.target.value)}
            className={`h-9 min-w-[220px] px-3 ${SELECT_CLASS}`}
          >
            <option value="">{allOrganizationsLabel}</option>
            {visibleOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedDepartmentId}
          onChange={(event) => onDepartmentChange(event.target.value)}
          className={`h-9 min-w-[200px] px-3 ${SELECT_CLASS}`}
        >
          <option value="">{allDepartmentsLabel}</option>
          {visibleDepartments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-1 max-w-[28rem]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" size={14} />
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className={`${SEARCH_CLASS} h-9 pl-8 pr-3`}
          />
        </div>

      </div>
    </div>
  );
}
