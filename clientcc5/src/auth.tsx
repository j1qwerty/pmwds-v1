import {
  createContext,
  useCallback,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { api } from "./api";
import { coversAnyPermission, coversManagedPermission, hasRoleKey, normalizeRoleKey, type RoleKeyCode } from "./permissions";
import type { AuthResponse, Role, RoleKey } from "./types";

export type AuthState = {
  token: string;
  expiry: string;
  refreshToken?: string;
  refreshTokenExpiry?: string;
  userId: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string | null;
  roles: Role[];
  roleKeys: RoleKey[];
  permissions: string[];
};

type AuthContextValue = {
  auth: AuthState | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateCurrentUser: (patch: Partial<Pick<AuthState, "fullName" | "email" | "profilePictureUrl">>) => void;
  hasRole: (...roles: RoleKeyCode[]) => boolean;
  hasPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
};

const STORAGE_KEY = "pmwds-client-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuth(response: AuthResponse): AuthState {
  return {
    token: response.token,
    expiry: response.expiry,
    refreshToken: response.refreshToken,
    refreshTokenExpiry: response.refreshTokenExpiry,
    userId: response.userId,
    fullName: response.fullName,
    email: response.email,
    profilePictureUrl: response.profilePictureUrl,
    roles: response.roles,
    roleKeys: (response.roleKeys ?? response.roles.map(normalizeRoleKey)) as RoleKey[],
    permissions: response.permissions ?? [],
  };
}

function normalizeStoredAuth(value: AuthState): AuthState {
  return {
    ...value,
    roleKeys: value.roleKeys?.length
      ? value.roleKeys
      : (value.roles ?? []).map(normalizeRoleKey) as RoleKey[],
    permissions: value.permissions ?? [],
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeStoredAuth(JSON.parse(raw) as AuthState) : null;
  });

  useEffect(() => {
    if (auth) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return;

    const expiry = new Date(auth.expiry).getTime();
    const timeout = expiry - Date.now() - 60_000;

    const doRefresh = async () => {
      try {
        if (!auth.refreshToken) {
          throw new Error("Refresh token is missing.");
        }

        const refreshed = await api.refresh(auth.userId, auth.refreshToken);
        startTransition(() => {
          setAuth((current) =>
            current
              ? {
                  ...current,
                  token: refreshed.token,
                  expiry: refreshed.expiry,
                  refreshToken: refreshed.refreshToken,
                  refreshTokenExpiry: refreshed.refreshTokenExpiry,
                }
              : current,
          );
        });
      } catch {
        setAuth(null);
      }
    };

    if (timeout <= 0) {
      void doRefresh();
      return;
    }

    const timer = window.setTimeout(() => void doRefresh(), timeout);
    return () => window.clearTimeout(timer);
  }, [auth]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setAuth(mapAuth(response));
  }, []);

  const logout = useCallback(() => {
    if (auth?.token) {
      void api.logout(auth.token).catch(() => undefined);
    }
    setAuth(null);
  }, [auth]);

  const refresh = useCallback(async () => {
    if (!auth) return;
    if (!auth.refreshToken) {
      setAuth(null);
      return;
    }

    const refreshed = await api.refresh(auth.userId, auth.refreshToken);
    setAuth({
      ...auth,
      token: refreshed.token,
      expiry: refreshed.expiry,
      refreshToken: refreshed.refreshToken,
      refreshTokenExpiry: refreshed.refreshTokenExpiry,
    });
  }, [auth]);

  const updateCurrentUser = useCallback((patch: Partial<Pick<AuthState, "fullName" | "email" | "profilePictureUrl">>) => {
    setAuth((current) => current ? { ...current, ...patch } : current);
  }, []);

  const hasRole = useCallback((...roles: RoleKeyCode[]) => {
    if (!auth) return false;
    return roles.some((role) => hasRoleKey(auth.roleKeys, role));
  }, [auth]);

  const hasPermission = useCallback((...permissions: string[]) => {
    if (!auth) return false;
    return coversAnyPermission(auth.permissions ?? [], permissions);
  }, [auth]);

  const hasAllPermissions = useCallback((...permissions: string[]) => {
    if (!auth) return false;
    if (!permissions.length) return true;
    return permissions.every((permission) => coversManagedPermission(auth.permissions ?? [], permission));
  }, [auth]);

  const value: AuthContextValue = useMemo(() => ({
    auth,
    login,
    logout,
    refresh,
    updateCurrentUser,
    hasRole,
    hasPermission,
    hasAllPermissions,
  }), [auth, login, logout, refresh, updateCurrentUser, hasRole, hasPermission, hasAllPermissions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
