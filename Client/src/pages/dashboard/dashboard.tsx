import { useCallback, useEffect, useState, useMemo, type FormEvent } from "react";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { NotificationItem, Task, User, Project, Milestone, ActivityLogRecord } from "../../types";
import { NotificationList } from "../shared/NotificationList";
import { WorkloadBars } from "../shared/WorkloadBars";
import type { WorkloadItem } from "../shared/WorkloadBars";
import { ActiveObjectives } from "./ActiveObjectives";
import { PageSkeleton, useNavHeader, useToast, ModalOverlay } from "../shared";
import { PERMISSION_GROUPS, usePermission } from "../shared";
import { useUserOrganization } from "../shared/useUserOrganization";
import { NewProjectPage } from "../NewProject/NewProjectPage";
import TaskStats from "../shared/dash/TaskStats";
import TaskPerformanceTable, { type TaskPerformanceQuery } from "../shared/dash/TaskPerformanceTable";
import { TaskEditModal } from "../shared/modals/TaskEditModal";
import { HighRiskInterventions } from "../shared/dash/HighRiskInterventions";
import DashboardStats from "./dashboardStats";
import { ProjectOverview } from "../shared/dash/ProjectOverviewChart";
import { Activity } from "../shared/dash/Activity";
import Timer from "../shared/dash/Timer";
import { ProjectFormModal, type ProjectFormState } from "../projects/components/ProjectFormModal";

// Temporarily hidden dashboard widgets. Kept behind flags (not deleted) so
// they can be restored by flipping these back to true.
//   SHOW_MY_TASKS          - "My Tasks" (Active Objectives) card
//   SHOW_WORKLOAD_DISTRIBUTION - "Workload Distribution" card
//   SHOW_TIME_TRACKER      - "Time Tracker" card (Notifications render in its place)
//   SHOW_ACTIVITY_FILTER   - "All Tasks / My Tasks / Team Tasks" dropdown on the Activity card
const SHOW_MY_TASKS = false;
const SHOW_WORKLOAD_DISTRIBUTION = false;
const SHOW_TIME_TRACKER = false;
const SHOW_ACTIVITY_FILTER = false;

const emptyProjectForm = (): ProjectFormState => ({
  projectCode: "",
  name: "",
  description: "",
  category: "Monitoring",
  plannedStartDate: new Date().toISOString().split("T")[0],
  plannedEndDate: "",
  plannedBudget: 0,
  organizationId: "",
  departmentId: "",
  departmentIds: [],
  projectManagerId: "",
  priority: "Medium",
});

export function DashboardPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const { setNavHeader } = useNavHeader();
  const { data: appData, refresh: refreshAppData } = useAppData();
  const { addToast } = useToast();
  const canManageProjects = perm.has(PERMISSION_GROUPS.project.manage);
  const canViewTasks = perm.has(PERMISSION_GROUPS.task.view);
  const [dashboard, setDashboard] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [unread, setUnread] = useState<NotificationItem[]>([]);
  const { departments, organizations, users } = appData;
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
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


  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm());
  const [newProjectWizardOpen, setNewProjectWizardOpen] = useState(false);
  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);

  useEffect(() => {
    setNavHeader({
      title: "Dashboard",
      description: "Overview of projects, tasks, and key metrics",
      action: canManageProjects ? {
        label: "New Project",
        onClick: () => setNewProjectWizardOpen(true),
        icon: "add_circle",
      } : undefined,
    });
  }, [setNavHeader, canManageProjects, shouldFilterByOrg, userOrganizationId]);

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await api.createProject(auth.token, projectForm);
      setShowCreateModal(false);
      setProjectForm(emptyProjectForm());
      addToast("Project created");
      await refreshAppData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create project", "error");
    }
  };

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError("");

    Promise.allSettled([
      api.getDashboard(auth.token),
      api.getMyTasks(auth.token),
      api.getNotifications(auth.token, true),
      canViewTasks ? api.getOverdueTasks(auth.token) : Promise.resolve([]),
      canViewTasks ? api.getEscalatedTasks(auth.token) : Promise.resolve([]),
      api.getProjects(auth.token),
      api.getTeamActivityLogs(auth.token, 200),
    ])
      .then(([dashboardResult, tasksResult, notificationsResult, overdueResult, escalatedResult, projectsResult, activityResult]) => {
        if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
        if (tasksResult.status === "fulfilled") setMyTasks(tasksResult.value);
        if (notificationsResult.status === "fulfilled") {
          setUnread(Array.isArray(notificationsResult.value) ? notificationsResult.value : []);
        }
        if (overdueResult.status === "fulfilled") setOverdue(overdueResult.value as Task[]);
        if (escalatedResult.status === "fulfilled") setEscalatedTasks(escalatedResult.value as Task[]);
        if (projectsResult.status === "fulfilled") setProjects(projectsResult.value);
        if (activityResult.status === "fulfilled") setActivityLogs(Array.isArray(activityResult.value) ? activityResult.value : []);
        if (dashboardResult.status === "rejected") {
          setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Dashboard unavailable");
        }
      })
      .finally(() => setLoading(false));
  }, [auth, canViewTasks]);

  const canEditTasks = perm.hasAny(
    PERMISSION_GROUPS.task.edit,
    PERMISSION_GROUPS.task.create,
    PERMISSION_GROUPS.task.assign,
  );

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
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to load task performance data", "error");
      setTaskPerformanceTasks([]);
      setTaskPerformanceTotalCount(0);
      setTaskPerformanceTotalPages(1);
    } finally {
      setTaskPerformanceLoading(false);
    }
  }, [auth, addToast]);

  const openTaskDetails = async (task: Task) => {
    if (!auth) return;
    try {
      const freshTask = await api.getTask(auth.token, task.id);
      setSelectedTask(freshTask);
    } catch {
      setSelectedTask(task);
    }
  };

  const openTaskEditor = async (task: Task) => {
    if (!auth) return;
    setSelectedTask(task);
  };


  const refreshTaskLists = async () => {
    if (!auth) return;
    const [tasks, escalated] = await Promise.all([
      api.getMyTasks(auth.token),
      canEditTasks ? api.getEscalatedTasks(auth.token) : Promise.resolve([]),
    ]);
    setMyTasks(tasks);
    setEscalatedTasks(escalated);
    if (lastTaskPerformanceQuery) {
      await loadTaskPerformance(lastTaskPerformanceQuery);
    }
    if (selectedTask) {
      setSelectedTask(await api.getTask(auth.token, selectedTask.id));
    }
  };

  const departmentWorkload: WorkloadItem[] = useMemo(() => {
    return departments.map((dept) => {
      const deptUsers = users.filter((u) => u.departmentId === dept.id);
      const deptTasks = myTasks.filter((t) => {
        const assignee = users.find((u) => u.id === t.assignedToUserId);
        return assignee?.departmentId === dept.id;
      });

      const totalTasks = deptTasks.length;
      const completedTasks = deptTasks.filter((t) => t.status === "Completed" || t.progressPercentage === 100).length;
      const activeTasks = totalTasks - completedTasks;

      const memberCount = deptUsers.length;
      const avgWorkload = memberCount > 0
        ? deptUsers.reduce((sum, u) => sum + u.aiWorkloadScore, 0) / memberCount
        : 0;

      const workloadScore = memberCount > 0
        ? (totalTasks / memberCount) * 10 + avgWorkload
        : totalTasks * 10;

      return {
        id: dept.id,
        name: dept.name,
        score: Math.min(workloadScore, 150),
        activeTasks,
        memberCount,
        workloadScore: Math.round(workloadScore),
      };
    });
  }, [departments, users, myTasks]);

  // Real activity: bucket the team's activity log (task created/updated/commented,
  // project and milestone events, ...) by calendar day over the last 7 days. Labels carry
  // the actual date, so a spike always means something happened that day - unlike the old
  // weekday buckets, which lumped every event ever created on e.g. a Saturday into one bar.
  const activityData = useMemo(() => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      days.push({ key, label: `${dayNames[d.getDay()]} ${d.getDate()}`, value: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));

    const sourceLogs =
      selectedActivityFilter === "My Tasks" && auth
        ? activityLogs.filter((log) => log.userId === auth.userId)
        : activityLogs;

    sourceLogs.forEach((log) => {
      const at = new Date(log.timestamp);
      if (Number.isNaN(at.getTime())) return;
      const bucket = byKey.get(`${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`);
      if (bucket) bucket.value++;
    });

    return days.map(({ label, value }) => ({ day: label, value }));
  }, [activityLogs, selectedActivityFilter, auth]);

  if (loading) return <PageSkeleton />;
  if (error) return <div className="mx-4 my-2"><div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">{error}</div></div>;

  return (
    <div>

      <DashboardStats projects={projects} />
      <section>

        {/* Dashboard Overview Section */}
        <section className="my-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* High Risk Interventions  */}
            <HighRiskInterventions tasks={escalatedTasks} />

            {/* Project Overview*/}
            <ProjectOverview
              newProjects={(dashboard?.totalProjects ?? 0) - (dashboard?.activeProjects ?? 0) - ((dashboard?.projects as Project[])?.filter(p => p.status === 'Completed').length ?? 0)}
              pendingProjects={dashboard?.activeProjects ?? 0}
              doneProjects={(dashboard?.projects as Project[])?.filter(p => p.status === 'Completed').length ?? 0}
            />

            {/* Activity Chart - the task filter dropdown is hidden via SHOW_ACTIVITY_FILTER */}
            <Activity
              data={activityData}
              title="Activity"
              filterOptions={SHOW_ACTIVITY_FILTER ? ["All Tasks", "My Tasks", "Team Tasks"] : []}
              selectedFilter={selectedActivityFilter}
              onFilterChange={setSelectedActivityFilter}
            />

            {/* Timer (hidden) - Notifications are shown in its place */}
            {SHOW_TIME_TRACKER ? (
              <Timer tasks={myTasks} token={auth?.token ?? ''} />
            ) : (
              <NotificationList items={unread} title="Notifications" />
            )}
          </div>
        </section>


        {/* Active Objectives , Workload Distribution, Notifications
            "My Tasks" and "Workload Distribution" are currently hidden via the
            SHOW_MY_TASKS / SHOW_WORKLOAD_DISTRIBUTION flags above. */}
        {(SHOW_MY_TASKS || SHOW_WORKLOAD_DISTRIBUTION) && (
        <section className="flex gap-4">
          {/* left - Active Objectives */}
          {SHOW_MY_TASKS && (
          <div className="flex-1 py-4">
            <ActiveObjectives
              objectives={myTasks.slice(0, 6).map((task) => {
                const assignedUser = task.assignedToUserId ? users.find((user) => user.id === task.assignedToUserId) : null;

                return {
                  id: task.id,
                  category: task.projectName || "General",
                  title: task.title,
                  progressPercentage: task.progressPercentage,
                  assignees: assignedUser
                    ? [assignedUser]
                    : task.assignedToUserName
                      ? [{ fullName: task.assignedToUserName }]
                      : [],
                };
              })}
              title="My Tasks"
              subtitle={`${myTasks.length} tasks`}
            />
          </div>
          )}

          {/* middle - Workload Distribution */}
          {SHOW_WORKLOAD_DISTRIBUTION && (
          <div className="flex-1 py-4">
            <WorkloadBars
              items={departmentWorkload}
              title="Workload Distribution"
              isDepartment={true}
            />
          </div>
          )}

          {/* right - Notifications */}
          <div className="flex-1 py-4">
            <NotificationList items={unread} title="Notifications" />
          </div>
        </section>
        )}

        <div className="py-4">
          <TaskStats tasks={myTasks} />
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

      </section>

      {selectedTask && (
        <TaskEditModal
          task={selectedTask}
          users={users}
          project={projects.find(p => p.id === selectedTask.projectId) ?? null}
          milestone={milestones.find(m => m.id === selectedTask.milestoneId) ?? null}
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
              setMyTasks(current => current.map(t => t.id === freshTask.id ? freshTask : t));
            } catch (e) {
              addToast(e instanceof Error ? e.message : "Failed to update task", "error");
              throw e;
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
            setMyTasks(current => current.filter(t => t.id !== taskId));
            setSelectedTask(null);
            await refreshTaskLists();
          }}
          onEscalate={async () => {
            if (!auth) return;
            await api.escalateTask(auth.token, selectedTask.id);
            addToast("Task escalated.");
            await refreshTaskLists();
          }}
          onStartTimer={async (taskId, description) => {
            if (!auth) return;
            await api.startTaskTimer(auth.token, taskId, description);
          }}
          onRefresh={refreshTaskLists}
        />
      )}

      <ProjectFormModal
        open={showCreateModal}
        title="Create Project"
        submitLabel="Create"
        form={projectForm}
        setForm={setProjectForm}
        departments={perm.isSuperAdmin ? departments : departments.filter((d) => !shouldFilterByOrg || d.organizationId === userOrganizationId)}
        organizations={organizations}
        showOrganizationFilter={perm.isSuperAdmin}
        users={users}
        onSubmit={handleCreateProject}
        onClose={() => {
          setShowCreateModal(false);
          setProjectForm(emptyProjectForm());
        }}
      />

      {newProjectWizardOpen && (
        <ModalOverlay onClose={() => setNewProjectWizardOpen(false)} widthClassName="max-w-4xl">
          <NewProjectPage onClose={() => setNewProjectWizardOpen(false)} />
        </ModalOverlay>
      )}

    </div>
  );
}
