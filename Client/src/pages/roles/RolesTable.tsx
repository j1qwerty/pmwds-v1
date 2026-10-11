import type { RoleRecord } from "../../types";
import { roleDisplayName } from "../../permissions";
import { Icon } from "../../components/ui/Icon";

interface RolesTableProps {
  roles: RoleRecord[];
  onEdit: (role: RoleRecord) => void;
  onDelete: (role: RoleRecord) => void;
  isAdmin: boolean;
  /** Optional users-per-role counts (role id → user count); adds a Users column when provided. */
  userCounts?: Record<string, number>;
}

/**
 * List view for the Roles tab — a single clean GlassCard table.
 * Search / sort / view toggling live on RolesPage; this component only
 * renders the provided (already filtered + sorted) roles as divided rows.
 */
export function RolesTable({ roles, onEdit, onDelete, isAdmin, userCounts }: RolesTableProps) {
  const showUsers = userCounts !== undefined;
  return (
    <div className="bg-white/97  border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden view-fade min-w-0">
      {/* min-w-0 + overflow-x-auto: on narrow screens the table scrolls inside
          the card — the page itself never clips a column off-screen. */}
      <div className="overflow-x-auto min-w-0">
        {/* table-fixed + colgroup: deterministic columns (Role takes the rest,
            chips/actions get fixed room) so no column can push the table wide. */}
        <table className="w-full min-w-[760px] table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[110px]" />
            {showUsers && <col className="w-[90px]" />}
            <col className="w-[240px]" />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                Role
              </th>
              <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                Level
              </th>
              {showUsers && (
                <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                  Users
                </th>
              )}
              <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                Permissions
              </th>
              <th className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Icon name="shield_person" size={16} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 line-clamp-1">
                        {roleDisplayName(role.name)}
                      </div>
                      {role.description && (
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {role.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <Icon name="trending_up" size={11} className="text-slate-400" />
                    Level {role.permissionLevel}
                  </span>
                </td>
                {showUsers && (
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                      title={`${userCounts?.[role.id] ?? 0} user${(userCounts?.[role.id] ?? 0) === 1 ? "" : "s"} assigned this role`}
                    >
                      <Icon name="group" size={11} className="text-slate-400" />
                      {userCounts?.[role.id] ?? 0}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  {role.permissions.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {role.permissions.length}
                      </span>
                      {role.permissions.slice(0, 3).map((perm) => (
                        <span
                          key={perm.id}
                          className="max-w-full truncate px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono"
                          title={perm.code}
                        >
                          {perm.code}
                        </span>
                      ))}
                      {role.permissions.length > 3 && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200">
                          +{role.permissions.length - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No permissions</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(role)}
                        aria-label={`Edit role: ${roleDisplayName(role.name)}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <Icon name="edit" size={11} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(role)}
                        aria-label={`Delete role: ${roleDisplayName(role.name)}`}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <Icon name="delete" size={11} />
                        Delete
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
