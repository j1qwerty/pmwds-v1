import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import { onDataChanged } from "../../realtime";
import { PROJECT_WORKSPACE_SCOPES } from "../../realtimeScopes";
import type { Milestone, MilestoneDependency, Project, Task, User } from "../../types";
import { projectBelongsToAnyDepartment } from "../shared";
import { useUserOrganization } from "../shared/useUserOrganization";

/** See the matching constants in appData.tsx. */
const REALTIME_DEBOUNCE_MS = 250;
const FOCUS_DEBOUNCE_MS = 1000;

export interface ProjectWorkspaceData {
  project: Project | null;
  milestones: Milestone[];
  tasks: Task[];
  users: User[];
  dependencies: MilestoneDependency[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

export function useProjectWorkspace(): ProjectWorkspaceData {
  const { projectId } = useParams<{ projectId: string }>();
  const { auth } = useAuth();
  const { data } = useAppData();
  const users = data.users;
  const departments = data.departments;
  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<MilestoneDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleProject = useMemo(() => {
    if (!project) return null;
    if (shouldFilterByOrg && userOrganizationId) {
      const orgDeptIds = (departments.length ? departments : data.departments)
        .filter((d) => d.organizationId === userOrganizationId)
        .map((d) => d.id);
      if (!projectBelongsToAnyDepartment(project, orgDeptIds)) return null;
    }
    return project;
  }, [project, data.departments, departments, shouldFilterByOrg, userOrganizationId]);

  const load = useCallback(async () => {
    if (!auth || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const projectData = await api.getProject(auth.token, projectId).catch(() => {
        return data.projects.find((p) => p.id === projectId) ?? null;
      });
      if (!projectData) {
        setProject(null);
        setMilestones([]);
        setTasks([]);
        setDependencies([]);
        return;
      }

      // Project data is the critical request. Related collections are still fetched
      // independently so the request coordinator can bound database pressure.
      const [milestoneData, taskData, dependencyData] = await Promise.all([
        api.getMilestonesByProject(auth.token, projectId),
        api.getTasksByProject(auth.token, projectId),
        api.getMilestoneDependencies(auth.token, projectId),
      ]);
      setProject(projectData);
      setMilestones(milestoneData);
      setTasks(taskData);
      setDependencies(dependencyData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project data.");
    } finally {
      setLoading(false);
    }
    // `data` is intentionally not a dependency: it is a large memo that changes on every
    // refetch, which would make `load` unstable and re-trigger the effect below in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Keep the workspace in sync with other sessions. Without this, an edit made in
  // another browser stayed invisible here until the tab was reloaded.
  useEffect(() => {
    if (!auth || !projectId) return;

    let debounceTimer: number | undefined;

    const scheduleLoad = (delay: number) => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = undefined;
        void load();
      }, delay);
    };

    const stopListening = onDataChanged((notification) => {
      if (!PROJECT_WORKSPACE_SCOPES.includes(notification.scope)) return;
      // Only react to events for this project when the server tells us which one it is.
      // The projectId is null for some server-side cascades, so treat that as "mine".
      if (notification.projectId && notification.projectId !== projectId) return;
      scheduleLoad(REALTIME_DEBOUNCE_MS);
    });

    const onFocus = () => scheduleLoad(FOCUS_DEBOUNCE_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleLoad(FOCUS_DEBOUNCE_MS);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
      stopListening();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [auth, projectId, load]);

  return {
    project: visibleProject,
    milestones,
    tasks,
    users: users.length ? users : data.users,
    dependencies,
    loading,
    error,
    refresh: load,
  };
}

export function filterProjectsByUserScope(
  projects: Project[],
  departments: { id: string; organizationId?: string | null }[],
  userOrganizationId: string | null,
  shouldFilterByOrg: boolean,
): Project[] {
  if (!shouldFilterByOrg || !userOrganizationId) return projects;
  const orgDeptIds = departments
    .filter((d) => d.organizationId === userOrganizationId)
    .map((d) => d.id);
  return projects.filter((p) => projectBelongsToAnyDepartment(p, orgDeptIds));
}
