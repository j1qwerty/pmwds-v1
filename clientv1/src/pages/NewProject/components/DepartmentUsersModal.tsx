import { useState, useMemo } from "react";
import type { Department, User } from "../../../types";
import { Avatar, Modal, ModalPrimaryButton, Sheet } from "../../shared";
import { RoleKey, hasRoleKey } from "../../../permissions";
import { Icon } from "../../../components/ui/Icon";

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
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50/70"}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleToggle(u.id)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${u.fullName}`}
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
    <>
      <Sheet
        open={true}
        onClose={() => {
          if (!saving && !confirmTarget) onCancel();
        }}
        title="Manage users"
        description={department.name}
        icon="groups"
        accent="primary"
        size="lg"
        footer={
          <>
            <span className="mr-auto text-xs text-slate-400">
              {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <ModalPrimaryButton
              onClick={() => void handleSave()}
              loading={saving}
              label="Save changes"
              icon="check-circle"
            />
          </>
        }
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActiveTab("current")}
              aria-pressed={activeTab === "current"}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "current" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              This department
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("other")}
              aria-pressed={activeTab === "other"}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "other" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Other departments
            </button>
          </div>

          {/* User list */}
          <div className="rounded-xl border border-slate-200 overflow-hidden max-h-[360px] overflow-y-auto">
            {activeTab === "current" ? (
              filteredCurrent.current.length === 0 && filteredCurrent.none.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Icon name="search_off" size={26} className="mx-auto mb-2 block text-slate-300" />
                  <p className="text-sm font-medium">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredCurrent.current.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-slate-50/80 sticky top-0">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Team members ({filteredCurrent.current.length})
                        </span>
                      </div>
                      {filteredCurrent.current.map(renderUserRow)}
                      {filteredCurrent.none.length > 0 && <div className="border-t border-slate-100" />}
                    </>
                  )}
                  {filteredCurrent.none.length > 0 && (
                    <>
                      <div className="px-4 py-2 bg-slate-50/80 sticky top-0">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Unassigned ({filteredCurrent.none.length})
                        </span>
                      </div>
                      {filteredCurrent.none.map(renderUserRow)}
                    </>
                  )}
                </div>
              )
            ) : (
              filteredOther.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Icon name="search_off" size={26} className="mx-auto mb-2 block text-slate-300" />
                  <p className="text-sm font-medium">No users found</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredOther.map(([deptName, users]) => (
                    <div key={deptName}>
                      <div className="px-4 py-2 bg-slate-50/80 sticky top-0">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          {deptName} ({users.length})
                        </span>
                      </div>
                      {users.map(renderUserRow)}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </Sheet>

      {/* Cross-department confirmation */}
      {confirmTarget && (
        <Modal
          open={true}
          onClose={() => setConfirmTarget(null)}
          title="Cross-department assignment"
          icon="info"
          accent="warning"
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <ModalPrimaryButton
                onClick={() => { doToggle(confirmTarget.userId); setConfirmTarget(null); }}
                label="Continue"
                icon="check-circle"
              />
            </>
          }
        >
          <p className="text-sm text-slate-600">
            This user is already assigned to: <strong className="text-slate-800">{confirmTarget.deptNames.join(", ")}</strong>
          </p>
          <p className="text-sm text-slate-500 mt-1.5">Continue to assign to multiple departments?</p>
        </Modal>
      )}
    </>
  );
}
