import { useMemo, useState } from "react";
import type { User } from "../../types";
import { Avatar } from "./Avatar";
import { RoleKey, hasRoleKey } from "../../permissions";

type ScopedUserSelectProps = {
  users: User[];
  value?: string | null;
  values?: string[];
  onChange: (value: string) => void;
  onMultiChange?: (values: string[]) => void;
  organizationId?: string | null;
  departmentId?: string | null;
  label?: string;
  placeholder?: string;
  multiple?: boolean;
  disabled?: boolean;
  hideSuperAdmins?: boolean;
};

export function ScopedUserSelect({
  users,
  value,
  values = [],
  onChange,
  onMultiChange,
  organizationId,
  departmentId,
  label = "User",
  placeholder = "Search users...",
  multiple = false,
  disabled = false,
  hideSuperAdmins = true,
}: ScopedUserSelectProps) {
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (!user.isActive) return false;
      if (hideSuperAdmins && hasRoleKey(user.roleKeys ?? user.roles, RoleKey.SuperAdmin)) return false;
      const inOrganization = !organizationId || user.organizationId === organizationId || user.departments?.some((assignment) => assignment.organizationId === organizationId);
      const inDepartment = !departmentId || user.departments?.some((assignment) => assignment.departmentId === departmentId) || user.departmentId === departmentId;
      const matchesSearch = !term ||
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.jobTitle ?? "").toLowerCase().includes(term);
      return inOrganization && inDepartment && matchesSearch;
    });
  }, [departmentId, hideSuperAdmins, organizationId, search, users]);

  const selectedValues = multiple ? values : value ? [value] : [];

  function toggle(userId: string) {
    if (!multiple) {
      onChange(userId);
      return;
    }

    const next = selectedValues.includes(userId)
      ? selectedValues.filter((item) => item !== userId)
      : [...selectedValues, userId];
    onMultiChange?.(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
        <span className="text-xs text-slate-400">{filteredUsers.length} users</span>
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
        {filteredUsers.map((user) => {
          const selected = selectedValues.includes(user.id);
          return (
            <button
              type="button"
              key={user.id}
              disabled={disabled}
              onClick={() => toggle(user.id)}
              className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 disabled:opacity-60 ${
                selected ? "bg-indigo-50" : "bg-white hover:bg-slate-50"
              }`}
            >
              <Avatar person={user} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-700">{user.fullName}</span>
                <span className="block truncate text-xs text-slate-400">{user.jobTitle || user.email}</span>
              </span>
              {selected && <span className="material-symbols-outlined text-base text-indigo-600">check</span>}
            </button>
          );
        })}
        {filteredUsers.length === 0 && (
          <div className="px-3 py-5 text-center text-xs text-slate-400">No users found</div>
        )}
      </div>
    </div>
  );
}
