import { useState, useMemo } from "react";
import type { Department, OrganizationRecord, User } from "../../../types";
import { Avatar, useToast, usePermission, EmptyState } from "../../shared";
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
      <GlassCard>
        <EmptyState
          icon="group"
          title="Select departments first"
          description="Go back to the Departments step to select departments."
        />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* New User button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreateUser(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
        >
          <Icon name="person_add" size={14} />
          New user
        </button>
      </div>

      {/* Department user cards */}
      {selectedDepts.map((dept) => {
        const deptUsers = getDeptUsers(dept.id);
        return (
          <div key={dept.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon name="groups" size={15} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800">{dept.name}</span>
                <span className="text-[10px] text-slate-400 ml-2">{dept.code}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">{deptUsers.length} user{deptUsers.length !== 1 ? "s" : ""}</span>
              <button
                type="button"
                onClick={() => setEditDeptId(dept.id)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                aria-label={`Manage users for ${dept.name}`}
              >
                <Icon name="edit" size={14} />
                Users
              </button>
            </div>

            {deptUsers.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {deptUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50/70 transition-colors">
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
              <div className="px-4 py-5 text-center text-slate-400">
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
