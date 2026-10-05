import { useMemo } from "react";
import type { Department, OrganizationRecord } from "../../types";
import { Icon } from "../../components/ui/Icon";

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
  organizationName,
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

  return (
    <div className="bg-white rounded-2xl p-5 max-h-[calc(100vh-20px)] flex flex-col shadow-lg border border-blue-100">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
          All Departments
        </h3>
      </div>

      {/* Organization Dropdown - Super Admin only */}
      {isSuperAdmin && organizations && onSelectOrg && (
        <div className="mb-4">
          <select
            value={selectedOrgId || ""}
            onChange={(e) => {
              onSelectOrg(e.target.value);
            }}
            className="w-full h-11 px-4 rounded-xl bg-blue-50/50 border border-blue-100 text-sm text-slate-700 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-11 px-4 rounded-xl bg-blue-50/50 border border-blue-100 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        {searchTerm && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {filteredList.length}/{departments.length}
            </span>
          </div>
        )}
      </div>

      {/* Department List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 pb-2">
        {filteredList.map((dept, index) => (
          <DepartmentListItem
            key={dept.id}
            department={dept}
            isSelected={selectedDeptId === dept.id}
            onClick={() => onSelectDept(dept.id)}
          />
        ))}

        {filteredList.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm font-medium text-slate-400">
              {searchTerm ? "No departments found" : "No departments"}
            </p>
            <p className="text-xs mt-1 text-slate-400">
              {searchTerm ? "Try adjusting your search" : "No departments available"}
            </p>
          </div>
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
      onClick={onClick}
      className={`
        group relative text-left p-4 rounded-xl cursor-pointer transition-all duration-200
        border
        ${
          isSelected
            ? "bg-blue-50/80 border-blue-700 "
            : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-md hover:shadow-blue-300"
        }
      `}
    >
      {/* Selected glow effect */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl bg-linear-to-r from-blue-400/5 to-blue-500/5 ring-1 ring-blue-300/30 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]" />
      )}
      
      <div className="relative flex items-center justify-between gap-4">
        {/* Department Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5 mb-1">
            <span className={`
              font-medium text-sm truncate transition-colors duration-200
              ${isSelected ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'}
            `}>
              {department.name}
            </span>
            <span className={`
              text-[10px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-md border
              ${isSelected 
                ? 'bg-blue-100 text-blue-600 border-blue-200' 
                : 'bg-slate-100 text-slate-500 border-slate-200'}
            `}>
              {department.code}
            </span>
          </div>
          {department.description && (
            <p className={`
              text-xs truncate leading-relaxed
              ${isSelected ? 'text-blue-400' : 'text-slate-400'}
            `}>
              {department.description}
            </p>
          )}
        </div>

        {/* Chevron indicator */}
        <div className={`
          shrink-0 transition-all duration-300
          ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}
        `}>
          <Icon name="chevron-right" size={16} className={`${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
        </div>
      </div>
    </button>
  );
}