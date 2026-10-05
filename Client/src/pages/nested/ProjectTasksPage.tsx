import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import type { Milestone, Task } from "../../types";
import { formatDate } from "../../lib/formatters";
import {
  AnimatedBackground,
  GlassCard,
  LoadingPage,
  useNavHeader,
  PERMISSION_GROUPS,
  usePermission,
  useToast,
  getStatusColor,
  BgRenderer,
} from "../shared";
import { useUserOrganization } from "../shared/useUserOrganization";
import TaskSubtaskBoard, { allBoards } from "../shared/dash/TaskSubtaskBoard";
import { MilestoneDetailModal, MilestoneFormModal, TaskSubtaskDetailsModal, TaskFormModal, ConfirmDeleteModal, DependencyFormModal } from "../projectsK/components";
import { useProjectWorkspace } from "./nestedShared";
import { ProjectNotFound } from "./ProjectNotFound";
import { ProjectInfoCard } from "./ProjectInfoCard";
import { Icon } from "../../components/ui/Icon";

export function ProjectTasksPage() {
  const ws = useProjectWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const notificationTaskId = searchParams.get("taskId");
  const { data: appData } = useAppData();
  const { auth } = useAuth();
  const { addToast } = useToast();
  const perm = usePermission();
  const { userOrganizationId } = useUserOrganization(appData.users, appData.departments);
  const canManageMilestones = perm.isSuperAdmin || hasRoleKey(perm.roleKeys, RoleKey.Director);
  const canManageTasks = perm.has(PERMISSION_GROUPS.task.manage);
  const canManageProjects = perm.has(PERMISSION_GROUPS.project.manage);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskModal, setTaskModal] = useState<{ open: boolean; edit?: Task; milestoneId?: string }>({
    open: false,
  });
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [viewMilestone, setViewMilestone] = useState<Milestone | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; edit?: Milestone }>({
    open: false,
  });
  const [milestoneError, setMilestoneError] = useState("");
  const [depModalOpen, setDepModalOpen] = useState(false);

  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [visibleBoards, setVisibleBoards] = useState<Record<string, boolean>>({
    "Not Started": true,
    "In Progress": true,
    Completed: true,
    Delayed: true,
    "On Hold": true,
    Cancelled: true,
  });
  const boardSettingsRef = useRef<HTMLDivElement>(null);

  const { setNavHeader } = useNavHeader();
  useEffect(() => {
    if (!notificationTaskId || ws.loading) return;
    const task = ws.tasks.find((item) => item.id === notificationTaskId);
    if (!task) return;

    setViewTask(task);
    const next = new URLSearchParams(searchParams);
    next.delete("taskId");
    setSearchParams(next, { replace: true });
  }, [notificationTaskId, ws.loading, ws.tasks, searchParams, setSearchParams]);


  useEffect(() => {
    if (!ws.project) {
      setNavHeader({ title: "Tasks", description: "" });
      return;
    }
    const actions = [];
    if (canManageMilestones) {
      actions.push({
        label: "New milestone",
        onClick: () => { setMilestoneModal({ open: true }); setMilestoneError(""); },
        icon: "flag",
      });
    }
    if (canManageTasks) {
      actions.push({
        label: "New task",
        onClick: () => setTaskModal({ open: true }),
        icon: "add_task",
      });
    }
    actions.push({
      label: "Dependencies",
      onClick: () => setDepModalOpen(true),
      icon: "account_tree",
    });
    setNavHeader({
      title: `Tasks · ${ws.project.name}`,
      description: "Tasks grouped by milestone",
      actions,
    });
  }, [setNavHeader, ws.project, canManageTasks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boardSettingsRef.current && !boardSettingsRef.current.contains(event.target as Node)) {
        setShowBoardSettings(false);
      }
    };
    if (showBoardSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBoardSettings]);

  const groupedTasks = useMemo(() => {
    const map = new Map<string, Task[]>();
    ws.tasks.forEach((t) => {
      if (t.parentTaskId) return;
      const key = t.milestoneId ?? "__unassigned__";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    });
    return map;
  }, [ws.tasks]);

  const orderedMilestones = useMemo(() => {
    if (ws.dependencies.length === 0) return [...ws.milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const deps = ws.dependencies;
    const mils = ws.milestones;
    const milestoneSet = new Set(mils.map(m => m.id));

    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const m of mils) {
      adj.set(m.id, []);
      inDegree.set(m.id, 0);
    }
    for (const dep of deps) {
      const from = dep.prerequisiteMilestoneId;
      const to = dep.dependentMilestoneId;
      if (milestoneSet.has(from) && milestoneSet.has(to)) {
        adj.get(from)!.push(to);
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    }

    const roots = mils.filter(m => inDegree.get(m.id) === 0);
    const visited = new Set<string>();
    const orderedIds: string[] = [];

    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      orderedIds.push(id);
      for (const neighbor of adj.get(id) || []) {
        if (!visited.has(neighbor)) dfs(neighbor);
      }
    };

    for (const root of roots) dfs(root.id);
    for (const m of mils) if (!visited.has(m.id)) orderedIds.push(m.id);

    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    return [...mils].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [ws.milestones, ws.dependencies]);

  const selectedTask = ws.tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedMilestone = selectedTask
    ? ws.milestones.find((m) => m.id === selectedTask.milestoneId) ?? null
    : null;

  const handleTaskSubmit = async (form: Record<string, unknown>) => {
    if (!auth || !ws.project) return;
    const taskData = { ...form, projectId: ws.project.id };
    try {
      if (taskModal.edit) {
        await api.updateTask(auth.token, taskModal.edit.id, taskData);
        const assigneeIds = Array.isArray(form.assignedToUserIds)
          ? (form.assignedToUserIds as string[]).filter(Boolean)
          : [];
        if (assigneeIds.length) {
          await api.assignTaskMembers(auth.token, taskModal.edit.id, assigneeIds);
        }
        addToast("Task updated");
      } else {
        await api.createTask(auth.token, taskData);
        addToast("Task created");
      }
      setTaskModal({ open: false });
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to save task", "error");
    }
  };

  const handleAddDependency = async (payload: Record<string, unknown>) => {
    if (!auth || !ws.project) return;
    try {
      await api.createMilestoneDependency(auth.token, { ...payload, projectId: ws.project.id });
      addToast("Dependency created");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create dependency", "error");
      throw e;
    }
  };

  const handleUpdateDependency = async (id: string, payload: Record<string, unknown>) => {
    if (!auth) return;
    try {
      await api.updateMilestoneDependency(auth.token, id, payload);
      addToast("Dependency updated");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to update dependency", "error");
      throw e;
    }
  };

  const getProgressColor = (progress: number): string => {
    if (progress === 100) return "bg-emerald-500";
    if (progress >= 75) return "bg-amber-400";
    if (progress >= 50) return "bg-cyan-400";
    if (progress >= 25) return "bg-rose-400";
    return "bg-slate-300";
  };

  const handleMilestoneSubmit = async (form: Record<string, unknown>) => {
    if (!auth || !ws.project) return;
    setMilestoneError("");
    try {
      if (milestoneModal.edit) {
        await api.updateMilestone(auth.token, milestoneModal.edit.id, form);
        addToast("Milestone updated");
      } else {
        await api.createMilestone(auth.token, form);
        addToast("Milestone created");
      }
      setMilestoneModal({ open: false });
      await ws.refresh();
    } catch (e) {
      setMilestoneError(e instanceof Error ? e.message : "Failed to save milestone");
    }
  };

  const handleDeleteTask = async () => {
    if (!auth || !deleteTask) return;
    try {
      await api.deleteTask(auth.token, deleteTask.id);
      setDeleteTask(null);
      if (selectedTaskId === deleteTask.id) setSelectedTaskId("");
      addToast("Task deleted");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete task", "error");
    }
  };

  if (ws.loading) return <LoadingPage label="Loading project tasks..." />;
  if (!ws.project) {
    return <ProjectNotFound />;
  }

  const toggleBoard = (boardTitle: string) => {
    setVisibleBoards((prev) => ({
      ...prev,
      [boardTitle]: !prev[boardTitle],
    }));
  };

  const renderMilestoneBoard = (milestone: Milestone | null) => {
    const milestoneId = milestone?.id ?? "__unassigned__";
    const tasks = groupedTasks.get(milestoneId) ?? [];
    return (
      <TaskSubtaskBoard
        key={milestoneId}
        tasks={tasks}
        canEdit={canManageTasks}
        onViewTask={(t) => setViewTask(t)}
        onEditTask={(t) => setTaskModal({ open: true, edit: t })}
        visibleBoards={visibleBoards}
        users={ws.users}
        onRefresh={() => ws.refresh()}
      />
    );
  };

  return (
    <div className="mb-8">
      {/* <AnimatedBackground /> */}


      <div className="relative z-10 mb-5">
        <ProjectInfoCard
          project={ws.project}
          milestonesCount={ws.milestones.length}
          milestones={ws.milestones}
          dependencies={ws.dependencies}
          canManageProjects={canManageProjects}
          users={ws.users}
          onProjectUpdated={() => ws.refresh()}
        />
      </div>

      {/* Global Board Settings */}
      <div className="relative z-20 flex items-center justify-end mb-2">
        <div className="relative" ref={boardSettingsRef}>
          <button
            onClick={() => setShowBoardSettings(!showBoardSettings)}
            className={`p-2 rounded-xl transition-all duration-200 ${showBoardSettings
              ? "bg-cyan-50 text-cyan-600"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            title="Board Settings"
          >
            <Icon name="settings" size={20} />
          </button>

          {showBoardSettings && (
            <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-slate-100 p-3 z-50">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
                Visible Boards
              </h4>
              <div className="space-y-1">
                {allBoards.map((board) => (
                  <button
                    key={board.title}
                    onClick={() => toggleBoard(board.title)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${visibleBoards[board.title]
                      ? "bg-slate-50 hover:bg-slate-100"
                      : "opacity-50 hover:opacity-75 hover:bg-slate-50"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={board.headerText}>{board.icon}</span>
                      <span
                        className={`text-xs font-medium ${visibleBoards[board.title] ? "text-slate-700" : "text-slate-400"
                          }`}
                      >
                        {board.title}
                      </span>
                    </div>
                    <div
                      className={`w-8 h-4 rounded-full transition-colors duration-200 ${visibleBoards[board.title] ? "bg-cyan-500" : "bg-slate-200"
                        }`}
                    >
                      <div
                        className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${visibleBoards[board.title] ? "translate-x-4" : "translate-x-0.5"
                          }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 space-y-6">
        {orderedMilestones.map((milestone, idx) => {
          const tasks = groupedTasks.get(milestone.id) ?? [];
          const colors = getStatusColor(milestone.status);
          return (
            <section
              key={milestone.id}
              // className={`rounded-xl p-4  transition-shadow duration-200 hover:shadow-md ${idx % 2 === 0 ? "bg-blue-200" : "bg-slate-200"  }`}
              className={`rounded-xl p-4  transition-shadow duration-200 hover:shadow-md ${colors.bg}`}
              // className={`rounded-xl p-4 shadow-lg transition-shadow duration-200  `}
            >
              <div className="flex items-center gap-3 mb-3">
                {/* Main Icon  */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${milestone.isCritical ? "bg-red-100" : "bg-indigo-100"
                    }`}
                >
                  <Icon
                    name={milestone.status === "Completed" ? "check_circle" : "hi-flag"}
                    size={18}
                    className={milestone.isCritical ? "text-red-500" : "text-indigo-600"}
                  />
                </div>

                {/* Title and Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    
                    <h3 className="text-sm font-bold text-slate-800 truncate">
                      {milestone.name}
                    </h3>
                     {/* Status */}
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-xl font-semibold ${colors.bg} ${colors.text}`}>
                      {milestone.status}
                    </span>
                    {/* {milestone.isCritical && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white shadow-sm">
                        <span className="material-symbols-outlined text-[10px]">priority_high</span>
                       
                      </span>
                    )} */}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-700 flex-wrap">
                   

                    {milestone.dueDate && (
                      <span className="flex items-center gap-0.5">
                        <Icon name="calendar_today" size={18} />
                        Due {formatDate(milestone.dueDate)}
                      </span>
                    )}

                    <span className="flex items-center gap-0.5">
                      <Icon name="task_alt" size={10} />
                      {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                    </span>

                    
                  </div>
                </div>

                {/* Progress Bar  */}
                <div className="w-24 shrink-0">
                  <p className="text-[10px] text-right text-slate-700 mt-0.5">
                    {Math.round(milestone.progressPercentage || 0)}%
                  </p>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className={`${colors.dot} h-1.5 rounded-full transition-all duration-500`}
                      style={{ width: `${milestone.progressPercentage || 0}%` }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Add Task Button */}
                    {canManageTasks && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTaskModal({ open: true, milestoneId: milestone.id });
                        }}
                        className="inline-flex items-center gap-1 cursor-pointer rounded-full text-[10px] font-medium
                     text-indigo-700 bg-indigo-100 hover:bg-indigo-200 
                     border border-indigo-200
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1
                     transition-all duration-200"
                        title="Add task to this milestone"
                        aria-label="Add task to this milestone"
                      >
                        <Icon name="add" size={15} />

                      </button>
                    )}


                  {/* View Button  */}
                  <button
                    title="View milestone"
                    className="p-1.5 rounded-lg text-slate-400 bg-blue-50 cursor-pointer hover:text-cyan-500 hover:bg-cyan-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setViewMilestone(milestone); }}
                  >
                    <Icon name="view" size={16} />
                  </button>

                  {canManageTasks && (
                    // Edit Button 
                    <button
                      title="Edit milestone"
                      className="p-1.5 rounded-lg text-slate-400 bg-amber-50 cursor-pointer hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setMilestoneModal({ open: true, edit: milestone }); }}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                  )}
                </div>
              </div>
              {renderMilestoneBoard(milestone)}
            </section>
          );
        })}

        {groupedTasks.get("__unassigned__")?.length ? (
          <section>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon name="hi-cube" size={18} className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-800">Unassigned</h3>
                <p className="text-[10px] text-slate-500">
                  Tasks without a milestone · {groupedTasks.get("__unassigned__")!.length}
                </p>
              </div>
            </div>
            {renderMilestoneBoard(null)}
          </section>
        ) : null}

        {ws.tasks.length === 0 && (
          <GlassCard className="p-8">
            <div className="text-center text-slate-400">
              <Icon name="task_alt" size={32} className="mb-3 block" />
              <p className="text-sm font-medium text-slate-600">No tasks yet</p>
              <p className="text-xs mt-1">
                {canManageTasks
                  ? "Click 'New task' above to create the first one."
                  : "Tasks for this project will appear here."}
              </p>
            </div>
          </GlassCard>
        )}
      </div>

      <TaskSubtaskDetailsModal
        task={viewTask}
        project={ws.project}
        milestone={
          viewTask
            ? ws.milestones.find((m) => m.id === viewTask.milestoneId) ?? selectedMilestone
            : null
        }
        users={ws.users}
        isAdmin={canManageTasks}
        onClose={() => setViewTask(null)}
        onEdit={(task) => {
          setTaskModal({ open: true, edit: task });
          setViewTask(null);
        }}
        onDelete={(task) => {
          setDeleteTask(task);
          setViewTask(null);
        }}
        onEscalate={() => {
          void ws.refresh();
        }}
        onMessage={() => { }}
      />

      <TaskFormModal
        open={taskModal.open}
        initialData={taskModal.edit}
        defaultProjectId={ws.project.id}
        defaultMilestoneId={taskModal.milestoneId ?? selectedTask?.milestoneId ?? ""}
        projects={[ws.project]}
        departments={[]}
        milestones={ws.milestones}
        users={ws.users}
        roles={auth?.roleKeys}
        onSubmit={handleTaskSubmit}
        onClose={() => setTaskModal({ open: false })}
      />

      <ConfirmDeleteModal
        open={!!deleteTask}
        name={deleteTask?.title ?? ""}
        onConfirm={handleDeleteTask}
        onClose={() => setDeleteTask(null)}
      />

      <MilestoneDetailModal
        open={!!viewMilestone}
        milestone={viewMilestone}
        tasks={ws.tasks}
        project={ws.project}
        users={ws.users}
        isAdmin={canManageTasks}
        dependencies={ws.dependencies}
        allMilestones={ws.milestones}
        onClose={() => setViewMilestone(null)}
        onComplete={() => {
          if (viewMilestone) api.completeMilestone(auth!.token, viewMilestone.id).then(() => ws.refresh());
          setViewMilestone(null);
        }}
        onStatusChange={(status) => {
          if (viewMilestone) api.setMilestoneStatus(auth!.token, viewMilestone.id, status).then(() => ws.refresh());
          setViewMilestone(null);
        }}
        onEdit={() => {
          if (viewMilestone) setMilestoneModal({ open: true, edit: viewMilestone });
          setViewMilestone(null);
        }}
        onDelete={() => { }}
      />

      <MilestoneFormModal
        open={milestoneModal.open}
        projectId={ws.project.id}
        initialData={milestoneModal.edit}
        departments={appData.departments}
        organizations={appData.organizations}
        isSuperAdmin={perm.isSuperAdmin}
        userOrganizationId={userOrganizationId}
        projectEndDate={ws.project.plannedEndDate?.split("T")[0] ?? ""}
        onSubmit={handleMilestoneSubmit}
        onClose={() => { setMilestoneModal({ open: false }); setMilestoneError(""); }}
        serverError={milestoneError}
      />

      <DependencyFormModal
        open={depModalOpen}
        editDep={null}
        milestones={ws.milestones}
        onAdd={handleAddDependency}
        onUpdate={handleUpdateDependency}
        onClose={() => setDepModalOpen(false)}
      />

    </div>
  );
}
