import type { Department, OrganizationRecord, User } from "../../types";
import { formatPercent } from "../../lib/formatters";
import { roleDisplayNames } from "../../permissions";
import { api } from "../../api";
import { Avatar, GlassCard, HoverActions } from "../shared";
import { ProfilePictureUploader } from "../shared/ProfilePictureUploader";
import { Icon } from "../../components/ui/Icon";

interface UsersTableProps {
  users: User[];
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
  showOrganizationName?: boolean;
  canManageUsers?: boolean;
  onPictureUploaded: (user: User) => void;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  /** Opens the right-slide view panel for the user */
  onOpenUser?: (user: User) => void;
}

/**
 * Table view of the users directory. Receives already-filtered/sorted users
 * from UsersPage and renders the clean "glass" table: uppercase micro-label
 * header (sticky), hover rows, inline workload bars, and row actions.
 */
export function UsersTable({
  users,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationName = false,
  canManageUsers = false,
  onPictureUploaded,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
  onOpenUser,
}: UsersTableProps) {
  const headers = ["User", "Role", "Department", "Workload", "Status"];

  return (
    <GlassCard className="overflow-hidden view-fade">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
              {canManageUsers && (
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const workloadScore = user.aiWorkloadScore || 0;
              const workloadPercent = workloadScore <= 1 ? workloadScore * 100 : workloadScore;
              const dept = departments.find((d) => d.id === user.departmentId);
              const org = organizations.find(
                (item) => item.id === (user.organizationId ?? dept?.organizationId),
              );
              const departmentsLabel = user.departments?.length
                ? user.departments
                    .map((item) =>
                      `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`,
                    )
                    .join(", ")
                : dept?.name || user.department || "Unassigned";
              const isActive = user.isActive !== false;

              return (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50/70 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:bg-indigo-50/40"
                  onClick={onOpenUser ? () => onOpenUser(user) : undefined}
                  tabIndex={onOpenUser ? 0 : undefined}
                  aria-label={onOpenUser ? `View details for ${user.fullName}` : undefined}
                  onKeyDown={
                    onOpenUser
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenUser(user);
                          }
                        }
                      : undefined
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar person={user} size="md" className="shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate max-w-[220px]">
                          {user.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full">
                      <Icon name="badge" size={11} className="shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {roleDisplayNames(user.roles).join(", ") || user.jobTitle || "—"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 block truncate max-w-[180px]">{departmentsLabel}</span>
                    {showOrganizationName && org && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{org.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            workloadPercent > 80
                              ? "bg-gradient-to-r from-red-400 to-red-500"
                              : workloadPercent > 60
                                ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                          }`}
                          style={{ width: `${Math.min(workloadPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 shrink-0">
                        {formatPercent(workloadPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-red-50 text-red-700 border-red-100"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
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
                        {/* Actions — delete always visible (permission-gated), view/edit/activation on hover */}
                        <HoverActions
                          entity="users"
                          always={
                            isActive && onDeleteUser
                              ? [{ icon: "delete", label: "Delete user", tone: "danger", onClick: () => onDeleteUser(user) }]
                              : []
                          }
                          onHover={[
                            ...(onOpenUser ? [{ icon: "view", label: "View user", onClick: () => onOpenUser(user) }] : []),
                            ...(onEditUser ? [{ icon: "edit", label: "Edit user", onClick: () => onEditUser(user) }] : []),
                            ...(onToggleUserActive
                              ? [
                                  {
                                    icon: isActive ? "person_off" : "restart_alt",
                                    label: isActive ? "Deactivate user" : "Reactivate user",
                                    onClick: () => onToggleUserActive(user),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
