import { useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { Avatar, AvatarStack, GradientButton, StatCard } from "../shared";
import { useAuth } from "../../auth";
import { api } from "../../api";
import { DepartmentUsersModal } from "../NewProject/components/DepartmentUsersModal";
import { UserFormModal } from "../NewProject/components/UserFormModal";
import { Icon } from "../../components/ui/Icon";

interface DepartmentDetailCardProps {
  department: Department;
  organization?: OrganizationRecord;
  departmentHead?: User;
  parentDepartment?: Department;
  childCount: number;
  teamMembers?: User[];
  dashboard?: Record<string, unknown> | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  allDepartments?: Department[];
  allUsers?: User[];
  allOrganizations?: OrganizationRecord[];
  canManageUsers?: boolean;
  isSuperAdmin?: boolean;
  onRefresh?: () => void;
}

export function DepartmentDetailCard({
  department,
  organization,
  departmentHead,
  parentDepartment,
  childCount,
  teamMembers = [],
  dashboard,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  allDepartments = [],
  allUsers = [],
  allOrganizations = [],
  canManageUsers,
  isSuperAdmin,
  onRefresh,
}: DepartmentDetailCardProps) {
  const { auth } = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const activeProjects = Number(dashboard?.["activeProjects"] ?? 0);
  const completedProjects = Number(dashboard?.["completedProjects"] ?? 0);
  const teamMembersCount = teamMembers.length || Number(dashboard?.["teamMembers"] ?? 0);
  const avgWorkload = Math.round(Number(dashboard?.["averageWorkload"] ?? 0));
  const displayMembers = teamMembers.slice(0, 5);
  const extraCount = Math.max(0, teamMembers.length - 5);

  const handleAssignUserDepartments = async (userId: string, departmentIds: string[]) => {
    if (!auth) return;
    await api.assignUserDepartments(auth.token, userId, departmentIds);
    onRefresh?.();
  };

  const handleCreateUser = async (data: Record<string, unknown>) => {
    if (!auth) return;
    await api.registerUser(auth.token, data);
    setShowCreateUserModal(false);
    onRefresh?.();
  };

  const workloadColor =
    avgWorkload > 80
      ? "from-red-400 to-red-500"
      : avgWorkload > 60
        ? "from-amber-400 to-amber-500"
        : "from-emerald-400 to-emerald-500";

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
              <Icon name="groups" size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 truncate">{department.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {department.code}
                </span>
              </div>
              {organization && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Icon name="corporate_fare" size={11} className="text-slate-400" />
                  <span className="truncate">{organization.name}</span>
                  {parentDepartment && (
                    <>
                      <span className="text-slate-300">·</span>
                      <Icon name="subdirectory_arrow_right" size={11} className="text-slate-400" />
                      <span className="truncate">{parentDepartment.name}</span>
                    </>
                  )}
                  {childCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400">{childCount} sub-dept{childCount !== 1 ? "s" : ""}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && onEdit && (
              <GradientButton variant="ghost" onClick={onEdit}>
                <Icon name="edit" size={15} />
                Edit
              </GradientButton>
            )}
            {canDelete && onDelete && (
              <GradientButton variant="danger" onClick={onDelete}>
                <Icon name="delete" size={15} />
                Delete
              </GradientButton>
            )}
            {department.maxCapacity > 0 && (
              <div className="text-right bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity</p>
                <p className="text-xl font-bold text-slate-800 leading-tight">{department.maxCapacity}</p>
              </div>
            )}
          </div>
        </div>

        {department.description && (
          <p className="text-sm text-slate-600 leading-relaxed mt-3">{department.description}</p>
        )}
      </div>

      {/* Dashboard Stats */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-100">
        <StatCard label="Team Members" value={teamMembersCount} color="indigo" icon="people" />
        <StatCard label="Avg Workload" value={`${avgWorkload}%`} color="violet" icon="monitoring" />
        <StatCard label="Active Projects" value={activeProjects} color="emerald" icon="rocket_launch" />
        <StatCard label="Completed" value={completedProjects} color="blue" icon="task_alt" />
      </div>

      {/* Team Members */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Icon name="group" size={13} className="text-slate-400" />
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Team Members</h4>
            <span className="text-[10px] font-bold text-slate-400">· {teamMembers.length}</span>
          </div>
          {canManageUsers && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white text-indigo-600 border border-indigo-200 text-[11px] font-semibold hover:bg-indigo-50 transition-colors"
              >
                <Icon name="group_add" size={13} />
                Manage
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors"
              >
                <Icon name="person_add" size={13} />
                New User
              </button>
            </div>
          )}
        </div>

        {teamMembers.length > 0 ? (
          <div className="flex items-center gap-3 flex-wrap">
            <AvatarStack people={displayMembers} limit={5} size="md" />
            {extraCount > 0 && <span className="sr-only">{extraCount} more team members</span>}
            {departmentHead && (
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Head</span>
                <Avatar
                  person={departmentHead}
                  size="md"
                  className="border-2 border-indigo-300 ring-indigo-100"
                />
                <span
                  className={`text-sm font-semibold ${
                    departmentHead.isActive === false ? "text-red-500" : "text-slate-700"
                  }`}
                >
                  {departmentHead.fullName}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No users assigned to this department.</p>
        )}
      </div>

      {/* Workload Bar */}
      {avgWorkload > 0 && (
        <div className="px-5 pb-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1 text-slate-500 font-semibold">
              <Icon name="monitoring" size={12} className="text-slate-400" />
              Team Workload
            </span>
            <span
              className={`font-bold ${
                avgWorkload > 80 ? "text-red-600" : avgWorkload > 60 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {avgWorkload}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${workloadColor}`}
              style={{ width: `${Math.min(avgWorkload, 100)}%` }}
            />
          </div>
        </div>
      )}

      {showUserModal && (
        <DepartmentUsersModal
          department={department}
          allDepartments={allDepartments}
          allUsers={allUsers}
          onSave={handleAssignUserDepartments}
          onCancel={() => setShowUserModal(false)}
        />
      )}

      {showCreateUserModal && (
        <UserFormModal
          organizations={allOrganizations}
          defaultOrganizationId={organization?.id || ""}
          hideOrganization={!isSuperAdmin}
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateUserModal(false)}
        />
      )}
    </div>
  );
}
