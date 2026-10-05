import { useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { formatPercent } from "../../ui";
import { roleDisplayNames } from "../../permissions";
import { api } from "../../api";
import { Avatar, GlassCard } from "../shared";
import { ProfilePictureUploader } from "../shared/ProfilePictureUploader";
import { Icon } from "../../components/ui/Icon";

interface UsersTableProps {
  users: User[];
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
   showOrganizationFilter?: boolean;
   showOrganizationName?: boolean;
  canManageUsers?: boolean;
  onPictureUploaded: (user: User) => void;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onUpdate?: () => void;
}

export function UsersTable({
  users,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationFilter = true,
  showOrganizationName = false,
  canManageUsers = false,
  onPictureUploaded,
  onEditUser,
  onToggleUserActive,
  onUpdate,
}: UsersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedDept, setSelectedDept] = useState("");

  const filteredDepartments = selectedOrg 
    ? departments.filter(d => d.organizationId === selectedOrg)
    : departments;

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDept = !selectedDept || user.departmentId === selectedDept || user.departments?.some(d => d.departmentId === selectedDept);
    const userDept = departments.find(d => d.id === user.departmentId);
    const userOrgId = user.organizationId ?? userDept?.organizationId ?? user.departments?.find(item => item.organizationId)?.organizationId;
    const matchesOrg = !selectedOrg || userOrgId === selectedOrg;
    return matchesSearch && matchesDept && matchesOrg;
  });

  const handleAvailabilityChange = async (userId: string, status: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    try {
      await api.updateAvailability(token, userId, status, user.availabilityPercentage || 100);
      onUpdate?.();
    } catch {
      // silently fail; parent can handle refresh
    }
  };

  return (
    <GlassCard className="overflow-hidden">
      {/* Filters */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[28rem]">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {showOrganizationFilter && (
          <select
            value={selectedOrg}
            onChange={(e) => { setSelectedOrg(e.target.value); setSelectedDept(""); }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        )}

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
        >
          <option value="">All Departments</option>
          {filteredDepartments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>

        <span className="text-xs text-slate-400 ml-auto">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Department</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Workload</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Burnout Risk</th>
              {canManageUsers && <th className="text-right px-6 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const workloadScore = user.aiWorkloadScore || 0;
              const workloadPercent = workloadScore <= 1 ? workloadScore * 100 : workloadScore;
              const burnoutScore = user.aiBurnoutRiskScore || 0;
              const burnoutPercent = burnoutScore <= 1 ? burnoutScore * 100 : burnoutScore;
              const dept = departments.find(d => d.id === user.departmentId);
              const org = organizations.find(item => item.id === (user.organizationId ?? dept?.organizationId));
              const departmentsLabel = user.departments?.length
                ? user.departments.map(item => `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`).join(", ")
                : dept?.name || user.department || "Unassigned";

              return (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <Avatar person={user} size="md" />
                        {canUploadPictures && (
                          <ProfilePictureUploader
                            userId={user.id}
                            token={token}
                            onUpload={async (file) => {
                              const result = await api.uploadUserProfilePicture(token, user.id, file);
                              onPictureUploaded(result.user);
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5" title={user.isActive !== false ? "Active" : "Inactive"}>
                          <span
                            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${user.isActive !== false ? "bg-emerald-500" : "bg-red-500"}`}
                            
                          />
                          <span className="font-semibold text-slate-800">{user.fullName}</span>
                        </div>
                        <div className="text-xs text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600">
                      {roleDisplayNames(user.roles).join(", ") || user.jobTitle || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-600">
                      {departmentsLabel}
                    </span>
                    {showOrganizationName && org && <div className="text-[10px] text-slate-400 mt-1">{org.name}</div>}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[100px]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            workloadPercent > 80 ? "bg-red-400" : workloadPercent > 60 ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(workloadPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {formatPercent(workloadPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${
                      burnoutPercent > 70 ? "text-red-500" : burnoutPercent > 40 ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {formatPercent(burnoutPercent)}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditUser?.(user)}
                          className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit user"
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleUserActive?.(user)}
                          className={`grid size-9 place-items-center rounded-lg transition-colors ${
                            user.isActive !== false
                              ? "text-slate-500 hover:bg-red-50 hover:text-red-600"
                              : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}
                          title={user.isActive !== false ? "Deactivate user" : "Reactivate user"}
                        >
                          <Icon name={user.isActive !== false ? "person_off" : "restart-alt"} size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="person_off" size={24} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">No users found</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

