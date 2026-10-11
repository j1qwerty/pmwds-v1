import { useState, useMemo, useEffect, useRef } from "react";
import type { Department, OrganizationRecord, User } from "../../../types";
import { usePermission, useToast, Avatar } from "../../shared";
import { OrgFormModal } from "../components/OrgFormModal";
import { DeptFormModal } from "../components/DeptFormModal";
import { useAuth } from "../../../auth";
import { api } from "../../../api";
import { useUserOrganization } from "../../shared/useUserOrganization";
import { Permission } from "../../../permissions";
import { Icon } from "../../../components/ui/Icon";

interface DepartmentsStepProps {
  selectedDepartmentIds: string[];
  onDepartmentsChange: (ids: string[]) => void;
  departments: Department[];
  organizations: OrganizationRecord[];
  users: User[];
  onRefresh: () => void;
}

export function DepartmentsStep({
  selectedDepartmentIds,
  onDepartmentsChange,
  departments,
  organizations,
  users,
  onRefresh,
}: DepartmentsStepProps) {
  const { auth } = useAuth();
  const { addToast } = useToast();
  const perm = usePermission();
  const isSuperAdmin = perm.isSuperAdmin;
  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);

  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);

  const scopedDepartments = useMemo(() => {
    if (isSuperAdmin && !selectedOrgId) return [];
    let filtered = departments;
    if (shouldFilterByOrg && userOrganizationId) {
      filtered = filtered.filter((d) => d.organizationId === userOrganizationId);
    }
    if (selectedOrgId) {
      filtered = filtered.filter((d) => d.organizationId === selectedOrgId);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
    }
    return filtered;
  }, [departments, isSuperAdmin, selectedOrgId, search, shouldFilterByOrg, userOrganizationId]);

  const prevOrgRef = useRef(selectedOrgId);
  useEffect(() => {
    if (prevOrgRef.current !== selectedOrgId) {
      onDepartmentsChange([]);
    }
    prevOrgRef.current = selectedOrgId;
  }, [selectedOrgId]);

  const selectedSet = new Set(selectedDepartmentIds);

  const toggleDepartment = (id: string) => {
    if (selectedSet.has(id)) {
      onDepartmentsChange(selectedDepartmentIds.filter((did) => did !== id));
    } else {
      onDepartmentsChange([...selectedDepartmentIds, id]);
    }
  };

  const getDeptUsers = (deptId: string) =>
    users.filter((u) => u.isActive !== false && (u.departmentId === deptId || u.departments?.some((d) => d.departmentId === deptId)));

  const handleCreateDept = async (form: Record<string, unknown>) => {
    if (!auth) return;
    try {
      await api.createDepartment(auth.token, form);
      setDeptModalOpen(false);
      addToast("Department created");
      onRefresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create department", "error");
    }
  };

  const handleCreateOrg = async (form: Record<string, unknown>) => {
    if (!auth) return;
    try {
      await api.createOrganization(auth.token, form);
      setOrgModalOpen(false);
      addToast("Organization created");
      onRefresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create organization", "error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Org filter - super admin only */}
      {isSuperAdmin && (
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Organization</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="">Select an organization...</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOrgModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
            >
              <Icon name="add" size={14} />
              New organization
            </button>
          </div>
        </div>
      )}

      {/* Search + Create */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments..."
            className="w-full h-10 pl-8 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
          />
        </div>
        {perm.has(Permission.DepartmentCreate) && (
          <button
            type="button"
            onClick={() => setDeptModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all shrink-0"
          >
            <Icon name="add" size={14} />
            New department
          </button>
        )}
      </div>

      {/* Departments table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={scopedDepartments.length > 0 && scopedDepartments.every((d) => selectedSet.has(d.id))}
                    onChange={() => {
                      if (scopedDepartments.every((d) => selectedSet.has(d.id))) {
                        onDepartmentsChange(selectedDepartmentIds.filter((id) => !scopedDepartments.some((d) => d.id === id)));
                      } else {
                        const allIds = new Set([...selectedDepartmentIds, ...scopedDepartments.map((d) => d.id)]);
                        onDepartmentsChange(Array.from(allIds));
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="Select all departments"
                  />
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Department</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Code</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopedDepartments.map((dept) => {
                const deptUsers = getDeptUsers(dept.id);
                const isSelected = selectedSet.has(dept.id);
                return (
                  <tr
                    key={dept.id}
                    onClick={() => toggleDepartment(dept.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDepartment(dept.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select ${dept.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-indigo-100" : "bg-slate-100"
                        }`}>
                          <Icon name="groups" size={15} className={isSelected ? "text-indigo-600" : "text-slate-400"} />
                        </div>
                        <span className={`font-medium text-sm ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                          {dept.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {deptUsers.length > 0 ? (
                          <div className="flex -space-x-1.5">
                            {deptUsers.slice(0, 4).map((u) => (
                              <Avatar key={u.id} person={u} size="xs" className="ring-2 ring-white" />
                            ))}
                            {deptUsers.length > 4 && (
                              <span className="w-6 h-6 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 flex items-center justify-center ring-2 ring-white">
                                +{deptUsers.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No members</span>
                        )}
                        <span className="text-xs text-slate-400 ml-1">({deptUsers.length})</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {scopedDepartments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    <Icon
                      name={isSuperAdmin && !selectedOrgId ? "account_balance" : "search_off"}
                      size={28}
                      className="mx-auto mb-2 block text-slate-300"
                    />
                    <p className="text-sm font-semibold">
                      {isSuperAdmin && !selectedOrgId ? "Select an organization first" : "No departments found"}
                    </p>
                    <p className="text-xs mt-1">
                      {isSuperAdmin && !selectedOrgId
                        ? "Choose an organization from the dropdown above to view its departments"
                        : "Try adjusting your search or organization filter"}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected count */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-slate-400">
          {selectedDepartmentIds.length} department{selectedDepartmentIds.length !== 1 ? "s" : ""} selected
        </span>
      </div>

      {/* Create department modal */}
      {deptModalOpen && (
        <DeptFormModal
          organizations={organizations}
          users={users}
          selectedOrgId={selectedOrgId}
          onSubmit={handleCreateDept}
          onCancel={() => setDeptModalOpen(false)}
        />
      )}

      {/* Create organization modal */}
      {orgModalOpen && (
        <OrgFormModal
          onSubmit={handleCreateOrg}
          onCancel={() => setOrgModalOpen(false)}
        />
      )}
    </div>
  );
}
