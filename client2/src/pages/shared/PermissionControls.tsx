import type { ReactNode } from "react";
import { useAuth } from "../../auth";
import { usePermission } from "./RoleGate";

type CanProps = {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ permission, fallback = null, children }: CanProps) {
  const perm = usePermission();
  if (!perm.has(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

type CanAnyProps = {
  permissions: readonly string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function CanAny({ permissions, fallback = null, children }: CanAnyProps) {
  const perm = usePermission();
  if (!perm.hasAny(...permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

type CanAllProps = {
  permissions: readonly string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function CanAll({ permissions, fallback = null, children }: CanAllProps) {
  const perm = usePermission();
  if (!perm.hasAll(...permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

type RoutePermissionGuardProps = {
  permission?: string;
  anyOf?: readonly string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function RoutePermissionGuard({
  permission,
  anyOf,
  fallback,
  children,
}: RoutePermissionGuardProps) {
  const { auth } = useAuth();
  const perm = usePermission();

  if (!auth) return <>{fallback ?? null}</>;

  const allowed = permission
    ? perm.has(permission)
    : anyOf?.length
      ? perm.hasAny(...anyOf)
      : true;

  if (!allowed) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
