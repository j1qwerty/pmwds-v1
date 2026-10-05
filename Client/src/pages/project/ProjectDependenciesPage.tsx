import { useEffect } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import {
  LoadingPage,
  useNavHeader,
  usePermission,
  useToast,
} from "../shared/index";
import { useProjectWorkspace } from "./useProjectWorkspace";
import { ProjectNotFound } from "./ProjectNotFound";
import { MilestoneDependencyPanel } from "./components/index";

export function ProjectDependenciesPage() {
  const ws = useProjectWorkspace();
  const { auth } = useAuth();
  const perm = usePermission();
  const { setNavHeader } = useNavHeader();
  const { addToast } = useToast();

  const canManage = perm.isSuperAdmin || hasRoleKey(perm.roleKeys, RoleKey.Director);

  useEffect(() => {
    if (ws.project) {
      setNavHeader({
        title: `Dependencies · ${ws.project.name}`,
        description: "Manage milestone dependency rules",
      });
    } else {
      setNavHeader({ title: "Dependencies", description: "" });
    }
  }, [setNavHeader, ws.project]);

  const handleAdd = async (payload: Record<string, unknown>) => {
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

  const handleUpdate = async (id: string, payload: Record<string, unknown>) => {
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

  const handleDelete = async (id: string) => {
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

  if (ws.loading) return <LoadingPage label="Loading dependencies..." />;
  if (!ws.project) return <ProjectNotFound />;

  return (
    <div className="relative z-10 max-w-2xl mx-auto">
      <MilestoneDependencyPanel
        dependencies={ws.dependencies}
        milestones={ws.milestones}
        projectId={ws.project.id}
        canManage={canManage}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={ws.refresh}
      />
    </div>
  );
}
