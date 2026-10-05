import { useEffect, useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { GlassCard, GradientButton } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface UserDepartmentManagerProps {
  users: User[];
  departments: Department[];
  organizations: OrganizationRecord[];
  onAssign: (userId: string, departmentIds: string[], primaryDepartmentId: string | null) => Promise<void>;
}

export function UserDepartmentManager({
  users,
  departments,
  organizations,
  onAssign,
}: UserDepartmentManagerProps) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const selectedUser = users.find(user => user.id === userId);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedUser) return;
    const current = selectedUser.departments?.map(item => item.departmentId) ?? [];
    setSelectedDepartments(current);
    setPrimaryDepartmentId(selectedUser.departments?.find(item => item.isPrimary)?.departmentId ?? selectedUser.departmentId ?? "");
  }, [selectedUser?.id]);

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(current => {
      const next = current.includes(departmentId)
        ? current.filter(id => id !== departmentId)
        : [...current, departmentId];
      if (!next.includes(primaryDepartmentId)) {
        setPrimaryDepartmentId(next[0] ?? "");
      }
      return next;
    });
  };

  const grouped = organizations.map(org => ({
    org,
    departments: departments.filter(dept => dept.organizationId === org.id),
  }));

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon name="groups" size={18} className="text-indigo-500" />
        Department Assignments
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">User</label>
          <select
            value={userId}
            onChange={event => setUserId(event.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300"
          >
            {users.filter(u => u.isActive !== false).map(user => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
          </select>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {grouped.map(group => (
            <div key={group.org.id} className="mb-4 last:mb-0">
              <div className="text-xs font-bold text-slate-500 mb-2">{group.org.name}</div>
              <div className="space-y-2">
                {group.departments.map(dept => (
                  <label key={dept.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept.id)}
                        onChange={() => toggleDepartment(dept.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      {dept.name}
                    </span>
                    <input
                      type="radio"
                      name="primaryDepartment"
                      checked={primaryDepartmentId === dept.id}
                      disabled={!selectedDepartments.includes(dept.id)}
                      onChange={() => setPrimaryDepartmentId(dept.id)}
                      className="h-4 w-4 border-slate-300 text-indigo-600"
                      title="Primary department"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <GradientButton
            disabled={!userId || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onAssign(userId, selectedDepartments, primaryDepartmentId || null);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save Assignments"}
          </GradientButton>
        </div>
      </div>
    </GlassCard>
  );
}
