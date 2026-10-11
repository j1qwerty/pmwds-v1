import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, SkillRecord, User } from "../../types";
import {
  ROLE_DISPLAY_NAMES,
  normalizeRoleKey,
  roleDisplayName,
  roleDisplayNames,
  type RoleKeyCode,
} from "../../permissions";
import { formatPercent } from "../../lib/formatters";
import { Icon } from "../../components/ui/Icon";
import { ProfilePictureUploader } from "../shared/ProfilePictureUploader";
import {
  AnimatedBackground,
  Avatar,
  EmptyState,
  FilterBar,
  FilterDropdown,
  GlassCard,
  HoverActions,
  Modal,
  ModalCancelButton,
  ModalDangerButton,
  PageAction,
  PageContainer,
  PageSkeleton,
  PERMISSION_GROUPS,
  ROLE_LEVELS,
  SortDropdown,
  StatCard,
  ViewToggle,
  useNavHeader,
  usePermission,
  useToast,
  type ViewMode,
} from "../shared";
import { UsersTable } from "./UsersTable";
import { UserEditModal } from "./UserEditModal";
import { UserViewPanel } from "./UserViewPanel";
import { UserFormModal } from "../NewProject/components/UserFormModal";

type SortKey =
  | "nameAsc"
  | "nameDesc"
  | "roleAsc"
  | "deptAsc"
  | "workloadDesc"
  | "workloadAsc"
  | "status";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "roleAsc", label: "Role (A–Z)" },
  { value: "deptAsc", label: "Department (A–Z)" },
  { value: "workloadDesc", label: "Workload (high → low)" },
  { value: "workloadAsc", label: "Workload (low → high)" },
  { value: "status", label: "Active first" },
];

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = (
  Object.keys(ROLE_DISPLAY_NAMES) as RoleKeyCode[]
).map((key) => ({ value: key, label: ROLE_DISPLAY_NAMES[key] }));

export function UsersPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const { data: appData } = useAppData();
  const isAdmin = perm.isAdmin;
  const canManageUsers = perm.has(PERMISSION_GROUPS.user.manage);

  const userMaxLevel = useMemo(() => {
    if (!auth?.roleKeys?.length) return 0;
    return Math.max(...auth.roleKeys.map((r) => ROLE_LEVELS[r] ?? 0));
  }, [auth]);

  const [users, setUsers] = useState<User[]>([]);
  const { departments, organizations } = appData;
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  // Right-slide view panel — only the id is stored so the panel always renders the
  // live record (edits/reactivation reflect immediately while the panel stays open).
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // Directory controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nameAsc");
  const [view, setView] = useState<ViewMode>("card");

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Users",
      description: "People operations, capacity, activation state, and workload shape",
      action: canManageUsers ? {
        label: "New user",
        onClick: () => setShowCreateUser(true),
        icon: "add",
      } : undefined,
    });
  }, [setNavHeader, canManageUsers]);

  const handleToggleUserActive = async (user: User) => {
    if (!auth) return;
    if (user.isActive === false) {
      const updated = await api.reactivateUser(auth.token, user.id);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      addToast("User reactivated.");
      void loadData();
      return;
    }

    setDeletingUser(user);
  };

  const loadData = () => {
    if (!auth) return;
    setLoading(true);
    Promise.all([
      api.getUsers(auth.token),
      api.getSkills(auth.token),
    ])
      .then(([userData, skillData]) => {
        setUsers(userData);
        setSkills(skillData);
      })
      .catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to load users.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  // KPI row — derived from the already-loaded directory
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive !== false).length;
    const avgWorkload = users.length
      ? Math.round(
          users.reduce((sum, u) => {
            const score = u.aiWorkloadScore || 0;
            const pct = score <= 1 ? score * 100 : score;
            return sum + pct;
          }, 0) / users.length,
        )
      : 0;
    return { total: users.length, active, inactive: users.length - active, avgWorkload };
  }, [users]);

  const viewingUser = useMemo(
    () => users.find((user) => user.id === viewingUserId) ?? null,
    [users, viewingUserId],
  );

  const openUserView = (user: User) => setViewingUserId(user.id);

  const filteredDepartments = useMemo(
    () => (selectedOrg ? departments.filter((d) => d.organizationId === selectedOrg) : departments),
    [departments, selectedOrg],
  );

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
        (user.email ? user.email.toLowerCase().includes(term) : false);
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
      const matchesRole =
        !roleFilter ||
        (user.roleKeys ?? []).some((key) => normalizeRoleKey(key) === roleFilter) ||
        (user.roles ?? []).some((role) => normalizeRoleKey(role) === roleFilter) ||
        (user.roles ?? []).some((role) => roleDisplayName(role) === ROLE_DISPLAY_NAMES[roleFilter as RoleKeyCode]);
      return matchesSearch && matchesDept && matchesOrg && matchesStatus && matchesRole;
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
      case "roleAsc":
        sorted.sort((a, b) => {
          const aRole = roleDisplayNames(a.roles).slice().sort()[0] ?? a.jobTitle ?? "";
          const bRole = roleDisplayNames(b.roles).slice().sort()[0] ?? b.jobTitle ?? "";
          return aRole.localeCompare(bRole) || byName(a, b);
        });
        break;
      case "deptAsc":
        sorted.sort((a, b) => {
          const aDept = departmentLabel(a, departments, organizations, false).label;
          const bDept = departmentLabel(b, departments, organizations, false).label;
          return aDept.localeCompare(bDept) || byName(a, b);
        });
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
  }, [users, departments, searchTerm, selectedOrg, selectedDept, statusFilter, roleFilter, sortKey]);

  const activeFilterCount =
    (searchTerm ? 1 : 0) +
    (selectedOrg ? 1 : 0) +
    (selectedDept ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (roleFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedOrg("");
    setSelectedDept("");
    setStatusFilter("");
    setRoleFilter("");
  };

  const statusChips = [
    { value: "", label: "All", count: stats.total },
    { value: "active", label: "Active", count: stats.active, color: { dot: "bg-emerald-500" } },
    { value: "inactive", label: "Inactive", count: stats.inactive, color: { dot: "bg-red-500" } },
  ];

  // skills is referenced indirectly via load flow; keep variable to preserve prior behaviour
  void skills;

  if (loading) {
    return (
      <div>
        <AnimatedBackground />
        <div className="relative z-10">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  const sharedViewProps = {
    departments,
    organizations,
    token: auth?.token ?? "",
    canUploadPictures: isAdmin,
    showOrganizationName: perm.isSuperAdmin,
    canManageUsers,
    onPictureUploaded: (updated: User) => {
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
      addToast("Profile picture updated.");
    },
    onEditUser: setEditingUser,
    onToggleUserActive: handleToggleUserActive,
    onDeleteUser: (user: User) => setDeletingUser(user),
  };

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Total users" value={stats.total} color="indigo" icon="people" />
            <StatCard label="Active" value={stats.active} color="emerald" icon="check_circle" />
            <StatCard label="Inactive" value={stats.inactive} color="rose" icon="person_off" />
            <StatCard label="Avg workload" value={formatPercent(stats.avgWorkload)} color="violet" icon="monitoring" />
          </>
        }
        filters={
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search users by name or email..."
            chipGroups={[
              {
                key: "status",
                options: statusChips,
                value: statusFilter,
                onChange: setStatusFilter,
              },
            ]}
            actions={
              <>
                {isAdmin && (
                  <FilterDropdown
                    value={selectedOrg}
                    onChange={(val) => {
                      setSelectedOrg(val);
                      setSelectedDept("");
                    }}
                    label="Org"
                    icon="apartment"
                    options={orgOptions}
                    width="min-w-[160px]"
                  />
                )}
                <FilterDropdown
                  value={selectedDept}
                  onChange={setSelectedDept}
                  label="Dept"
                  icon="account_tree"
                  options={deptOptions}
                  width="min-w-[160px]"
                />
                <FilterDropdown
                  value={roleFilter}
                  onChange={setRoleFilter}
                  label="Role"
                  icon="badge"
                  options={ROLE_FILTER_OPTIONS}
                  width="min-w-[150px]"
                />
                <SortDropdown value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORT_OPTIONS} />
                <ViewToggle value={view} onChange={setView} available={["card", "list", "table"]} />
              </>
            }
          />
        }
      >
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

        {/* Empty / Card / List / Table */}
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon="person_off"
            title="No users found"
            description={
              activeFilterCount > 0
                ? "No users match the current filters. Clear filters or adjust them to see more people."
                : "There are no users yet. Register your first user to get started."
            }
            accent="primary"
            action={
              activeFilterCount > 0 ? (
                <PageAction
                  variant="outline"
                  icon="filter_alt_off"
                  label="Clear all filters"
                  onClick={resetFilters}
                />
              ) : canManageUsers ? (
                <PageAction icon="add" label="New user" onClick={() => setShowCreateUser(true)} />
              ) : undefined
            }
          />
        ) : view === "card" ? (
          <div key="card" className="view-fade grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
            {filteredUsers.map((user, idx) => (
              <div key={user.id} className="card-stagger" style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
                <UserCard
                  user={user}
                  canUploadPictures={sharedViewProps.canUploadPictures}
                  showOrganizationName={sharedViewProps.showOrganizationName}
                  canManageUsers={canManageUsers}
                  departments={departments}
                  organizations={organizations}
                  token={sharedViewProps.token}
                  onPictureUploaded={sharedViewProps.onPictureUploaded}
                  onEditUser={setEditingUser}
                  onToggleUserActive={handleToggleUserActive}
                  onDeleteUser={sharedViewProps.onDeleteUser}
                  onOpenUser={openUserView}
                />
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          <div key="list" className="view-fade pb-10">
            <GlassCard className="overflow-hidden">
              <div className="divide-y divide-slate-100">
                {filteredUsers.map((user, idx) => (
                  <UserListRow
                    key={user.id}
                    user={user}
                    index={idx}
                    canUploadPictures={sharedViewProps.canUploadPictures}
                    showOrganizationName={sharedViewProps.showOrganizationName}
                    canManageUsers={canManageUsers}
                    departments={departments}
                    organizations={organizations}
                    token={sharedViewProps.token}
                    onPictureUploaded={sharedViewProps.onPictureUploaded}
                    onEditUser={setEditingUser}
                    onToggleUserActive={handleToggleUserActive}
                    onDeleteUser={sharedViewProps.onDeleteUser}
                    onOpenUser={openUserView}
                  />
                ))}
              </div>
            </GlassCard>
          </div>
        ) : (
          <div key="table" className="pb-10">
            <UsersTable
              users={filteredUsers}
              departments={departments}
              organizations={organizations}
              token={sharedViewProps.token}
              canUploadPictures={sharedViewProps.canUploadPictures}
              showOrganizationName={sharedViewProps.showOrganizationName}
              canManageUsers={canManageUsers}
              onPictureUploaded={sharedViewProps.onPictureUploaded}
              onEditUser={setEditingUser}
              onToggleUserActive={handleToggleUserActive}
              onDeleteUser={sharedViewProps.onDeleteUser}
              onOpenUser={openUserView}
            />
          </div>
        )}
      </PageContainer>

      {/* Right-slide view panel — stays mounted so switching users swaps content in place */}
      <UserViewPanel
        user={viewingUser}
        departments={departments}
        organizations={organizations}
        showOrganizationName={perm.isSuperAdmin}
        canManageUsers={canManageUsers}
        onClose={() => setViewingUserId(null)}
        onEdit={(user) => {
          setViewingUserId(null);
          setEditingUser(user);
        }}
        onToggleUserActive={handleToggleUserActive}
      />

      {editingUser && auth && (
        <UserEditModal
          user={editingUser}
          departments={departments}
          organizations={organizations}
          canSelectSuperAdminRole={isAdmin}
          userMaxLevel={userMaxLevel}
          onClose={() => setEditingUser(null)}
          onSubmit={async (payload) => {
            const updated = await api.updateUser(auth.token, editingUser.id, payload);
            setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
            setEditingUser(null);
            addToast("User updated successfully.");
            void loadData();
          }}
        />
      )}

      {showCreateUser && auth && (
        <UserFormModal
          organizations={organizations}
          defaultOrganizationId={isAdmin ? "" : organizations[0]?.id}
          hideOrganization={!isAdmin}
          onSubmit={async (data) => {
            await api.registerUser(auth.token, data);
            setShowCreateUser(false);
            addToast("User registered successfully.");
            loadData();
          }}
          onCancel={() => setShowCreateUser(false)}
        />
      )}

      {deletingUser && auth && (
        <Modal
          open={true}
          onClose={() => {
            if (!deleting) setDeletingUser(null);
          }}
          title="Deactivate user"
          description={`This will deactivate ${deletingUser.fullName}.`}
          icon="delete"
          accent="danger"
          size="sm"
          footer={
            <>
              <ModalCancelButton onClick={() => setDeletingUser(null)} />
              <ModalDangerButton
                label="Deactivate"
                loading={deleting}
                onClick={async () => {
                  if (deleting) return;
                  setDeleting(true);
                  try {
                    await api.deactivateUser(auth.token, deletingUser.id);
                    setUsers((current) =>
                      current.map((user) =>
                        user.id === deletingUser.id ? { ...user, isActive: false } : user
                      )
                    );
                    setDeletingUser(null);
                    addToast("User deactivated.");
                    void loadData();
                  } catch (cause) {
                    addToast(cause instanceof Error ? cause.message : "Failed to deactivate user.", "error");
                  } finally {
                    setDeleting(false);
                  }
                }}
              />
            </>
          }
        >
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Icon name="info" size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              The user remains in the database and can be audited later. You can reactivate them at any time.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Shared row helpers                                                  */
/* ────────────────────────────────────────────────────────────────── */

function workloadPercentOf(user: User) {
  const score = user.aiWorkloadScore || 0;
  return score <= 1 ? score * 100 : score;
}

function departmentLabel(
  user: User,
  departments: Department[],
  organizations: OrganizationRecord[],
  showOrganizationName: boolean,
) {
  const dept = departments.find((d) => d.id === user.departmentId);
  const org = organizations.find((item) => item.id === (user.organizationId ?? dept?.organizationId));
  const label = user.departments?.length
    ? user.departments
        .map((item) =>
          `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`,
        )
        .join(", ")
    : dept?.name || user.department || "Unassigned";
  return { label, orgName: showOrganizationName ? org?.name : undefined };
}

function workloadBarColor(percent: number) {
  return percent > 80
    ? "bg-gradient-to-r from-red-400 to-red-500"
    : percent > 60
      ? "bg-gradient-to-r from-amber-400 to-amber-500"
      : "bg-gradient-to-r from-emerald-400 to-emerald-500";
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border shrink-0 ${
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-red-50 text-red-700 border-red-100"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

type UserRowActionProps = {
  user: User;
  token: string;
  canUploadPictures: boolean;
  canManageUsers: boolean;
  onPictureUploaded: (user: User) => void;
  onOpenUser?: (user: User) => void;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
};

function UserRowActions({
  user,
  token,
  canUploadPictures,
  canManageUsers,
  onPictureUploaded,
  onOpenUser,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
}: UserRowActionProps) {
  const isActive = user.isActive !== false;
  if (!canManageUsers && !canUploadPictures && !onOpenUser) return null;

  // Always visible: delete (permission-gated, only where it exists today — active users)
  const always =
    canManageUsers && isActive && onDeleteUser
      ? [{ icon: "delete", label: "Delete user", tone: "danger" as const, onClick: () => onDeleteUser?.(user) }]
      : [];

  // On hover: view (right-slide panel), edit (sheet) and the activate/deactivate toggle
  const onHover = [
    ...(onOpenUser ? [{ icon: "view", label: "View user", onClick: () => onOpenUser?.(user) }] : []),
    ...(canManageUsers && onEditUser
      ? [{ icon: "edit", label: "Edit user", onClick: () => onEditUser?.(user) }]
      : []),
    ...(canManageUsers && onToggleUserActive
      ? [
          {
            icon: isActive ? "person_off" : "restart_alt",
            label: isActive ? "Deactivate user" : "Reactivate user",
            onClick: () => onToggleUserActive?.(user),
          },
        ]
      : []),
  ];

  return (
    <div className="flex items-center gap-0.5 shrink-0" onClick={(event) => event.stopPropagation()}>
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
      <HoverActions entity="users" always={always} onHover={onHover} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Card view                                                           */
/* ────────────────────────────────────────────────────────────────── */

function UserCard({
  user,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationName,
  canManageUsers,
  onPictureUploaded,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
  onOpenUser,
}: {
  user: User;
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
  showOrganizationName: boolean;
  canManageUsers: boolean;
  onPictureUploaded: (user: User) => void;
  onOpenUser?: (user: User) => void;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
}) {
  const workloadPercent = workloadPercentOf(user);
  const { label: deptLabel, orgName } = departmentLabel(user, departments, organizations, showOrganizationName);
  const isActive = user.isActive !== false;
  const roleLabel = roleDisplayNames(user.roles).join(", ") || user.jobTitle || "—";

  return (
    <GlassCard
      className="group h-full p-4 flex flex-col cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${user.fullName}`}
      onClick={() => onOpenUser?.(user)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenUser?.(user);
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar person={user} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
            {user.fullName}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
          {user.jobTitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.jobTitle}</p>}
        </div>
        <UserStatusBadge isActive={isActive} />
      </div>

      {/* Role + department chips */}
      <div className="flex items-center gap-1.5 flex-wrap mt-3 mb-3">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full">
          <Icon name="badge" size={11} className="shrink-0" />
          <span className="truncate">{roleLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 max-w-full">
          <Icon name="account_tree" size={11} className="shrink-0" />
          <span className="truncate">{deptLabel}</span>
        </span>
        {orgName && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100 max-w-full">
            <Icon name="apartment" size={11} className="shrink-0" />
            <span className="truncate">{orgName}</span>
          </span>
        )}
      </div>

      {/* Workload + actions footer */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-3">
        {workloadPercent > 0 && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
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
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${workloadBarColor(workloadPercent)}`}
                style={{ width: `${Math.min(workloadPercent, 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className={workloadPercent > 0 ? "shrink-0" : "flex-1 flex justify-end"}>
          <UserRowActions
            user={user}
            token={token}
            canUploadPictures={canUploadPictures}
            canManageUsers={canManageUsers}
            onPictureUploaded={onPictureUploaded}
            onOpenUser={onOpenUser}
            onEditUser={onEditUser}
            onToggleUserActive={onToggleUserActive}
            onDeleteUser={onDeleteUser}
          />
        </div>
      </div>
    </GlassCard>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* List view                                                           */
/* ────────────────────────────────────────────────────────────────── */

function UserListRow({
  user,
  index,
  departments,
  organizations,
  token,
  canUploadPictures,
  showOrganizationName,
  canManageUsers,
  onPictureUploaded,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
  onOpenUser,
}: {
  user: User;
  index: number;
  departments: Department[];
  organizations: OrganizationRecord[];
  token: string;
  canUploadPictures: boolean;
  showOrganizationName: boolean;
  canManageUsers: boolean;
  onPictureUploaded: (user: User) => void;
  onOpenUser?: (user: User) => void;
  onEditUser?: (user: User) => void;
  onToggleUserActive?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
}) {
  const workloadPercent = workloadPercentOf(user);
  const { label: deptLabel, orgName } = departmentLabel(user, departments, organizations, showOrganizationName);
  const isActive = user.isActive !== false;
  const roleLabel = roleDisplayNames(user.roles).join(", ") || user.jobTitle || "—";

  return (
    <div
      className="card-stagger group flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-indigo-50/40"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${user.fullName}`}
      onClick={() => onOpenUser?.(user)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenUser?.(user);
        }
      }}
    >
      <Avatar person={user} size="md" className="shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <div className="text-sm font-semibold text-slate-800 truncate">{user.fullName}</div>
        <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
      </div>
      <div className="hidden sm:block w-40 min-w-0">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full">
          <Icon name="badge" size={11} className="shrink-0" />
          <span className="truncate">{roleLabel}</span>
        </span>
      </div>
      <div className="hidden md:block w-44 min-w-0">
        <div className="text-xs text-slate-600 truncate">{deptLabel}</div>
        {orgName && <div className="text-[10px] text-slate-400 truncate">{orgName}</div>}
      </div>
      <div className="hidden lg:flex w-36 items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${workloadBarColor(workloadPercent)}`}
            style={{ width: `${Math.min(workloadPercent, 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-slate-600 shrink-0">{formatPercent(workloadPercent)}</span>
      </div>
      <UserStatusBadge isActive={isActive} />
      <div className="ml-auto">
        <UserRowActions
          user={user}
          token={token}
          canUploadPictures={canUploadPictures}
          canManageUsers={canManageUsers}
          onPictureUploaded={onPictureUploaded}
          onOpenUser={onOpenUser}
          onEditUser={onEditUser}
          onToggleUserActive={onToggleUserActive}
          onDeleteUser={onDeleteUser}
        />
      </div>
    </div>
  );
}
