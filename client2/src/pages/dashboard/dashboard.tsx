import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { resolveNotificationTarget } from "../../lib/notificationTarget";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import { onDataChanged } from "../../realtime";
import { REALTIME_SCOPES } from "../../realtimeScopes";
import type { ActivityLogRecord, NotificationItem, Project, ProjectDashboardData, Task, TaskDashboardStats } from "../../types";
import { NotificationList } from "../shared/NotificationList";
import { PageSkeleton, useNavHeader, useToast } from "../shared";
import { PERMISSION_GROUPS, usePermission } from "../shared";
import { NewProjectPage } from "../NewProject/NewProjectPage";
import TaskStats from "../shared/dash/TaskStats";
import TaskPerformanceTable, { type TaskPerformanceQuery } from "../shared/dash/TaskPerformanceTable";
import { TaskEditModal } from "../shared/modals/TaskEditModal";
import { HighRiskInterventions } from "../shared/dash/HighRiskInterventions";
import DashboardStats from "./dashboardStats";
import { ProjectOverview } from "../shared/dash/ProjectOverviewChart";
import { Activity } from "../shared/dash/Activity";
import { ModalOverlay } from "../shared";

export function DashboardPage() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const perm = usePermission();
  const { setNavHeader } = useNavHeader();
  const { data: appData } = useAppData();
  const { addToast } = useToast();
  const canManageProjects = perm.has(PERMISSION_GROUPS.project.manage);
  const canViewTasks = perm.has(PERMISSION_GROUPS.task.view);
  const canEditTasks = perm.hasAny(
    PERMISSION_GROUPS.task.edit,
    PERMISSION_GROUPS.task.create,
    PERMISSION_GROUPS.task.assign,
  );

  const { departments, users } = appData;
  const [dashboard, setDashboard] = useState<ProjectDashboardData | null>(null);
  const [taskDashboard, setTaskDashboard] = useState<TaskDashboardStats | null>(null);
  const [unread, setUnread] = useState<NotificationItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [escalatedTasks, setEscalatedTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [taskPerformanceTasks, setTaskPerformanceTasks] = useState<Task[]>([]);
  const [taskPerformancePage, setTaskPerformancePage] = useState(1);
  const [taskPerformancePageSize, setTaskPerformancePageSize] = useState(10);
  const [taskPerformanceTotalCount, setTaskPerformanceTotalCount] = useState(0);
  const [taskPerformanceTotalPages, setTaskPerformanceTotalPages] = useState(1);
  const [taskPerformanceLoading, setTaskPerformanceLoading] = useState(false);
  const [lastTaskPerformanceQuery, setLastTaskPerformanceQuery] = useState<TaskPerformanceQuery | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedActivityFilter, setSelectedActivityFilter] = useState("All Tasks");
  const [newProjectWizardOpen, setNewProjectWizardOpen] = useState(false);

  useEffect(() => {
    setNavHeader({
      title: "Dashboard",
      description: "Overview of projects, tasks, and key metrics",
      action: canManageProjects
        ? {
            label: "New Project",
            onClick: () => setNewProjectWizardOpen(true),
            icon: "add_circle",
          }
        : undefined,
    });
  }, [setNavHeader, canManageProjects]);

  const loadDashboard = useCallback(async () => {
    if (!auth) return;
    try {
      setDashboard(await api.getDashboard(auth.token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard unavailable");
    }
  }, [auth]);

  const loadProjects = useCallback(async () => {
    if (!auth) return;
    try {
      setProjects(await api.getProjects(auth.token));
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load projects", "error");
    }
  }, [auth, addToast]);

  const loadTaskStats = useCallback(async () => {
    if (!auth) return;
    try {
      setTaskDashboard(await api.getTaskDashboardSummary(auth.token));
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load task dashboard stats", "error");
    }
  }, [auth, addToast]);

  const loadNotifications = useCallback(async () => {
    if (!auth) return;
    try {
      const items = await api.getNotifications(auth.token, true);
      setUnread(Array.isArray(items) ? items : []);
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load notifications", "error");
    }
  }, [auth, addToast]);

  const loadEscalations = useCallback(async () => {
    if (!auth || !canViewTasks) return;
    try {
      setEscalatedTasks(await api.getEscalatedTasks(auth.token));
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load escalations", "error");
    }
  }, [auth, canViewTasks, addToast]);

  const loadActivity = useCallback(async () => {
    if (!auth) return;
    try {
      // 200 rows so a busy workspace still covers the full 7-day window.
      const items = await api.getTeamActivityLogs(auth.token, 200);
      setActivityLogs(Array.isArray(items) ? items : []);
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load activity", "error");
    }
  }, [auth, addToast]);

  useEffect(() => {
    if (!auth) return;
    let disposed = false;

    const loadInitial = async () => {
      setLoading(true);
      setError("");

      const criticalLoads = [
        ["dashboard", loadDashboard],
        ["projects", loadProjects],
        ["tasks", loadTaskStats],
      ] as const;

      for (const [name, load] of criticalLoads) {
        try {
          await load();
        } catch (cause) {
          if (name === "dashboard") {
            setError(cause instanceof Error ? cause.message : "Dashboard unavailable");
          }
        }
        if (disposed) return;
      }

      setLoading(false);

      await Promise.allSettled([loadNotifications(), loadEscalations(), loadActivity()]);
    };

    void loadInitial();
    return () => { disposed = true; };
  }, [auth, loadDashboard, loadProjects, loadTaskStats, loadNotifications, loadEscalations, loadActivity]);

  const loadTaskPerformance = useCallback(async (query: TaskPerformanceQuery) => {
    if (!auth) return;

    setLastTaskPerformanceQuery(query);
    setTaskPerformanceLoading(true);
    try {
      const response = await api.getTasks(auth.token, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        projectId: query.projectId,
        departmentId: query.departmentId,
        statuses: query.statuses?.join(","),
        priorities: query.priorities?.join(","),
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
      });
      setTaskPerformanceTasks(response.items);
      setTaskPerformancePage(response.page);
      setTaskPerformancePageSize(response.pageSize);
      setTaskPerformanceTotalCount(response.totalCount);
      setTaskPerformanceTotalPages(response.totalPages);
    } catch (cause) {
      addToast(cause instanceof Error ? cause.message : "Failed to load task performance data", "error");
      setTaskPerformanceTasks([]);
      setTaskPerformanceTotalCount(0);
      setTaskPerformanceTotalPages(1);
    } finally {
      setTaskPerformanceLoading(false);
    }
  }, [auth, addToast]);

  useEffect(() => {
    if (!auth) return;
    let timer: number | undefined;

    const schedule = (work: () => void) => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(work, 250);
    };

    const stopListening = onDataChanged((notification) => {
      switch (notification.scope) {
        case REALTIME_SCOPES.projects:
          schedule(() => { void loadDashboard(); void loadProjects(); });
          break;
        case REALTIME_SCOPES.tasks:
        case REALTIME_SCOPES.milestones:
          schedule(() => {
            void loadTaskStats();
            void loadEscalations();
            if (lastTaskPerformanceQuery) void loadTaskPerformance(lastTaskPerformanceQuery);
          });
          break;
        case REALTIME_SCOPES.notifications:
          schedule(() => { void loadNotifications(); });
          break;
        default:
          break;
      }
    });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      stopListening();
    };
  // loadTaskPerformance is declared above so the realtime handler can reference it directly,
  // rather than capturing a binding that did not exist yet when the effect was created.
  }, [auth, loadDashboard, loadProjects, loadTaskStats, loadEscalations, loadNotifications, lastTaskPerformanceQuery, loadTaskPerformance]);

  const openTaskDetails = async (task: Task) => {
    if (!auth) return;
    try {
      setSelectedTask(await api.getTask(auth.token, task.id));
    } catch {
      setSelectedTask(task);
    }
  };

  const openTaskEditor = (task: Task) => {
    setSelectedTask(task);
  };

  const openTaskLocation = useCallback((task: Task) => {
    navigate(`/projects/${task.projectId}/tasks?taskId=${task.id}`);
  }, [navigate]);

  const refreshTaskLists = useCallback(async () => {
    if (!auth) return;
    await Promise.allSettled([loadTaskStats(), loadEscalations()]);
    if (lastTaskPerformanceQuery) await loadTaskPerformance(lastTaskPerformanceQuery);
    if (selectedTask) {
      try {
        setSelectedTask(await api.getTask(auth.token, selectedTask.id));
      } catch {
        // Keep the current modal state if the follow-up read fails.
      }
    }
  }, [auth, loadTaskStats, loadEscalations, lastTaskPerformanceQuery, loadTaskPerformance, selectedTask]);

  const openNotification = useCallback(async (item: NotificationItem) => {
    if (!auth) return;

    try {
      await api.markNotificationRead(auth.token, item.id);
      setUnread((current) => current.filter((notification) => notification.id !== item.id));
    } catch {
      // Navigation should still work even if acknowledgement fails.
    }

    const target = resolveNotificationTarget(item);
    if (target.kind === "none") return;

    if (target.kind === "task") {
      try {
        const task = await api.getTask(auth.token, target.taskId);
        navigate(`/projects/${task.projectId}/tasks?taskId=${task.id}`);
      } catch {
        addToast("The linked task could not be opened.", "error");
      }
      return;
    }

    navigate(target.path);
  }, [auth, navigate, addToast]);

  // Real activity: bucket the team's activity log (task created/updated/commented,
  // project and milestone events, ...) by calendar day over the last 7 days. Labels carry
  // the actual date, so a spike always means something happened that day - unlike plain
  // weekday buckets, which lump every event ever created on e.g. a Saturday into one bar.
  const activityData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days: {
      key: string;
      label: string;
      value: number;
      events: Map<string, number>;
    }[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({
        key,
        label: `${dayNames[d.getDay()]} ${d.getDate()}`,
        value: 0,
        events: new Map<string, number>(),
      });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));

    const sourceLogs =
      selectedActivityFilter === "My Tasks" && auth
        ? activityLogs.filter((log) => log.userId === auth.userId)
        : activityLogs;

    // Counted over the same logs and the same window as the chart, so a day's
    // detail can never report a different total than the line above it.
    sourceLogs.forEach((log) => {
      const at = new Date(log.timestamp);
      if (Number.isNaN(at.getTime())) return;
      const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
      const bucket = byKey.get(key);
      if (!bucket) return;

      bucket.value++;
      // Tallied per day, so hovering or clicking a point can say what happened
      // that day rather than only how many events there were.
      const label = (log.activityType || "Other").trim() || "Other";
      bucket.events.set(label, (bucket.events.get(label) ?? 0) + 1);
    });

    return {
      points: days.map(({ label, value, events }) => ({
        day: label,
        value,
        // Busiest types first; capped so the popup stays short.
        events: [...events.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      })),
    };
  }, [activityLogs, selectedActivityFilter, auth]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="mx-4 my-2"><div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">{error}</div></div>;

  return (
    <div>
      <DashboardStats projects={projects} dashboard={dashboard} />

      <section className="my-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <HighRiskInterventions tasks={escalatedTasks} onOpenTask={openTaskLocation} />

          <ProjectOverview
            newProjects={Math.max(0, (dashboard?.totalProjects ?? 0) - (dashboard?.activeProjects ?? 0) - (dashboard?.completedProjects ?? 0))}
            pendingProjects={dashboard?.activeProjects ?? 0}
            doneProjects={dashboard?.completedProjects ?? 0}
          />

          <Activity
            data={activityData.points}
            isFiltered={selectedActivityFilter === "My Tasks"}
            filterLabel={selectedActivityFilter === "My Tasks" ? "Your activity" : undefined}
            title="Activity"
            filterOptions={[]}
            selectedFilter={selectedActivityFilter}
            onFilterChange={setSelectedActivityFilter}
          />

          <NotificationList items={unread} title="Notifications" onOpen={openNotification} />
        </div>
      </section>

      <div className="py-4">
        <TaskStats stats={taskDashboard} />
      </div>

      <TaskPerformanceTable
        tasks={taskPerformanceTasks}
        projects={projects}
        departments={departments}
        totalCount={taskPerformanceTotalCount}
        totalPages={taskPerformanceTotalPages}
        page={taskPerformancePage}
        pageSize={taskPerformancePageSize}
        loading={taskPerformanceLoading}
        onQueryChange={loadTaskPerformance}
        onViewTask={openTaskDetails}
        onEditTask={openTaskEditor}
        canEdit={canEditTasks}
      />

      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          users={users}
          project={projects.find((project) => project.id === selectedTask.projectId) ?? null}
          milestone={null}
          mayEdit={canEditTasks}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (taskId, data) => {
            if (!auth) return;
            try {
              if (data.status !== selectedTask.status) {
                await api.updateTaskStatus(auth.token, taskId, data.status);
              }
              if (data.progress !== Math.round(selectedTask.progressPercentage || 0)) {
                await api.updateTaskProgress(auth.token, taskId, data.progress);
              }
              if (data.priority !== (selectedTask.priority || "Medium")) {
                await api.updateTask(auth.token, taskId, {
                  title: selectedTask.title,
                  description: selectedTask.description ?? "",
                  priority: data.priority,
                  startDate: selectedTask.startDate,
                  dueDate: selectedTask.dueDate,
                  estimatedHours: selectedTask.estimatedHours ?? 0,
                  milestoneId: selectedTask.milestoneId,
                });
              }
              const freshTask = await api.getTask(auth.token, taskId);
              setSelectedTask(freshTask);
            } catch (cause) {
              addToast(cause instanceof Error ? cause.message : "Failed to update task", "error");
              throw cause;
            }
          }}
          onAddComment={async (taskId, text) => {
            if (!auth) return;
            await api.addTaskComment(auth.token, taskId, text);
            await refreshTaskLists();
          }}
          onDelete={async (taskId) => {
            if (!auth) return;
            await api.deleteTask(auth.token, taskId);
            setSelectedTask(null);
            await refreshTaskLists();
          }}
          onEscalate={async () => {
            if (!auth) return;
            await api.escalateTask(auth.token, selectedTask.id);
            addToast("Task escalated.");
            await refreshTaskLists();
          }}
          onRefresh={refreshTaskLists}
        />
      )}

      {newProjectWizardOpen && (
        <ModalOverlay onClose={() => setNewProjectWizardOpen(false)} widthClassName="max-w-4xl">
          <NewProjectPage onClose={() => setNewProjectWizardOpen(false)} />
        </ModalOverlay>
      )}
    </div>
  );
}
