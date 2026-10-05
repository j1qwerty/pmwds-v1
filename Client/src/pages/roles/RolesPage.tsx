import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { PermissionRecord, RoleRecord } from "../../types";
import { roleDisplayName } from "../../permissions";
import {
  AnimatedBackground,
  GlassCard,
  LoadingPage,
  PERMISSION_GROUPS,
  ROLE_LEVELS,
  useNavHeader,
  ModalOverlay,
  DeleteConfirmationModal,
  usePermission,
  expandPermissions,
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

  const assignablePermissions = useMemo(() => {
    if (!auth) return [];
    if (perm.isSuperAdmin) return permissions;
    const userPermSet = new Set(expandPermissions(auth.permissions));
    return permissions.filter((p) =>
      !ADMIN_ONLY_MODULES.has(p.module) && userPermSet.has(p.code),
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
          value={permissions.filter(p => p.isGlobal).length} 
          color="emerald" 
          icon="public" 
        />
        <StatCard 
          label="Avg Level" 
          value={roles.length > 0 ? Math.round(roles.reduce((sum, r) => sum + r.permissionLevel, 0) / roles.length) : 0}
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
            count={permissions.length}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="relative z-10">
        {activeTab === "roles" && (
          <RolesTable
            roles={visibleRoles}
            onEdit={(role) => setRoleModal({ open: true, editRole: role })}
            onDelete={(role) => setDeleteConfirm({ open: true, type: "role", id: role.id, name: roleDisplayName(role.name) })}
            onCreate={() => setRoleModal({ open: true })}
            isAdmin={canManageRoles}
          />
        )}

        {activeTab === "permissions" && (
          <PermissionsTable
            permissions={permissions}
            onEdit={(perm) => setPermissionModal({ open: true, editPermission: perm })}
            onDelete={(perm) => setDeleteConfirm({ open: true, type: "permission", id: perm.id, name: perm.code })}
            onCreate={() => setPermissionModal({ open: true })}
            isAdmin={canManagePermissions}
          />
        )}
      </div>

      {/* Modals */}
      {roleModal.open && (
        <ModalOverlay onClose={() => setRoleModal({ open: false })}>
          <RoleFormModal
            initialData={roleModal.editRole}
            permissions={assignablePermissions}
            onSubmit={handleRoleSubmit}
            onCancel={() => setRoleModal({ open: false })}
          />
        </ModalOverlay>
      )}

      {permissionModal.open && (
        <ModalOverlay onClose={() => setPermissionModal({ open: false })}>
          <PermissionFormModal
            initialData={permissionModal.editPermission}
            onSubmit={handlePermissionSubmit}
            onCancel={() => setPermissionModal({ open: false })}
          />
        </ModalOverlay>
      )}

      {deleteConfirm.open && (
        <ModalOverlay onClose={() => setDeleteConfirm({ open: false, type: "role", id: "", name: "" })}>
          <DeleteConfirmationModal
            name={deleteConfirm.name}
            warning={`This will permanently delete this ${deleteConfirm.type}. ${deleteConfirm.type === "role" ? "Users assigned this role will lose associated permissions." : "Roles using this permission will be affected."}`}
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, type: "role", id: "", name: "" })}
          />
        </ModalOverlay>
      )}
    </div>
  );
}


