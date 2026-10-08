import { useMemo } from "react";
import type { Department, OrganizationRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";
import { FilterDropdown, EmptyState } from "../shared";

interface DepartmentListProps {
  departments: Department[];
  selectedDeptId: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectDept: (id: string) => void;
  organizationName?: string;
  organizations?: OrganizationRecord[];
  selectedOrgId?: string;
  onSelectOrg?: (id: string) => void;
  isSuperAdmin?: boolean;
}

export function DepartmentList({
  departments,
  selectedDeptId,
  searchTerm,
  onSearchChange,
  onSelectDept,
  organizations,
  selectedOrgId,
  onSelectOrg,
  isSuperAdmin,
}: DepartmentListProps) {
  const filteredList = useMemo(() => {
    if (!searchTerm) return departments;
    const search = searchTerm.toLowerCase();
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(search) ||
        dept.code.toLowerCase().includes(search) ||
        (dept.description && dept.description.toLowerCase().includes(search))
    );
  }, [departments, searchTerm]);

  const orgOptions = useMemo(
    () => (organizations ?? []).map((org) => ({ value: org.id, label: org.name })),
    [organizations],
  );

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm flex flex-col max-h-[calc(100vh-220px)] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon name="groups" size={15} className="text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Departments</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {filteredList.length}/{departments.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon name="search" size={14} />
          </span>
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
          />
        </div>

        {/* Organization Dropdown — Super Admin only */}
        {isSuperAdmin && organizations && onSelectOrg && (
          <FilterDropdown
            value={selectedOrgId ?? ""}
            onChange={onSelectOrg}
            label="Org"
            icon="corporate_fare"
            options={orgOptions}
            width="w-full"
          />
        )}
      </div>

      {/* Department List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredList.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {filteredList.map((dept) => (
              <DepartmentListItem
                key={dept.id}
                department={dept}
                isSelected={selectedDeptId === dept.id}
                onClick={() => onSelectDept(dept.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search_off"
            title={searchTerm ? "No matches" : "No departments"}
            description={searchTerm ? "Try a different search term." : "Create one to get started."}
            compact
            accent="neutral"
          />
        )}
      </div>
    </div>
  );
}

// Department List Item Component
function DepartmentListItem({
  department,
  isSelected,
  onClick,
}: {
  department: Department;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left p-3 rounded-xl transition-all duration-200 border ${
        isSelected
          ? "bg-indigo-50/80 border-indigo-200 shadow-sm"
          : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/60"
      }`}
    >
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className={`font-semibold text-sm truncate transition-colors duration-200 ${
                isSelected ? "text-indigo-700" : "text-slate-700 group-hover:text-slate-900"
              }`}
            >
              {department.name}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded-md border ${
                isSelected
                  ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {department.code}
            </span>
          </div>
          {department.description && (
            <p
              className={`text-[11px] truncate leading-relaxed ${
                isSelected ? "text-indigo-500" : "text-slate-400"
              }`}
            >
              {department.description}
            </p>
          )}
        </div>

        <div
          className={`shrink-0 transition-all duration-300 ${
            isSelected
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
          }`}
        >
          <Icon
            name="chevron_right"
            size={16}
            className={isSelected ? "text-indigo-500" : "text-slate-400"}
          />
        </div>
      </div>
    </button>
  );
}
