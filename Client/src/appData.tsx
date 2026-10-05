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
import { GLOBAL_SCOPES } from "./realtimeScopes";
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

function mapWorkspaceSnapshot(snapshot: Awaited<ReturnType<typeof api.getWorkspaceSnapshot>>): AppData {
  const permissions = snapshot.permissions.map((code) => ({
    id: code,
    code,
    name: code,
    description: "",
    module: code.split("_")[0] ?? "",
    isGlobal: false,
  }));

  const organizations = snapshot.organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    taxId: organization.taxId ?? "",
    address: organization.address ?? "",
    contactEmail: organization.contactEmail ?? "",
    contactPhone: organization.contactPhone ?? "",
    foundedDate: organization.foundedDate ?? "",
    director: null,
    departments: [],
    departmentCount: organization.departmentCount,
  }));

  const departments = snapshot.departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    organizationId: department.organizationId,
    parentDepartmentId: department.parentDepartmentId,
    departmentHeadUserId: department.departmentHeadUserId,
    maxCapacity: department.maxCapacity,
    capacityUtilization: department.capacityUtilization,
  }));

  const users = snapshot.users.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    email: user.email,
    profilePictureUrl: user.profilePictureUrl,
    jobTitle: user.jobTitle,
    organizationId: user.organizationId ?? null,
    department: user.department ?? null,
    departmentId: user.departmentId ?? null,
    departments: [],
    profileId: null,
    bio: null,
    availabilityStatus: "Available",
    availabilityPercentage: user.availabilityPercentage,
    aiWorkloadScore: user.aiWorkloadScore,
    aiBurnoutRiskScore: user.aiBurnoutRiskScore,
    aiPerformanceScore: user.aiPerformanceScore,
    activeTaskCount: user.activeTaskCount,
    isActive: user.isActive,
    lastLoginDate: null,
    roles: user.roles,
    roleKeys: user.roleKeys,
    skills: [],
    skillDetails: [],
  }));

  const projects = snapshot.projects.map((project) => ({
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

  const currentUser = snapshot.currentUser;
  const usersWithCurrentUser = users.some((user) => user.id === currentUser.id)
    ? users
    : [currentUser, ...users];

  return {
    ...emptyData,
    organizations,
    departments,
    projects,
    users: usersWithCurrentUser,
    permissions,
  };
}

export function AppDataProvider({ children }: PropsWithChildren) {
  const { auth, logout } = useAuth();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof api.getWorkspaceSnapshot>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!auth) {
      setSnapshot(null);
      setInitialized(false);
      setError("");
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await api.getWorkspaceSnapshot(auth.token);
      setSnapshot(response);
      setInitialized(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        logout();
        return;
      }

      setError(cause instanceof Error ? cause.message : "Failed to load workspace data.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [auth, logout]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      if (GLOBAL_SCOPES.includes(notification.scope)) {
        scheduleRefresh(REALTIME_DEBOUNCE_MS);
      }
    });

    void startRealtime();

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
        void startRealtime();
      }
    }, REALTIME_WATCHDOG_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [auth]);

  const data = useMemo(
    () => (snapshot ? mapWorkspaceSnapshot(snapshot) : emptyData),
    [snapshot],
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
