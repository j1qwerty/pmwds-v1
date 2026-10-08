import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { PermissionRecord, RoleRecord } from "../../types";
import { coversManagedPermission, roleDisplayName } from "../../permissions";
import {
  AnimatedBackground,
  LoadingPage,
  PERMISSION_GROUPS,
  ROLE_LEVELS,
  useNavHeader,
  Modal,
  ModalCancelButton,
  ModalDangerButton,
  usePermission,
  StatCard,
  TabButton,
  useToast,
} from "../shared";
import { RolesTable } from "./RolesTable";
import { PermissionsTable } from "./PermissionsTable";
import { RoleFormModal } from "./RoleFormModal";
import { PermissionFormModal } from "./PermissionFormModal";

export function RolesPage() {
  const { auth } = useAuth();
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
    setNavHeader({ title: "Roles & Permissions", description: "Manage role definitions, permission levels, and access control" });
  }, [setNavHeader]);

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
    if (!auth) return;
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
    }
  };

  if (loading) return <LoadingPage label="Loading roles and permissions..." />;

  return (
    <div>
      <AnimatedBackground />

      {/* Stats Row */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Roles" value={roles.length} color="indigo" icon="shield" />
        <StatCard label="Permissions" value={permissions.length} color="violet" icon="lock" />
        <StatCard
          label="Global Perms"
          value={permissions.filter((p) => p.isGlobal).length}
          color="emerald"
          icon="public"
        />
        <StatCard
          label="Avg Level"
          value={
            roles.length > 0
              ? Math.round(roles.reduce((sum, r) => sum + r.permissionLevel, 0) / roles.length)
              : 0
          }
          color="amber"
          icon="trending_up"
        />
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 mb-5">
        <div className="flex gap-2 border-b border-slate-200">
          <TabButton
            active={activeTab === "roles"}
            onClick={() => setActiveTab("roles")}
            icon="shield"
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
      </div>

      {/* Tab Content */}
      <div className="relative z-10">
        {activeTab === "roles" && (
          <RolesTable
            roles={visibleRoles}
            onEdit={(role) => setRoleModal({ open: true, editRole: role })}
            onDelete={(role) =>
              setDeleteConfirm({
                open: true,
                type: "role",
                id: role.id,
                name: roleDisplayName(role.name),
              })
            }
            onCreate={() => setRoleModal({ open: true })}
            isAdmin={canManageRoles}
          />
        )}

        {activeTab === "permissions" && (
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
        )}
      </div>

      {/* Form Modals — render themselves with the new <Modal> wrapper */}
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
        onClose={() => setDeleteConfirm({ open: false, type: "role", id: "", name: "" })}
        title="Confirm Deletion"
        description={`This will permanently delete "${deleteConfirm.name}".`}
        icon="warning"
        accent="danger"
        size="sm"
        footer={
          <>
            <ModalCancelButton
              onClick={() => setDeleteConfirm({ open: false, type: "role", id: "", name: "" })}
            />
            <ModalDangerButton onClick={handleDelete} label="Delete Permanently" />
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">info</span>
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
