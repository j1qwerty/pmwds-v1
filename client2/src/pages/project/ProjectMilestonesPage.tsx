import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import type { Milestone, MilestoneDependency, Task } from "../../types";
import { classNames } from "../../lib/formatters";
import {
  GlassCard,
  LoadingPage,
  useNavHeader,
  PERMISSION_GROUPS,
  usePermission,
  useToast,
} from "../shared/index";
import { useUserOrganization } from "../shared/useUserOrganization";
import {
  MilestonesPanel,
  MilestoneDetailModal,
  TaskSubtaskCard,
  TaskSubtaskDetailsModal,
  TaskFormModal,
  MilestoneFormModal,
  ConfirmDeleteModal,
  DependencyFormModal,
  DependenciesPanel,
} from "./components/index";
import { useProjectWorkspace } from "./useProjectWorkspace";
import { ProjectNotFound } from "./ProjectNotFound";
import { Icon } from "../../components/ui/Icon";

export function ProjectMilestonesPage() {
  const ws = useProjectWorkspace();
  const { data: appData } = useAppData();
  const { auth } = useAuth();
  const { addToast } = useToast();
  const perm = usePermission();
  const { userOrganizationId } = useUserOrganization(appData.users, appData.departments);
  const canManageMilestones = perm.isSuperAdmin || hasRoleKey(perm.roleKeys, RoleKey.Director);
  const canManageTasks = perm.has(PERMISSION_GROUPS.task.manage);

  const [pickedMilestoneId, setPickedMilestoneId] = useState("");

  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; edit?: Milestone }>({
    open: false,
  });
  const [deleteMilestone, setDeleteMilestone] = useState<Milestone | null>(null);
  const [taskModal, setTaskModal] = useState<{
    open: boolean;
    edit?: Task;
    milestoneId?: string;
  }>({ open: false });
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [viewMilestone, setViewMilestone] = useState<Milestone | null>(null);
  const [milestoneError, setMilestoneError] = useState("");
  const [pendingForceComplete, setPendingForceComplete] = useState<{
    milestoneId: string;
    status?: string;
    incompleteCount: number;
    totalCount: number;
  } | null>(null);

  const [depModalOpen, setDepModalOpen] = useState(false);
  const [editDep, setEditDep] = useState<MilestoneDependency | null>(null);

  const { setNavHeader } = useNavHeader();

  const selectedMilestoneId =
    pickedMilestoneId && ws.milestones.some((m) => m.id === pickedMilestoneId)
      ? pickedMilestoneId
      : ws.milestones[0]?.id ?? "";

  useEffect(() => {
    if (!ws.project) {
      setNavHeader({ title: "Milestones", description: "" });
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
        onClick: () =>
          setTaskModal({ open: true, milestoneId: selectedMilestoneId }),
        icon: "add_task",
      });
    }
    setNavHeader({
      title: `Milestones · ${ws.project.name}`,
      description: "Track milestones with their tasks and subtasks",
      actions,
    });
  }, [
    setNavHeader,
    ws.project,
    canManageMilestones,
    canManageTasks,
    selectedMilestoneId,
  ]);

  const milestoneTasks = useMemo(() => {
    if (!selectedMilestoneId) return [];
    return ws.tasks.filter((t) => t.milestoneId === selectedMilestoneId && !t.parentTaskId);
  }, [ws.tasks, selectedMilestoneId]);

  const selectedTask = ws.tasks.find((t) => t.id === selectedTaskId) ?? null;
  const selectedMilestone =
    ws.milestones.find((m) => m.id === selectedMilestoneId) ?? null;

  const getProgressColor = (progress: number): string => {
    if (progress === 100) return "bg-emerald-500";
    if (progress >= 75) return "bg-amber-400";
    if (progress >= 50) return "bg-sky-400";
    if (progress >= 25) return "bg-red-400";
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

  const getIncompleteTaskCount = (milestoneId: string) => {
    const milestoneTasks = ws.tasks.filter(t => t.milestoneId === milestoneId);
    const incomplete = milestoneTasks.filter(t => t.status !== "Completed").length;
    return { incomplete, total: milestoneTasks.length };
  };

  const handleForceCompleteConfirm = async () => {
    if (!auth || !pendingForceComplete) return;
    const { milestoneId, status } = pendingForceComplete;
    setPendingForceComplete(null);
    try {
      if (status && status !== "Completed") {
        await api.setMilestoneStatus(auth.token, milestoneId, status, true);
      } else {
        await api.completeMilestone(auth.token, milestoneId, true);
      }
      addToast("All tasks completed and milestone updated");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to complete milestone", "error");
    }
  };

  const handleCompleteMilestone = async (milestoneId: string) => {
    if (!auth) return;
    const { incomplete, total } = getIncompleteTaskCount(milestoneId);
    if (incomplete > 0) {
      setPendingForceComplete({ milestoneId, incompleteCount: incomplete, totalCount: total });
      return;
    }
    try {
      await api.completeMilestone(auth.token, milestoneId);
      addToast("Milestone completed");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to complete milestone", "error");
    }
  };

  const handleMilestoneStatus = async (milestoneId: string, status: string) => {
    if (!auth) return;
    if (status === "Completed") {
      const { incomplete, total } = getIncompleteTaskCount(milestoneId);
      if (incomplete > 0) {
        setPendingForceComplete({ milestoneId, status, incompleteCount: incomplete, totalCount: total });
        return;
      }
    }
    try {
      await api.setMilestoneStatus(auth.token, milestoneId, status);
      addToast(`Milestone status updated to ${status}`);
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to update status", "error");
    }
  };

  const handleDeleteMilestone = async () => {
    if (!auth || !deleteMilestone) return;
    try {
      await api.deleteMilestone(auth.token, deleteMilestone.id);
      setDeleteMilestone(null);
      if (pickedMilestoneId === deleteMilestone.id) setPickedMilestoneId("");
      addToast("Milestone deleted");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete milestone", "error");
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

  const handleDeleteDependency = async (id: string) => {
    if (!auth) return;
    try {
      await api.deleteMilestoneDependency(auth.token, id);
      addToast("Dependency deleted");
      await ws.refresh();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete dependency", "error");
      throw e;
    }
  };

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

  const useContainerWidth = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
      const container = ref.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const containerWidth = entry.contentRect.width;
          const viewportWidth = window.innerWidth;
          const widthPercentage = (containerWidth / viewportWidth) * 100;
          setIsNarrow(widthPercentage < 40);
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    return { ref, isNarrow };
  };

  const { ref: tasksContainerRef, isNarrow: isTasksNarrow } = useContainerWidth();

  const sortedMilestones = useMemo(() => {
    if (ws.dependencies.length === 0) return ws.milestones;

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

  if (ws.loading) return <LoadingPage label="Loading milestones..." />;
  if (!ws.project) return <ProjectNotFound />;

  const completedMilestones = ws.milestones.filter((m) => m.status === "Completed").length;
  const criticalMilestones = ws.milestones.filter((m) => m.isCritical).length;
  const averageProgress = ws.milestones.length
    ? ws.milestones.reduce((sum, m) => sum + (m.progressPercentage || 0), 0) / ws.milestones.length
    : 0;

  return (
    <div>
      {/* <AnimatedBackground /> */}
     

      {pendingForceComplete && (
        <div className="relative z-10 mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Icon name="warning" size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Incomplete tasks detected</p>
              <p className="text-xs text-amber-700 mt-1">
                <strong>{pendingForceComplete.incompleteCount}</strong> of <strong>{pendingForceComplete.totalCount}</strong> task(s) in this milestone are not completed.
                Continuing will mark all tasks and subtasks as completed at 100% progress.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleForceCompleteConfirm}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                >
                  Yes, complete all
                </button>
                <button
                  onClick={() => setPendingForceComplete(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[280px_1fr_240px] gap-4">
        {/* Left: Milestone list */}
        <MilestonesPanel
          milestones={sortedMilestones}
          tasks={ws.tasks}
          users={ws.users}
          project={ws.project}
          selectedMilestoneId={selectedMilestoneId}
          onSelectMilestone={setPickedMilestoneId}
          canManage={canManageMilestones}
          onAdd={() => setMilestoneModal({ open: true })}
          onEdit={(m) => setMilestoneModal({ open: true, edit: m })}
          onDelete={setDeleteMilestone}
          onComplete={handleCompleteMilestone}
          onStatusChange={handleMilestoneStatus}
          onAddTask={(milestoneId) => {
            setTaskModal({ open: true, milestoneId });
          }}
          hideDetailPanel
          onViewDetail={setViewMilestone}
        />

        {/* Center: Tasks */}
        <div ref={tasksContainerRef} className="space-y-3 min-w-0">
          {selectedMilestone?.isBlocked && selectedMilestone.blockedByMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2">
              <Icon name="warning" size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Milestone blocked:</span> {selectedMilestone.blockedByMessage}
                <p className="text-[10px] text-amber-600 mt-0.5">Tasks can still be created but the milestone cannot be marked complete until prerequisites are met.</p>
              </div>
            </div>
          )}

          {selectedMilestone && canManageTasks && milestoneTasks.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tasks for {selectedMilestone.name}
              </span>
              <button
                type="button"
                onClick={() => setTaskModal({ open: true, milestoneId: selectedMilestoneId })}
                className="text-xs text-indigo-600 font-semibold flex items-center gap-1 hover:text-indigo-800"
              >
                <Icon name="add" size={16} />
                New task
              </button>
            </div>
          )}

          {selectedMilestone && milestoneTasks.length === 0 ? (
            <GlassCard className="p-8">
              <div className="text-center text-slate-400">
                <Icon name="task_alt" size={32} className="mb-3 block" />
                <p className="text-sm font-medium text-slate-600">No tasks yet</p>
                <p className="text-xs mt-1">
                  {canManageTasks
                    ? "Add tasks to this milestone to track its progress."
                    : "Tasks for this milestone will appear here."}
                </p>
                {canManageTasks && (
                  <button
                    type="button"
                    onClick={() => setTaskModal({ open: true, milestoneId: selectedMilestoneId })}
                    className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    Create first task
                  </button>
                )}
              </div>
            </GlassCard>
          ) : selectedMilestone ? (
            <div className={classNames(
              "grid gap-3",
              isTasksNarrow ? "grid-cols-1" : "grid-cols-2"
            )}>
              {milestoneTasks.map((task) => (
                <TaskSubtaskCard
                  key={task.id}
                  task={task}
                  canEdit={canManageTasks}
                  onViewTask={(t) => setViewTask(t)}
                  onEditTask={(t) => setTaskModal({ open: true, edit: t })}
                  getProgressColor={getProgressColor}
                  onRefresh={() => ws.refresh()}
                  users={ws.users}
                />
              ))}
            </div>
          ) : (
            <GlassCard className="p-8 flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center text-slate-400">
                <Icon name="task_alt" size={32} className="mb-3 block" />
                <p className="text-sm font-medium text-slate-600">Select a milestone</p>
                <p className="text-xs mt-1">Tasks will appear here once a milestone is selected.</p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right: Dependencies panel */}
        <div className="space-y-3">
          <DependenciesPanel
            dependencies={ws.dependencies}
            milestones={ws.milestones}
            canManage={canManageMilestones}
            onNew={() => { setEditDep(null); setDepModalOpen(true); }}
            onEdit={(dep) => { setEditDep(dep); setDepModalOpen(true); }}
            onDelete={handleDeleteDependency}
          />
        </div>
      </div>

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

      <ConfirmDeleteModal
        open={!!deleteMilestone}
        name={deleteMilestone?.name ?? ""}
        warning={
          deleteMilestone
            ? (() => {
                const taskCount = ws.tasks.filter((t) => t.milestoneId === deleteMilestone.id).length;
                const depCount = ws.dependencies.filter(
                  (d) => d.prerequisiteMilestoneId === deleteMilestone.id || d.dependentMilestoneId === deleteMilestone.id
                ).length;
                const parts: string[] = [];
                if (taskCount > 0) parts.push(`${taskCount} linked task${taskCount > 1 ? "s" : ""}`);
                if (depCount > 0) parts.push(`${depCount} linked milestone dependenc${depCount > 1 ? "ies" : "y"}`);
                return parts.length > 0
                  ? `This milestone has ${parts.join(" and ")}. It will be deleted along with its tasks, subtasks, and dependencies.`
                  : undefined;
              })()
            : undefined
        }
        onConfirm={handleDeleteMilestone}
        onClose={() => setDeleteMilestone(null)}
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
        isAdmin={canManageMilestones}
        dependencies={ws.dependencies}
        allMilestones={ws.milestones}
        onClose={() => setViewMilestone(null)}
        onComplete={() => {
          if (viewMilestone) handleCompleteMilestone(viewMilestone.id);
          setViewMilestone(null);
        }}
        onStatusChange={(status) => {
          if (viewMilestone) handleMilestoneStatus(viewMilestone.id, status);
        }}
        onEdit={() => {
          if (viewMilestone) setMilestoneModal({ open: true, edit: viewMilestone });
          setViewMilestone(null);
        }}
        onDelete={() => {
          if (viewMilestone) setDeleteMilestone(viewMilestone);
          setViewMilestone(null);
        }}
      />

      <DependencyFormModal
        open={depModalOpen}
        editDep={editDep}
        milestones={ws.milestones}
        onAdd={handleAddDependency}
        onUpdate={handleUpdateDependency}
        onClose={() => { setDepModalOpen(false); setEditDep(null); }}
      />

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

    </div>
  );
}



