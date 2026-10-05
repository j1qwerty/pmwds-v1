import { usePermission, type UsePermissionResult } from "./RoleGate";

export type FlagProp = boolean | undefined;

export type PermissionFlag = {
  boolean?: boolean;
  permission?: string;
  anyOf?: readonly string[];
};

export function resolveFlag(
  perm: UsePermissionResult,
  legacy: FlagProp,
  flag: PermissionFlag | undefined,
): boolean {
  if (legacy !== undefined) return legacy;
  if (!flag) return false;
  if (flag.boolean !== undefined) return flag.boolean;
  if (flag.permission) return perm.has(flag.permission);
  if (flag.anyOf?.length) return perm.hasAny(...flag.anyOf);
  return false;
}

export function useResolvedFlag(
  legacy: FlagProp,
  flag: PermissionFlag | undefined,
): boolean {
  const perm = usePermission();
  return resolveFlag(perm, legacy, flag);
}
