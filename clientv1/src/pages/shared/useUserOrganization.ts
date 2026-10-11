import { useMemo } from "react";
import { useAuth } from "../../auth";
import type { Department, User } from "../../types";
import { Permission } from "./RoleGate";

export function useUserOrganization(users: User[], departments: Department[]) {
  const { auth, hasPermission } = useAuth();

  const isOrgAdmin = hasPermission(Permission.SystemAdmin, Permission.OrganizationCreate, Permission.OrganizationEdit, Permission.OrganizationDelete);

  const userOrganizationId = useMemo(() => {
    if (isOrgAdmin || !auth) return null;

    const currentUser = users.find(u => u.id === auth.userId);
    if (!currentUser) return null;

    // Directors can be assigned directly to an organization without a primary
    // department. Prefer that authoritative user scope before department fallbacks.
    if (currentUser.organizationId) return currentUser.organizationId;

    const primaryDept = currentUser.departments?.find(d => d.isPrimary);
    if (primaryDept?.organizationId) return primaryDept.organizationId;

    const firstDept = currentUser.departments?.[0];
    if (firstDept?.organizationId) return firstDept.organizationId;

    if (currentUser.departmentId) {
      const dept = departments.find(d => d.id === currentUser.departmentId);
      return dept?.organizationId ?? null;
    }

    return null;
  }, [isOrgAdmin, auth, users, departments]);

  return {
    isOrgAdmin,
    userOrganizationId,
    shouldFilterByOrg: !isOrgAdmin && userOrganizationId !== null,
  };
}
