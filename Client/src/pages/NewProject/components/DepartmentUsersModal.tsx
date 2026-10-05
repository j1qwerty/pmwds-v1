import { useState, useMemo } from "react";
import type { Department, User } from "../../../types";
import { Avatar } from "../../shared";
import { RoleKey, hasRoleKey } from "../../../permissions";

interface DepartmentUsersModalProps {
  department: Department;
  allDepartments: Department[];
  allUsers: User[];
  onSave: (userId: string, departmentIds: string[]) => Promise<void>;
  onCancel: () => void;
}

type Tab = "current" | "other";

export function DepartmentUsersModal({ department, allDepartments, allUsers, onSave, onCancel }: DepartmentUsersModalProps) {
  const orgUsers = useMemo(
    () => allUsers.filter((u) => {
      if (u.isActive === false) return false;
      if (hasRoleKey(u.roleKeys ?? u.roles, RoleKey.SuperAdmin)) return false;
      const userDept = allDepartments.find((d) => d.id === u.departmentId);
      const userOrgId = u.organizationId ??
        userDept?.organizationId ??
        u.departments?.find((item) => item.organizationId)?.organizationId;
      return userOrgId === department.organizationId;
    }),
    [allUsers, allDepartments, department.organizationId]
  );

  const currentDeptUsers = useMemo(
    () => orgUsers.filter((u) =>
      u.departmentId === department.id || u.departments?.some((d) => d.departmentId === department.id)
    ),
    [orgUsers, department.id]
  );

  const noDeptUsers = useMemo(
    () => orgUsers.filter((u) =>
      !u.departmentId && (!u.departments || u.departments.length === 0)
    ),
    [orgUsers]
  );

  const otherDeptUsers = useMemo(
    () => orgUsers.filter((u) =>
      u.departmentId || (u.departments && u.departments.length > 0)
    ).filter((u) => !currentDeptUsers.some((d) => d.id === u.id)),
    [orgUsers, currentDeptUsers]
  );

  const otherDeptGroups = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const u of otherDeptUsers) {
      let groupDeptId = "";
      if (u.departmentId && u.departmentId !== department.id) {
        groupDeptId = u.departmentId;
      } else {
        const other = u.departments?.find((d) => d.departmentId !== department.id);
        groupDeptId = other?.departmentId ?? "";
      }
      const dept = allDepartments.find((d) => d.id === groupDeptId);
      const name = dept?.name ?? "Unknown";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(u);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [otherDeptUsers, allDepartments, department.id]);

  const currentUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of allUsers) {
      const belongs = u.departmentId === department.id || u.departments?.some((d) => d.departmentId === department.id);
      if (belongs) ids.add(u.id);
    }
    return ids;
  }, [allUsers, department.id]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(currentUserIds);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("current");
  const [confirmTarget, setConfirmTarget] = useState<{ userId: string; deptNames: string[] } | null>(null);

  const filteredCurrent = useMemo(() => {
    if (!search) return { current: currentDeptUsers, none: noDeptUsers };
    const q = search.toLowerCase();
    return {
      current: currentDeptUsers.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
      none: noDeptUsers.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    };
  }, [currentDeptUsers, noDeptUsers, search]);

  const filteredOther = useMemo(() => {
    if (!search) return otherDeptGroups;
    const q = search.toLowerCase();
    return otherDeptGroups
      .map(([name, users]) => [name, users.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))] as [string, User[]])
      .filter(([, users]) => users.length > 0);
  }, [otherDeptGroups, search]);

  const getOtherDeptNames = (user: User): string[] => {
    const ids = new Set<string>();
    if (user.departmentId) ids.add(user.departmentId);
    user.departments?.forEach((d) => ids.add(d.departmentId));
    ids.delete(department.id);
    return Array.from(ids)
      .map((id) => allDepartments.find((d) => d.id === id)?.name)
      .filter((n): n is string => !!n);
  };

  const doToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggle = (id: string) => {
    if (!selectedIds.has(id)) {
      const user = orgUsers.find((u) => u.id === id);
      if (user) {
        const other = getOtherDeptNames(user);
        if (other.length > 0) {
          setConfirmTarget({ userId: id, deptNames: other });
          return;
        }
      }
    }
    doToggle(id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const user of orgUsers) {
        const isCurrentlyAssigned = currentUserIds.has(user.id);
        const shouldBeAssigned = selectedIds.has(user.id);
        if (isCurrentlyAssigned !== shouldBeAssigned) {
          const currentDepts = user.departments?.map((d) => d.departmentId) ?? (user.departmentId ? [user.departmentId] : []);
          let newDepts: string[];
          if (shouldBeAssigned) {
            newDepts = currentDepts.includes(department.id) ? currentDepts : [...currentDepts, department.id];
          } else {
            newDepts = currentDepts.filter((did) => did !== department.id);
          }
          await onSave(user.id, newDepts);
        }
      }
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  const renderUserRow = (u: User) => {
    const isSelected = selectedIds.has(u.id);
    return (
      <div
        key={u.id}
        onClick={() => handleToggle(u.id)}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleToggle(u.id)}
          className="rounded border-slate-300 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <Avatar person={u} size="sm" />
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium block ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>{u.fullName}</span>
          {(() => {
            const names = getOtherDeptNames(u);
            return names.length > 0 ? (
              <span className="text-xs text-slate-400">{names.join(", ")}</span>
            ) : (
              <span className="text-xs text-slate-300 italic"></span>
            );
          })()}
        </div>
        {u.jobTitle && <span className="text-[10px] text-slate-400 shrink-0">{u.jobTitle}</span>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/20" onClick={onCancel}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-[560px] max-w-[95vw] shadow-xl border border-slate-200 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600 text-2xl">group</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manage Users</h2>
              <p className="text-sm text-slate-400">{department.name}</p>
            </div>
          </div>

          <div className="relative mb-4">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm outline-none bg-white/80 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100">
            <button
              onClick={() => setActiveTab("current")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "current" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              This Department
            </button>
            <button
              onClick={() => setActiveTab("other")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "other" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Other Departments
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[360px] overflow-y-auto">
            {activeTab === "current" ? (
              filteredCurrent.current.length === 0 && filteredCurrent.none.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                  <p className="text-sm font-medium">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredCurrent.current.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-slate-50/80">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Members ({filteredCurrent.current.length})</span>
                      </div>
                      {filteredCurrent.current.map(renderUserRow)}
                      {filteredCurrent.none.length > 0 && <div className="border-t border-slate-100" />}
                    </>
                  )}
                  {filteredCurrent.none.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-slate-50/80">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unassigned ({filteredCurrent.none.length})</span>
                      </div>
                      {filteredCurrent.none.map(renderUserRow)}
                    </>
                  )}
                </div>
              )
            ) : (
              filteredOther.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                  <p className="text-sm font-medium">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredOther.map(([deptName, users]) => (
                    <div key={deptName}>
                      <div className="px-4 py-2 bg-slate-50/80">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{deptName} ({users.length})</span>
                      </div>
                      {users.map(renderUserRow)}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {confirmTarget && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setConfirmTarget(null)}>
              <div className="bg-white rounded-2xl p-6 w-[400px] max-w-[90vw] shadow-xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-2xl text-amber-600">info</span>
                  <h3 className="text-sm font-bold text-slate-900">Cross-Department Assignment</h3>
                </div>
                <p className="text-sm text-slate-600 mb-1">
                  This user is already assigned to: <strong>{confirmTarget.deptNames.join(", ")}</strong>
                </p>
                <p className="text-sm text-slate-500 mb-5">Continue to assign to multiple departments?</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { doToggle(confirmTarget.userId); setConfirmTarget(null); }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs text-slate-400">{selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""}</span>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
