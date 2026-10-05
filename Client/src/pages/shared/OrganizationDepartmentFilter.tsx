import { useMemo, useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
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

  // "fields" variant: bare labelled fields so the host can place them inside its
  // own filter grid alongside Project / Status / dates.
  if (variant === "fields") {
    return (
      <>
        {showOrganizationFilter && (
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Organization
            </label>
            <select
              value={selectedOrganizationId}
              onChange={(event) => handleOrganizationChange(event.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Department
          </label>
          <select
            value={selectedDepartmentId}
            onChange={(event) => onDepartmentChange(event.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Search
          </label>
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">
              search
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={` ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        

        {showOrganizationFilter && (
          <select
            value={selectedOrganizationId}
            onChange={(event) => handleOrganizationChange(event.target.value)}
            className="h-10 min-w-[280px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
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
          className="h-10 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          <option value="">{allDepartmentsLabel}</option>
          {visibleDepartments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <div className="relative min-w-[260px] flex-1 max-w-150">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">
            search
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

      </div>
    </div>
  );
}
