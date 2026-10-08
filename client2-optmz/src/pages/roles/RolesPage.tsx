import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import type { PermissionRecord, RoleRecord } from "../../types";
import { coversManagedPermission, normalizeRoleKey, roleDisplayName } from "../../permissions";
import {
  AnimatedBackground,
  PageSkeleton,
  PERMISSION_GROUPS,
  ROLE_LEVELS,
  useNavHeader,
  Modal,
  ModalCancelButton,
  ModalDangerButton,
  usePermission,
  StatCard,
  TabButton,
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  PageContainer,
  GlassCard,
  useToast,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { RolesTable } from "./RolesTable";
import { PermissionsTable } from "./PermissionsTable";
import { RoleFormModal } from "./RoleFormModal";
import { PermissionFormModal } from "./PermissionFormModal";

type RoleSortKey = "nameAsc" | "nameDesc" | "levelDesc" | "levelAsc";

const ROLE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "levelDesc", label: "Level (high → low)" },
  { value: "levelAsc", label: "Level (low → high)" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
];

export function RolesPage() {
  const { auth } = useAuth();
  const { data: appData } = useAppData();
  const perm = usePermission();
  const canManageRoles = perm.has(PERMISSION_GROUPS.role.manage);
  const canManagePermissions = perm.has(PERMISSION_GROUPS.permission.manage);

  const userMaxLevel = useMemo(() => {
    if (!auth?.roleKeys?.length) return 0;
    return Math.max(...auth.roleKeys.map((r) => ROLE_LEVELS[r] ?? 0));
  }, [auth]);

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"roles" | "permissions">("roles");
  const [deleting, setDeleting] = useState(false);

  // Roles tab view state (FilterBar + card/list toggle live on the page)
  const [roleQuery, setRoleQuery] = useState("");
  const [roleSort, setRoleSort] = useState<RoleSortKey>("levelDesc");
  const [roleView, setRoleView] = useState<ViewMode>("card");

  // Modal states
  const [roleModal, setRoleModal] = useState<{ open: boolean; editRole?: RoleRecord }>({ open: false });
  const [permissionModal, setPermissionModal] = useState<{ open: boolean; editPermission?: PermissionRecord }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "role" | "permission";
    id: string;
    name: string;
  }>({ open: false, type: "role", id: "", name: "" });

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Roles & Permissions",
      description: "Manage role definitions, permission levels, and access control",
      ...(activeTab === "roles" && canManageRoles
        ? { action: { label: "New role", icon: "add", onClick: () => setRoleModal({ open: true }) } }
        : {}),
      ...(activeTab === "permissions" && canManagePermissions
        ? { action: { label: "New permission", icon: "add", onClick: () => setPermissionModal({ open: true }) } }
        : {}),
    });
  }, [setNavHeader, activeTab, canManageRoles, canManagePermissions]);

  const visibleRoles = useMemo(() => {
    if (perm.isSuperAdmin) return roles;
    return roles.filter((r) => r.permissionLevel < userMaxLevel);
  }, [roles, userMaxLevel, perm.isSuperAdmin]);

  const ADMIN_ONLY_MODULES = new Set(["Authorization", "Authentication", "System"]);

  // A role may only be given a permission the editor effectively holds. An exact
  // code match is not enough: an admin seeded with TASK_ALL_MANAGE holds
  // TASK_OWN_VIEW too (ALL covers OWN, MANAGE covers CRUD), so coverage — the
  // same semantics as perm.has() — decides what the matrix may offer. Otherwise
  // every Own Department row renders as "—" for anyone but superadmin.
  const assignablePermissions = useMemo(() => {
    if (!auth) return [];
    if (perm.isSuperAdmin) return permissions;
    return permissions.filter((p) =>
      !ADMIN_ONLY_MODULES.has(p.module) && coversManagedPermission(auth.permissions, p.code),
    );
  }, [permissions, auth, perm.isSuperAdmin]);

  const loadData = () => {
    if (!auth) return;
    setLoading(true);
    Promise.all([
      api.getRoles(auth.token),
      api.getPermissions(auth.token),
    ])
      .then(([roleData, permissionData]) => {
        setRoles(roleData);
        setPermissions(permissionData);
      })
      .catch((e) => addToast(`Error: ${e instanceof Error ? e.message : "Failed to load roles"}`, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [auth]);

  const handleRoleSubmit = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    try {
      if (roleModal.editRole) {
        await api.updateRole(auth.token, roleModal.editRole.id, payload);
        addToast("Role updated successfully.");
      } else {
        await api.createRole(auth.token, payload);
        addToast("Role created successfully.");
      }
      setRoleModal({ open: false });
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const handlePermissionSubmit = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    try {
      if (permissionModal.editPermission) {
        await api.updatePermission(auth.token, permissionModal.editPermission.id, payload);
        addToast("Permission updated successfully.");
      } else {
        await api.createPermission(auth.token, payload);
        addToast("Permission created successfully.");
      }
      setPermissionModal({ open: false });
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!auth || deleting) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === "role") {
        await api.deleteRole(auth.token, deleteConfirm.id);
      } else {
        await api.deletePermission(auth.token, deleteConfirm.id);
      }
      addToast(`${deleteConfirm.type === "role" ? "Role" : "Permission"} deleted.`);
      setDeleteConfirm({ open: false, type: "role", id: "", name: "" });
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Deletion failed"}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  // Roles-tab filtering + sorting (same semantics as before, lifted to the page)
  const filteredRoles = useMemo(() => {
    const term = roleQuery.trim().toLowerCase();
    let list = visibleRoles;
    if (term) {
      list = list.filter((role) =>
        [roleDisplayName(role.name), role.description, ...role.permissions.map((p) => p.code)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    const sorted = [...list];
    if (roleSort === "nameAsc") {
      sorted.sort((a, b) => roleDisplayName(a.name).localeCompare(roleDisplayName(b.name)));
    } else if (roleSort === "nameDesc") {
      sorted.sort((a, b) => roleDisplayName(b.name).localeCompare(roleDisplayName(a.name)));
    } else if (roleSort === "levelDesc") {
      sorted.sort((a, b) => b.permissionLevel - a.permissionLevel);
    } else if (roleSort === "levelAsc") {
      sorted.sort((a, b) => a.permissionLevel - b.permissionLevel);
    }
    return sorted;
  }, [visibleRoles, roleQuery, roleSort]);

  // Users per role, derived from the shared user directory (informational only).
  // A user matches a role through their roleKeys or their display role names —
  // the same normalized-key matching the Users page role filter uses.
  const roleUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const role of visibleRoles) counts[role.id] = 0;
    for (const user of appData.users) {
      const userRoleKeys = new Set<string>([
        ...(user.roleKeys ?? []).map(normalizeRoleKey),
        ...(user.roles ?? []).map(normalizeRoleKey),
      ]);
      for (const role of visibleRoles) {
        if (userRoleKeys.has(normalizeRoleKey(role.key))) counts[role.id] += 1;
      }
    }
    return counts;
  }, [visibleRoles, appData.users]);

  const usersWithVisibleRoles = useMemo(
    () =>
      appData.users.filter((user) => {
        const userRoleKeys = new Set<string>([
          ...(user.roleKeys ?? []).map(normalizeRoleKey),
          ...(user.roles ?? []).map(normalizeRoleKey),
        ]);
        return visibleRoles.some((role) => userRoleKeys.has(normalizeRoleKey(role.key)));
      }).length,
    [appData.users, visibleRoles],
  );

  // KPI stats derived from loaded data
  const stats = useMemo(
    () => ({
      roles: roles.length,
      permissions: permissions.length,
      global: permissions.filter((p) => p.isGlobal).length,
      usersWithRoles: usersWithVisibleRoles,
    }),
    [roles, permissions, usersWithVisibleRoles],
  );

  if (loading) return <PageSkeleton />;

  const closeDeleteConfirm = () => setDeleteConfirm({ open: false, type: "role", id: "", name: "" });

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Total roles" value={stats.roles} color="indigo" icon="shield" />
            <StatCard label="Permissions" value={stats.permissions} color="violet" icon="lock" />
            <StatCard label="Users assigned" value={stats.usersWithRoles} color="emerald" icon="group" />
            <StatCard label="Global permissions" value={stats.global} color="amber" icon="public" />
          </>
        }
      >
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 mb-5">
          <TabButton
            active={activeTab === "roles"}
            onClick={() => setActiveTab("roles")}
            icon="shield_person"
            label="Roles"
            count={visibleRoles.length}
          />
          <TabButton
            active={activeTab === "permissions"}
            onClick={() => setActiveTab("permissions")}
            icon="lock"
            label="Permissions"
            count={assignablePermissions.length}
          />
        </div>

        {/* Tab Content */}
        {activeTab === "roles" && (
          <div key="roles" className="view-fade flex flex-col gap-4">
            <FilterBar
              searchValue={roleQuery}
              onSearchChange={setRoleQuery}
              searchPlaceholder="Search roles by name, description, permission..."
              leftExtras={
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Showing <strong className="text-slate-700">{filteredRoles.length}</strong> of{" "}
                  {visibleRoles.length} roles
                </span>
              }
              actions={
                <>
                  <SortDropdown
                    value={roleSort}
                    onChange={(v) => setRoleSort(v as RoleSortKey)}
                    options={ROLE_SORT_OPTIONS}
                  />
                  <ViewToggle
                    value={roleView}
                    onChange={setRoleView}
                    available={["card", "list"]}
                  />
                </>
              }
            />

            {filteredRoles.length === 0 ? (
              <GlassCard className="view-fade">
                <EmptyState
                  icon="shield_person"
                  title={visibleRoles.length === 0 ? "No roles defined" : "No roles match"}
                  description={
                    visibleRoles.length === 0
                      ? canManageRoles
                        ? "Create roles to manage permission levels and access control."
                        : "No roles are available to view."
                      : "Nothing matches the current search or sort. Adjust them to see more roles."
                  }
                  accent="primary"
                  action={
                    canManageRoles && visibleRoles.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setRoleModal({ open: true })}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                      >
                        <Icon name="add" size={14} />
                        Create role
                      </button>
                    ) : undefined
                  }
                />
              </GlassCard>
            ) : roleView === "card" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6 view-fade">
                {filteredRoles.map((role, index) => (
                  <div
                    key={role.id}
                    className="card-stagger"
                    style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                  >
                    <RoleCard
                      role={role}
                      userCount={roleUserCounts[role.id]}
                      onEdit={() => setRoleModal({ open: true, editRole: role })}
                      onDelete={() =>
                        setDeleteConfirm({
                          open: true,
                          type: "role",
                          id: role.id,
                          name: roleDisplayName(role.name),
                        })
                      }
                      isAdmin={canManageRoles}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <RolesTable
                roles={filteredRoles}
                userCounts={roleUserCounts}
                onEdit={(role) => setRoleModal({ open: true, editRole: role })}
                onDelete={(role) =>
                  setDeleteConfirm({
                    open: true,
                    type: "role",
                    id: role.id,
                    name: roleDisplayName(role.name),
                  })
                }
                isAdmin={canManageRoles}
              />
            )}
          </div>
        )}

        {activeTab === "permissions" && (
          <div key="permissions" className="view-fade">
            <PermissionsTable
              permissions={assignablePermissions}
              onEdit={(perm) => setPermissionModal({ open: true, editPermission: perm })}
              onDelete={(perm) =>
                setDeleteConfirm({
                  open: true,
                  type: "permission",
                  id: perm.id,
                  name: perm.code,
                })
              }
              onCreate={() => setPermissionModal({ open: true })}
              isAdmin={canManagePermissions}
            />
          </div>
        )}
      </PageContainer>

      {/* Form panels — render themselves as right-slide Sheets (shared <Sheet>) */}
      {roleModal.open && (
        <RoleFormModal
          initialData={roleModal.editRole}
          permissions={assignablePermissions}
          onSubmit={handleRoleSubmit}
          onCancel={() => setRoleModal({ open: false })}
        />
      )}

      {permissionModal.open && (
        <PermissionFormModal
          initialData={permissionModal.editPermission}
          onSubmit={handlePermissionSubmit}
          onCancel={() => setPermissionModal({ open: false })}
        />
      )}

      {/* Delete Confirmation */}
      <Modal
        open={deleteConfirm.open}
        onClose={() => {
          if (!deleting) closeDeleteConfirm();
        }}
        title="Confirm deletion"
        description={`This will permanently delete "${deleteConfirm.name}".`}
        icon="delete"
        accent="danger"
        size="sm"
        footer={
          <>
            <ModalCancelButton
              onClick={() => {
                if (!deleting) closeDeleteConfirm();
              }}
            />
            <ModalDangerButton onClick={handleDelete} loading={deleting} label="Delete permanently" />
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <Icon name="info" size={14} className="shrink-0 mt-0.5" />
          <span>
            This action cannot be undone.
            {deleteConfirm.type === "role"
              ? " Users assigned this role will lose associated permissions."
              : " Roles using this permission will be affected."}
          </span>
        </div>
      </Modal>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function RoleCard({
  role,
  userCount,
  onEdit,
  onDelete,
  isAdmin,
}: {
  role: RoleRecord;
  userCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="group flex flex-col h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon name="shield_person" size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors"
              title={roleDisplayName(role.name)}
            >
              {roleDisplayName(role.name)}
            </h3>
            <span className="text-[10px] text-slate-400">
              Level {role.permissionLevel}
              {typeof userCount === "number" && (
                <>
                  {" \u00b7 "}
                  {userCount} {userCount === 1 ? "user" : "users"}
                </>
              )}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
          {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
        </span>
      </div>

      {role.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
          {role.description}
        </p>
      )}

      {role.permissions.length > 0 ? (
        <div className="mb-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Permissions
          </p>
          <div className="flex flex-wrap gap-1">
            {role.permissions.slice(0, 5).map((perm) => (
              <span
                key={perm.id}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono"
              >
                {perm.code}
              </span>
            ))}
            {role.permissions.length > 5 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200">
                +{role.permissions.length - 5} more
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic mb-3">No permissions assigned</p>
      )}

      {isAdmin && (
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit role: ${roleDisplayName(role.name)}`}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Icon name="edit" size={11} />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete role: ${roleDisplayName(role.name)}`}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Icon name="delete" size={11} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
