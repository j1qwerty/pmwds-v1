import type { Department, OrganizationRecord, User } from "../../types";
import { formatPercent } from "../../ui";
import { Avatar, AvatarStack } from "../shared";

interface DepartmentDetailCardProps {
  department: Department;
  organization?: OrganizationRecord;
  departmentHead?: User;
  parentDepartment?: Department;
  childCount: number;
  teamMembers?: User[];
  dashboard?: Record<string, unknown> | null;
}

export function DepartmentDetailCard({
  department,
  organization,
  departmentHead,
  parentDepartment,
  childCount,
  teamMembers = [],
  dashboard,
}: DepartmentDetailCardProps) {
  const activeProjects = Number(dashboard?.["activeProjects"] ?? 0);
  const completedProjects = Number(dashboard?.["completedProjects"] ?? 0);
  const teamMembersCount = teamMembers.length || Number(dashboard?.["teamMembers"] ?? 0);
  const avgWorkload = Math.round(Number(dashboard?.["averageWorkload"] ?? 0));
  const capacityPercent = Math.min((department.capacityUtilization || 0) * 100, 100);
  const extraCount = Math.max(0, teamMembers.length - 4);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl text-indigo-600">groups</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{department.name}</h3>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-600">
                {department.code}
              </span>
              {organization && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">business</span>
                  {organization.name}
                </span>
              )}
            </div>
          </div>
        </div>
        {department.maxCapacity > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-400 font-medium">Max Capacity</p>
            <p className="text-2xl font-bold text-slate-800">{department.maxCapacity}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {department.description && (
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">{department.description}</p>
      )}

      {/* Capacity Bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-slate-500 font-medium">Capacity Utilization</span>
          <span className={`font-semibold ${capacityPercent > 80 ? 'text-amber-600' : capacityPercent > 60 ? 'text-emerald-600' : 'text-slate-600'}`}>
            {formatPercent(department.capacityUtilization)}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-violet-500`}
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
          <span className="material-symbols-outlined text-slate-400">business</span>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase">Organization</div>
            <div className="text-sm font-medium text-slate-700">{organization?.name ?? "Unassigned"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
          <span className="material-symbols-outlined text-slate-400">account_tree</span>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase">Parent Dept</div>
            <div className="text-sm font-medium text-slate-700">{parentDepartment?.name ?? "None"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
          <span className="material-symbols-outlined text-slate-400">person</span>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase">Dept Head</div>
            <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
              {departmentHead ? (
                <>
                  <Avatar person={departmentHead} size="sm" className="shadow-none ring-0" />
                  <span className={departmentHead.isActive === false ? "text-red-500" : ""}>{departmentHead.fullName}</span>
                </>
              ) : (
                "Unassigned"
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
          <span className="material-symbols-outlined text-slate-400">subdirectory_arrow_right</span>
          <div>
            <div className="text-[10px] font-medium text-slate-400 uppercase">Sub-depts</div>
            <div className="text-sm font-medium text-slate-700">{childCount}</div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-slate-100 bg-white p-3 text-center">
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Members</p>
          <p className="text-xl font-bold text-slate-800">{teamMembersCount}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 text-center">
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Workload</p>
          <p className="text-xl font-bold text-slate-800">{avgWorkload}%</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 text-center">
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Active</p>
          <p className="text-xl font-bold text-emerald-600">{activeProjects}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-3 text-center">
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Done</p>
          <p className="text-xl font-bold text-indigo-600">{completedProjects}</p>
        </div>
      </div>

      {/* Team Members Section */}
      {teamMembers.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Members</h4>
            <span className="text-xs text-slate-400">{teamMembers.length} members</span>
          </div>
          <div className="flex items-center gap-3">
            <AvatarStack people={teamMembers} limit={4} size="md" />
            {extraCount > 0 && <span className="sr-only">{extraCount} more team members</span>}
            {departmentHead && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium">Head:</span>
                <Avatar person={departmentHead} size="md" />
                <span className={departmentHead.isActive === false ? "text-[10px] text-red-500 font-medium" : "text-[10px] text-slate-400 font-medium"}>{departmentHead.fullName}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
