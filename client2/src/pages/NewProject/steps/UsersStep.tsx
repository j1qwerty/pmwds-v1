import { useState, useMemo } from "react";
import type { Department, OrganizationRecord, User } from "../../../types";
import { Avatar, useToast, usePermission } from "../../shared";
import { useAuth } from "../../../auth";
import { api } from "../../../api";
import { DepartmentUsersModal } from "../components/DepartmentUsersModal";
import { UserFormModal } from "../components/UserFormModal";
import { GlassCard } from "../../shared";
import { Icon } from "../../../components/ui/Icon";

interface UsersStepProps {
  selectedDepartmentIds: string[];
  departments: Department[];
  users: User[];
  organizations: OrganizationRecord[];
  onRefresh: () => void;
}

export function UsersStep({ selectedDepartmentIds, departments, users, organizations, onRefresh }: UsersStepProps) {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const perm = usePermission();
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const selectedDepts = departments.filter((d) => selectedDepartmentIds.includes(d.id));

  const selectedOrgId = useMemo(
    () => selectedDepts[0]?.organizationId ?? "",
    [selectedDepts]
  );

  const getDeptUsers = (deptId: string) =>
    users.filter((u) => u.isActive !== false && (u.departmentId === deptId || u.departments?.some((d) => d.departmentId === deptId)));

  const handleAssignUserDepartments = async (userId: string, departmentIds: string[]) => {
    if (!auth) return;
    await api.assignUserDepartments(auth.token, userId, departmentIds);
    onRefresh();
  };

  const handleCreateUser = async (data: Record<string, unknown>) => {
    if (!auth) return;
    await api.registerUser(auth.token, data);
    setShowCreateUser(false);
    addToast("User created");
    onRefresh();
  };

  if (selectedDepartmentIds.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Icon name="group" size={24} className="text-indigo-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">Select departments first</p>
        <p className="text-xs text-slate-400 mt-1">Go back to the Departments step to select departments.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* New User button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreateUser(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Icon name="person_add" size={16} />
          New User
        </button>
      </div>

      {/* Department user cards */}
      {selectedDepts.map((dept) => {
        const deptUsers = getDeptUsers(dept.id);
        return (
          <div key={dept.id} className="rounded-xl border border-slate-200 bg-white/80 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Icon name="groups" size={16} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800">{dept.name}</span>
                <span className="text-[10px] text-slate-400 ml-2">{dept.code}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{deptUsers.length} users</span>
              <button
                type="button"
                onClick={() => setEditDeptId(dept.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Icon name="edit" size={15} />
                Users
              </button>
            </div>

            {deptUsers.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {deptUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <Avatar person={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700 block">{u.fullName}</span>
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </div>
                    {u.jobTitle && <span className="text-[10px] text-slate-400 shrink-0">{u.jobTitle}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-slate-400">
                <p className="text-xs">No users assigned. Click "Users" to manage.</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Edit department users modal */}
      {editDeptId && (
        <DepartmentUsersModal
          department={departments.find((d) => d.id === editDeptId)!}
          allDepartments={departments}
          allUsers={users}
          onSave={handleAssignUserDepartments}
          onCancel={() => setEditDeptId(null)}
        />
      )}

      {/* Create user modal */}
      {showCreateUser && (
        <UserFormModal
          organizations={organizations}
          defaultOrganizationId={selectedOrgId}
          hideOrganization={!perm.isSuperAdmin}
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateUser(false)}
        />
      )}
    </div>
  );
}
