import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError, api } from "./api";
import { useAuth } from "./auth";
import {
  isRealtimeHealthy,
  isRealtimeRecovering,
  onDataChanged,
  startRealtime,
} from "./realtime";
import { REALTIME_SCOPES } from "./realtimeScopes";
import type {
  ActivityLogRecord,
  AlertRuleRecord,
  Department,
  Milestone,
  NotificationItem,
  NotificationTemplateRecord,
  OrganizationRecord,
  PermissionRecord,
  Project,
  RoleRecord,
  Task,
  User,
  WorkspaceBootstrap,
} from "./types";

const REALTIME_DEBOUNCE_MS = 250;
const FOCUS_DEBOUNCE_MS = 1000;
const POLL_INTERVAL_MS = 60_000;
const REALTIME_WATCHDOG_CHECK_MS = 5_000;
const REALTIME_WATCHDOG_MS = 45_000;

type AppData = {
  organizations: OrganizationRecord[];
  departments: Department[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  subtasks: Task[];
  users: User[];
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  notifications: NotificationItem[];
  notificationTemplates: NotificationTemplateRecord[];
  alertRules: AlertRuleRecord[];
  activityLogs: ActivityLogRecord[];
};

type AppDataContextValue = {
  data: AppData;
  pages: null;
  loading: boolean;
  initialized: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const emptyData: AppData = {
  organizations: [],
  departments: [],
  projects: [],
  milestones: [],
  tasks: [],
  subtasks: [],
  users: [],
  roles: [],
  permissions: [],
  notifications: [],
  notificationTemplates: [],
  alertRules: [],
  activityLogs: [],
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function mapBootstrapProjects(bootstrap: WorkspaceBootstrap): Project[] {
  return bootstrap.projects.map((project) => ({
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
    description: null,
    category: "",
    status: project.status,
    priority: project.priority,
    plannedStartDate: project.createdDate,
    plannedEndDate: project.createdDate,
    actualStartDate: null,
    actualEndDate: null,
    plannedBudget: 0,
    actualCost: 0,
    budgetVariance: 0,
    progressPercentage: project.progressPercentage,
    aiHealthScore: 0,
    aiDelayRiskScore: project.aiDelayRiskScore,
    aiBudgetRiskScore: 0,
    aiInsightsSummary: null,
    departmentId: project.departmentId,
    departmentName: null,
    departmentIds: project.departmentIds,
    departments: project.departmentIds.map((departmentId) => ({
      departmentId,
      departmentName: null,
      isPrimary: departmentId === project.departmentId,
    })),
    projectManagerId: "",
    projectManagerName: null,
    totalTasks: project.totalTasks,
    completedTasks: 0,
    overdueTasks: 0,
    totalMilestones: 0,
    completedMilestones: 0,
    createdDate: project.createdDate,
    isNewForCurrentUser: project.isNewForCurrentUser,
  }));
}

function mapReferenceData(
  bootstrap: WorkspaceBootstrap | null,
  organizations: OrganizationRecord[],
  departments: Department[],
  users: User[],
): AppData {
  const permissions: PermissionRecord[] = (bootstrap?.permissions ?? []).map((code) => ({
    id: code,
    code,
    name: code,
    description: "",
    module: code.split("_")[0] ?? "",
    isGlobal: false,
  }));

  const currentUser = bootstrap?.currentUser;
  const currentUserMapped = currentUser
    ? {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        fullName: currentUser.fullName,
        email: currentUser.email,
        profilePictureUrl: currentUser.profilePictureUrl,
        jobTitle: currentUser.jobTitle,
        organizationId: currentUser.organizationId ?? null,
        department: currentUser.department ?? null,
        departmentId: currentUser.departmentId ?? null,
        departments: [],
        profileId: null,
        bio: null,
        availabilityStatus: "Available",
        availabilityPercentage: currentUser.availabilityPercentage,
        aiWorkloadScore: currentUser.aiWorkloadScore,
        aiBurnoutRiskScore: currentUser.aiBurnoutRiskScore,
        aiPerformanceScore: currentUser.aiPerformanceScore,
        activeTaskCount: currentUser.activeTaskCount,
        isActive: currentUser.isActive,
        lastLoginDate: null,
        roles: currentUser.roles,
        roleKeys: currentUser.roleKeys,
        skills: [],
        skillDetails: [],
      } satisfies User
    : null;

  const usersWithCurrentUser = currentUserMapped && !users.some((user) => user.id === currentUserMapped.id)
    ? [currentUserMapped, ...users]
    : users;

  return {
    ...emptyData,
    organizations,
    departments,
    projects: bootstrap ? mapBootstrapProjects(bootstrap) : [],
    users: usersWithCurrentUser,
    permissions,
  };
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const { auth, logout } = useAuth();
  const [bootstrap, setBootstrap] = useState<WorkspaceBootstrap | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);
  const referenceLoadRef = useRef<string | null>(null);
  // Tracks whether the provider itself is still mounted, as opposed to whether the
  // current effect run is still current. Reference data is loaded once per signed-in
  // user, so it must survive effect re-runs: see loadInitialReferenceData below.
  const providerMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!auth) {
      setBootstrap(null);
      setOrganizations([]);
      setDepartments([]);
      setUsers([]);
      setInitialized(false);
      setError("");
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      // Keep the navigation/auth bootstrap small. Detail/reference collections are loaded
      // independently so a single page never has to hydrate the whole workspace first.
      const response = await api.getWorkspaceBootstrap(auth.token);
      setBootstrap(response);
      setInitialized(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        logout();
        return;
      }
      setError(cause instanceof Error ? cause.message : "Failed to load workspace bootstrap.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [auth, logout]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const refreshReferenceData = useCallback(async (scope?: string) => {
    if (!auth) return;

    try {
      // Reference collections are refreshed one at a time. A realtime burst should never
      // fan out into three independent queries per event.
      if (!scope || scope === "organizations") {
        setOrganizations(await api.getOrganizations(auth.token));
      }
      if (!scope || scope === "departments") {
        setDepartments(await api.getDepartments(auth.token));
      }
      if (!scope || scope === "users") {
        setUsers(await api.getUsers(auth.token));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reference data could not be loaded.");
    }
  }, [auth]);

  useEffect(() => {
    providerMountedRef.current = true;
    return () => {
      providerMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!auth) {
      referenceLoadRef.current = null;
      return;
    }

    if (referenceLoadRef.current === auth.userId) return;
    referenceLoadRef.current = auth.userId;

    let userLoadTimer: number | undefined;

    // Deliberately not aborted on effect cleanup.
    //
    // This loads once per signed-in user and is guarded by referenceLoadRef, so
    // cancelling it when the effect re-runs loses data permanently: any re-render
    // that changes the auth identity (a token refresh, a profile update) tears this
    // run down mid-sequence, while the ref guard then blocks the replacement run.
    // That left departments and users permanently empty for every user, which is
    // why the milestone and task department selectors offered nothing but "None".
    //
    // Only a genuine unmount should stop it, hence providerMountedRef.
    const loadInitialReferenceData = async () => {
      try {
        // Bootstrap renders the app first. Organizations and departments are needed by the
        // shared filters, while the full user directory is the largest reference collection.
        // Keep it out of the initial request burst so a login does not compete with the first
        // page data and SignalR negotiate.
        await refreshReferenceData(REALTIME_SCOPES.organizations);
        await refreshReferenceData(REALTIME_SCOPES.departments);

        userLoadTimer = window.setTimeout(() => {
          if (providerMountedRef.current) {
            void refreshReferenceData(REALTIME_SCOPES.users);
          }
        }, 750);
      } catch {
        // refreshReferenceData records a user-visible error. Keep bootstrap usable.
      }
    };

    void loadInitialReferenceData();

    return () => {
      if (userLoadTimer !== undefined) window.clearTimeout(userLoadTimer);
    };
  }, [auth, refreshReferenceData]);

  useEffect(() => {
    if (!auth) return;

    let disposed = false;
    let debounceTimer: number | undefined;

    const scheduleRefresh = (delay: number) => {
      if (disposed) return;
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = undefined;
        if (!disposed) void refresh();
      }, delay);
    };

    const stopListening = onDataChanged((notification) => {
      if (notification.scope === REALTIME_SCOPES.projects || notification.scope === REALTIME_SCOPES.roles) {
        scheduleRefresh(REALTIME_DEBOUNCE_MS);
        return;
      }

      if (
        notification.scope === REALTIME_SCOPES.organizations ||
        notification.scope === REALTIME_SCOPES.departments ||
        notification.scope === REALTIME_SCOPES.users
      ) {
        void refreshReferenceData(notification.scope);
      }
    });

    // Pass the live token: localStorage is only written by AuthProvider's effect, which React
    // runs *after* this one, so on a fresh login it still holds the previous (now revoked)
    // session's token. Without this the first negotiate 401s and the hub stays disconnected
    // until the retry backoff lands.
    void startRealtime(auth.token);

    const onFocus = () => scheduleRefresh(FOCUS_DEBOUNCE_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleRefresh(FOCUS_DEBOUNCE_MS);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      stopListening();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [auth, refresh]);

  useEffect(() => {
    if (!auth) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isRealtimeHealthy()) return;
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [auth, refresh]);

  useEffect(() => {
    if (!auth) return;

    let unhealthySince: number | null = null;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        unhealthySince = null;
        return;
      }

      if (isRealtimeHealthy()) {
        unhealthySince = null;
        return;
      }

      if (isRealtimeRecovering()) return;

      const now = Date.now();
      if (unhealthySince === null) {
        unhealthySince = now;
        return;
      }

      if (now - unhealthySince >= REALTIME_WATCHDOG_MS) {
        unhealthySince = null;
        void startRealtime(auth.token);
      }
    }, REALTIME_WATCHDOG_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [auth]);

  const data = useMemo(
    () => mapReferenceData(bootstrap, organizations, departments, users),
    [bootstrap, organizations, departments, users],
  );

  const value = useMemo(
    () => ({
      data,
      pages: null,
      loading,
      initialized,
      error,
      refresh,
    }),
    [data, loading, initialized, error, refresh],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }

  return context;
}
