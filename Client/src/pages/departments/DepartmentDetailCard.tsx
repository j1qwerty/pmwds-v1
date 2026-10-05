import { useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { formatPercent } from "../../ui";
import { Avatar, AvatarStack, GradientButton } from "../shared";
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
  const capacityPercent = Math.min((department.capacityUtilization || 0) * 100, 100);
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Icon name="groups" size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{department.name}</h3>
            <span className="items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
              {department.code}
            </span>


            {/* Description */}
            {department.description && (
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">{department.description}</p>
            )}

          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && onEdit && (
            <GradientButton variant="ghost" onClick={onEdit}>
              <Icon name="edit" size={16} />
              Edit
            </GradientButton>
          )}
          {canDelete && onDelete && (
            <GradientButton variant="danger" onClick={onDelete}>
              <Icon name="delete" size={16} />
              Delete
            </GradientButton>
          )}
          {department.maxCapacity > 0 && (
            <div className="text-right bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Capacity</p>
              <p className="text-2xl font-bold text-slate-800">{department.maxCapacity}</p>
            </div>
          )}
        </div>
      </div>




      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Team Members" value={teamMembersCount} color="indigo" />
        <StatCard label="Avg Workload" value={`${avgWorkload}%`} color="slate" />
        <StatCard label="Active Projects" value={activeProjects} color="emerald" />
        <StatCard label="Completed" value={completedProjects} color="sky" />
      </div>

      {/* Team Members Section */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Members</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{teamMembers.length} members</span>
            {canManageUsers && (
              <>
                <button
                  type="button"
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Icon name="edit" size={15} />
                  Users
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <Icon name="person_add" size={15} />
                  New User
                </button>
              </>
            )}
          </div>
        </div>
        {teamMembers.length > 0 ? (
          <div className="flex items-center gap-3">
            <AvatarStack people={displayMembers} limit={5} size="md" />
            {extraCount > 0 && <span className="sr-only">{extraCount} more team members</span>}
            {departmentHead && (
              <div className="flex items-center gap-2 ml-4 pl-4 border-l-2 border-slate-200">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Head</span>
                <Avatar person={departmentHead} size="md" className="border-2 border-indigo-300 ring-indigo-100" />
                <span className={`text-sm font-medium ${departmentHead.isActive === false ? "text-red-500" : "text-slate-700"}`}>{departmentHead.fullName}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No users assigned to this department.</p>
        )}
      </div>

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

      {/* Workload Bar */}
      {avgWorkload > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500 font-medium">Team Workload</span>
            <span className={`font-semibold ${avgWorkload > 80 ? "text-red-600" : avgWorkload > 60 ? "text-amber-600" : "text-emerald-600"
              }`}>
              {avgWorkload}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${avgWorkload > 80
                  ? "bg-gradient-to-r from-red-400 to-red-500"
                  : avgWorkload > 60
                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                    : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                }`}
              style={{ width: `${Math.min(avgWorkload, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function DetailItem({ icon, label, value, avatar }: {
  icon: string;
  label: string;
  value: string;
  avatar?: User;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
      <Icon name={icon} size={18} className="text-slate-400" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-medium text-slate-700 flex items-center gap-2 mt-0.5">
          {avatar && (
            <Avatar person={avatar} size="xs" />
          )}
          <span className="truncate">{value}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: {
  label: string;
  value: string | number;
  color: "indigo" | "slate" | "emerald" | "sky";
}) {
  const colorMap = {
    indigo: { text: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
    slate: { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" },
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    sky: { text: "text-sky-600", bg: "bg-sky-50", border: "border-sky-100" },
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color].border} ${colorMap[color].bg}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color].text}`}>{value}</p>
    </div>
  );
}
