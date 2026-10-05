import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, SkillRecord, User } from "../../types";
import {
  AnimatedBackground,
  DeleteConfirmationModal,
  ModalOverlay,
  useNavHeader,
  PageSkeleton,
  PERMISSION_GROUPS,
  ROLE_LEVELS,
  usePermission,
  StatCard,
  useToast,
} from "../shared";
import { UsersTable } from "./UsersTable";
import { UserEditModal } from "./UserEditModal";
import { UserFormModal } from "../NewProject/components/UserFormModal";

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
  const [showCreateUser, setShowCreateUser] = useState(false);

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Users",
      description: "People operations, capacity, activation state, and workload shape",
      action: canManageUsers ? {
        label: "New User",
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

  useEffect(() => { loadData(); }, [auth]);

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

  return (
    <div>
      <AnimatedBackground />

      {/* Stats Row */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Total Users" value={users.length} color="indigo" icon="people" />
        <StatCard label="Departments" value={departments.length} color="violet" icon="business" />
        <StatCard 
          label="Active Users" 
          value={users.filter(u => u.isActive !== false).length} 
          color="emerald" 
          icon="check_circle" 
        />
      </div>

      {/* Users Directory */}
      <div className="relative z-10">
        <UsersTable
          users={users}
          departments={departments}
          organizations={organizations}
          token={auth?.token ?? ""}
          canUploadPictures={isAdmin}
          showOrganizationFilter={isAdmin}
          showOrganizationName={perm.isSuperAdmin}
          canManageUsers={canManageUsers}
          onEditUser={setEditingUser}
          onToggleUserActive={handleToggleUserActive}
          onPictureUploaded={(updated) => {
            setUsers(current => current.map(user => user.id === updated.id ? updated : user));
            addToast("Profile picture updated.");
          }}
          onUpdate={loadData}
        />
      </div>

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
        <ModalOverlay onClose={() => setDeletingUser(null)}>
          <DeleteConfirmationModal
            name={deletingUser.fullName}
            warning="The user remains in the database and can be audited later."
            onConfirm={async () => {
              await api.deactivateUser(auth.token, deletingUser.id);
              setUsers((current) =>
                current.map((user) =>
                  user.id === deletingUser.id ? { ...user, isActive: false } : user
                )
              );
              setDeletingUser(null);
              addToast("User deactivated.");
              void loadData();
            }}
            onCancel={() => setDeletingUser(null)}
          />
        </ModalOverlay>
      )}
    </div>
  );
}
