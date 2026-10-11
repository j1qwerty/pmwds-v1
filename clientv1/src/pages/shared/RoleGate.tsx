import { useMemo, type ReactNode } from "react";
import { useAuth } from "../../auth";
import {
  PERMISSION_GROUPS,
  Permission,
  ROLE_LEVELS,
  RoleKey,
  expandPermissions,
  isSuperAdmin,
  normalizeRoleKey,
  type PermissionCode,
  type PermissionModule,
} from "../../permissions";

export { Permission, PERMISSION_GROUPS, ROLE_LEVELS, RoleKey, expandPermissions };
export type { PermissionCode, PermissionModule };

type RoleGateProps = {
  allow?: string[];
  deny?: string[];
  permissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

function canUseRole(userRoles: readonly string[] | undefined, allow?: readonly string[], deny?: readonly string[]) {
  if (!userRoles?.length) return false;
  const normalized = userRoles.map(normalizeRoleKey);
  if (deny?.some((role) => normalized.includes(normalizeRoleKey(role)))) return false;
  if (!allow?.length) return true;
  return allow.some((role) => normalized.includes(normalizeRoleKey(role)));
}

export function RoleGate({ allow, deny, permissions, fallback = null, children }: RoleGateProps) {
  const { auth, hasPermission } = useAuth();
  const allowedByPermission = permissions?.length ? hasPermission(...permissions) : true;
  const allowedByRole = allow?.length || deny?.length ? canUseRole(auth?.roleKeys, allow, deny) : true;
  return allowedByPermission && allowedByRole ? <>{children}</> : <>{fallback}</>;
}

type ModuleActions = {
  view: () => boolean;
  create: () => boolean;
  edit: () => boolean;
  delete: () => boolean;
  manage: () => boolean;
  [key: string]: () => boolean;
};

function buildModuleActions(
  module: PermissionModule,
  hasPermission: (...perms: string[]) => boolean,
): ModuleActions {
  const group = PERMISSION_GROUPS[module] as Record<string, string | undefined>;
  const make = (key: string) => () => {
    const code = group[key];
    return code ? hasPermission(code) : false;
  };
  const actions: ModuleActions = {
    view: make("view"),
    create: make("create"),
    edit: make("edit"),
    delete: make("delete"),
    manage: make("manage"),
  };
  for (const key of Object.keys(group)) {
    if (key in actions) continue;
    actions[key] = make(key);
  }
  return actions;
}

export type UsePermissionResult = {
  roles: string[];
  roleKeys: string[];
  permissions: readonly string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  has: (permission: string) => boolean;
  hasAny: (...permissions: string[]) => boolean;
  hasAll: (...permissions: string[]) => boolean;
  can: (...permissions: string[]) => boolean;
  canModule: (action: string, module: PermissionModule) => boolean;
  module: (name: PermissionModule) => ModuleActions;
};

export function usePermission(): UsePermissionResult {
  const { auth, hasPermission, hasAllPermissions } = useAuth();
  const permissions = auth?.permissions ?? [];
  const roles = auth?.roles ?? [];
  const roleKeys = auth?.roleKeys ?? [];

  return useMemo<UsePermissionResult>(() => {
    const result: UsePermissionResult = {
      roles,
      roleKeys,
      permissions,
      isAdmin: isSuperAdmin(permissions),
      isSuperAdmin: isSuperAdmin(permissions),
      has: (permission: string) => hasPermission(permission),
      hasAny: (...perms: string[]) => hasPermission(...perms),
      hasAll: (...perms: string[]) => hasAllPermissions(...perms),
      can: (...perms: string[]) => hasPermission(...perms),
      canModule: (action: string, module: PermissionModule) => {
        const group = PERMISSION_GROUPS[module] as Record<string, string | undefined>;
        const code = group[action];
        if (code) return hasPermission(code);
        const manage = group.manage;
        return manage ? hasPermission(manage) : false;
      },
      module: (name: PermissionModule) => buildModuleActions(name, hasPermission),
    };
    return result;
  }, [roles, roleKeys, permissions, hasPermission, hasAllPermissions]);
}
