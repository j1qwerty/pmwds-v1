import { useMemo, useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { formatPercent } from "../../lib/formatters";
import { roleDisplayNames } from "../../permissions";
import { api } from "../../api";
import {
  Avatar,
  EmptyState,
  FilterBar,
  FilterDropdown,
  SortDropdown,
  ViewToggle,
  type ViewMode,
} from "../shared";
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

type SortKey = "nameAsc" | "nameDesc" | "workloadDesc" | "workloadAsc" | "status";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "workloadDesc", label: "Workload (high → low)" },
  { value: "workloadAsc", label: "Workload (low → high)" },
  { value: "status", label: "Active first" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active", dot: "bg-emerald-500" },
  { value: "inactive", label: "Inactive", dot: "bg-red-500" },
];

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
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nameAsc");
  const [view, setView] = useState<ViewMode>("card");

  const filteredDepartments = selectedOrg
    ? departments.filter((d) => d.organizationId === selectedOrg)
    : departments;

  const orgOptions = useMemo(
    () => organizations.map((org) => ({ value: org.id, label: org.name })),
    [organizations],
  );

  const deptOptions = useMemo(
    () => filteredDepartments.map((dept) => ({ value: dept.id, label: dept.name })),
    [filteredDepartments],
  );

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = users.filter((user) => {
      const matchesSearch =
        !term ||
        user.fullName.toLowerCase().includes(term) ||
        (user.email && user.email.toLowerCase().includes(term));
      const matchesDept =
        !selectedDept ||
        user.departmentId === selectedDept ||
        user.departments?.some((d) => d.departmentId === selectedDept);
      const userDept = departments.find((d) => d.id === user.departmentId);
      const userOrgId =
        user.organizationId ??
        userDept?.organizationId ??
        user.departments?.find((item) => item.organizationId)?.organizationId;
      const matchesOrg = !selectedOrg || userOrgId === selectedOrg;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" ? user.isActive !== false : user.isActive === false);
      return matchesSearch && matchesDept && matchesOrg && matchesStatus;
    });

    const byName = (a: User, b: User) => a.fullName.localeCompare(b.fullName);
    const byWorkload = (a: User, b: User) =>
      (a.aiWorkloadScore || 0) - (b.aiWorkloadScore || 0);

    const sorted = [...list];
    switch (sortKey) {
      case "nameAsc":
        sorted.sort(byName);
        break;
      case "nameDesc":
        sorted.sort((a, b) => -byName(a, b));
        break;
      case "workloadDesc":
        sorted.sort((a, b) => -byWorkload(a, b));
        break;
      case "workloadAsc":
        sorted.sort(byWorkload);
        break;
      case "status":
        sorted.sort((a, b) => {
          const aActive = a.isActive !== false ? 0 : 1;
          const bActive = b.isActive !== false ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          return byName(a, b);
        });
        break;
    }
    return sorted;
  }, [users, departments, searchTerm, selectedOrg, selectedDept, statusFilter, sortKey]);

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

  const activeFilterCount =
    (searchTerm ? 1 : 0) +
    (selectedOrg ? 1 : 0) +
    (selectedDept ? 1 : 0) +
    (statusFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedOrg("");
    setSelectedDept("");
    setStatusFilter("");
  };

  return (
    <div className="relative">
      {/* Filter Bar */}
      <div className="mb-4">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search users by name or email..."
          actions={
            <>
              {showOrganizationFilter && (
                <FilterDropdown
                  value={selectedOrg}
                  onChange={(val) => {
                    setSelectedOrg(val);
                    setSelectedDept("");
                  }}
                  label="Org"
                  icon="corporate_fare"
                  options={orgOptions}
                  width="min-w-[160px]"
                />
              )}
              <FilterDropdown
                value={selectedDept}
                onChange={setSelectedDept}
                label="Dept"
                icon="business"
                options={deptOptions}
                width="min-w-[160px]"
              />
              <FilterDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                label="Status"
                icon="flag"
                options={STATUS_OPTIONS}
                width="min-w-[140px]"
              />
              <SortDropdown value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} />
              <ViewToggle value={view} onChange={setView} available={["card", "list"]} />
            </>
          }
        />
      </div>

      {/* Results meta */}
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filteredUsers.length}</strong> of {users.length} users
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            <Icon name="filter_alt_off" size={12} />
            Clear filters
          </button>
        )}
      </div>

      {/* Empty / Card / List */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon="person_off"
          title="No users found"
          description={
            activeFilterCount > 0
              ? "Try adjusting your filters to see more users."
              : "Register your first user to get started."
          }
          accent="primary"
          action={
            activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
              >
                <Icon name="filter_alt_off" size={14} />
                Clear all filters
              </button>
            ) : undefined
          }
        />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pb-10">
          {filteredUsers.map((user, idx) => (
            <div key={user.id} className="card-stagger" style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
              <UserCard
                user={user}
                departments={departments}
                organizations={organizations}
                token={token}
                canUploadPictures={canUploadPictures}
                showOrganizationName={showOrganizationName}
                canManageUsers={canManageUsers}
                onEditUser={onEditUser}
                onToggleUserActive={onToggleUserActive}
                onPictureUploaded={onPictureUploaded}
                onAvailabilityChange={handleAvailabilityChange}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="pb-10 view-fade">
          <UserListView
            users={filteredUsers}
            departments={departments}
            organizations={organizations}
            token={token}
            canUploadPictures={canUploadPictures}
            showOrganizationName={showOrganizationName}
            canManageUsers={canManageUsers}
            onEditUser={onEditUser}
            onToggleUserActive={onToggleUserActive}
            onPictureUploaded={onPictureUploaded}
          />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function UserCard({
  user,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationName,
  canManageUsers,
  onEditUser,
  onToggleUserActive,
  onPictureUploaded,
}: {
  user: User;
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
  showOrganizationName: boolean;
  canManageUsers: boolean;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onPictureUploaded: (user: User) => void;
  onAvailabilityChange?: (userId: string, status: string) => void;
}) {
  const workloadScore = user.aiWorkloadScore || 0;
  const workloadPercent = workloadScore <= 1 ? workloadScore * 100 : workloadScore;
  const burnoutScore = user.aiBurnoutRiskScore || 0;
  const burnoutPercent = burnoutScore <= 1 ? burnoutScore * 100 : burnoutScore;
  const dept = departments.find((d) => d.id === user.departmentId);
  const org = organizations.find((item) => item.id === (user.organizationId ?? dept?.organizationId));
  const departmentsLabel = user.departments?.length
    ? user.departments
        .map((item) =>
          `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`,
        )
        .join(", ")
    : dept?.name || user.department || "Unassigned";
  const isActive = user.isActive !== false;
  const roleLabel = roleDisplayNames(user.roles).join(", ") || user.jobTitle || "—";

  return (
    <div className="group h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3">
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-red-500"}`}
              title={isActive ? "Active" : "Inactive"}
            />
            <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
              {user.fullName}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
          {user.jobTitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.jobTitle}</p>}
        </div>
        {canManageUsers && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditUser?.(user)}
              className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              title="Edit user"
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              type="button"
              onClick={() => onToggleUserActive?.(user)}
              className={`grid size-8 place-items-center rounded-lg transition-colors ${
                isActive
                  ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                  : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
              }`}
              title={isActive ? "Deactivate user" : "Reactivate user"}
            >
              <Icon name={isActive ? "person_off" : "restart_alt"} size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
          <Icon name="workspace_premium" size={10} />
          {roleLabel}
        </span>
        <span
          className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${
            burnoutPercent > 70
              ? "bg-red-50 text-red-600"
              : burnoutPercent > 40
                ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600"
          }`}
          title="Burnout risk"
        >
          <Icon name="local_fire_department" size={10} />
          {formatPercent(burnoutPercent)} risk
        </span>
      </div>

      {/* Department */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px]">
        <Icon name="business" size={11} className="text-slate-400 shrink-0" />
        <span className="text-slate-600 truncate">{departmentsLabel}</span>
        {showOrganizationName && org && (
          <span className="text-slate-300">·</span>
        )}
        {showOrganizationName && org && (
          <span className="text-slate-400 truncate">{org.name}</span>
        )}
      </div>

      {/* Workload bar */}
      <div className="mt-auto pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
          <span className="flex items-center gap-1">
            <Icon name="monitoring" size={11} className="text-slate-400" />
            Workload
          </span>
          <span
            className={
              workloadPercent > 80
                ? "text-red-600"
                : workloadPercent > 60
                  ? "text-amber-600"
                  : "text-emerald-600"
            }
          >
            {formatPercent(workloadPercent)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              workloadPercent > 80
                ? "bg-gradient-to-r from-red-400 to-red-500"
                : workloadPercent > 60
                  ? "bg-gradient-to-r from-amber-400 to-amber-500"
                  : "bg-gradient-to-r from-emerald-400 to-emerald-500"
            }`}
            style={{ width: `${Math.min(workloadPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function UserListView({
  users,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationName,
  canManageUsers,
  onEditUser,
  onToggleUserActive,
  onPictureUploaded,
}: {
  users: User[];
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
  showOrganizationName: boolean;
  canManageUsers: boolean;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onPictureUploaded: (user: User) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Name</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Role</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Department</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Workload</th>
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Burnout Risk</th>
              {canManageUsers && (
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const workloadScore = user.aiWorkloadScore || 0;
              const workloadPercent = workloadScore <= 1 ? workloadScore * 100 : workloadScore;
              const burnoutScore = user.aiBurnoutRiskScore || 0;
              const burnoutPercent = burnoutScore <= 1 ? burnoutScore * 100 : burnoutScore;
              const dept = departments.find((d) => d.id === user.departmentId);
              const org = organizations.find((item) => item.id === (user.organizationId ?? dept?.organizationId));
              const departmentsLabel = user.departments?.length
                ? user.departments
                    .map((item) =>
                      `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`,
                    )
                    .join(", ")
                : dept?.name || user.department || "Unassigned";
              const isActive = user.isActive !== false;

              return (
                <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-4 py-3">
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5" title={isActive ? "Active" : "Inactive"}>
                          <span
                            className={`inline-block w-2 h-2 rounded-full shrink-0 ${isActive ? "bg-emerald-500" : "bg-red-500"}`}
                          />
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 line-clamp-1">
                            {user.fullName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-600">
                      {roleDisplayNames(user.roles).join(", ") || user.jobTitle || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600">{departmentsLabel}</span>
                    {showOrganizationName && org && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{org.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            workloadPercent > 80
                              ? "bg-red-400"
                              : workloadPercent > 60
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(workloadPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">
                        {formatPercent(workloadPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        burnoutPercent > 70
                          ? "text-red-500"
                          : burnoutPercent > 40
                            ? "text-amber-500"
                            : "text-emerald-500"
                      }`}
                    >
                      {formatPercent(burnoutPercent)}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => onEditUser?.(user)}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          title="Edit user"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleUserActive?.(user)}
                          className={`grid size-8 place-items-center rounded-lg transition-colors ${
                            isActive
                              ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                              : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                          }`}
                          title={isActive ? "Deactivate user" : "Reactivate user"}
                        >
                          <Icon name={isActive ? "person_off" : "restart_alt"} size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
