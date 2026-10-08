import { useEffect, useState } from "react";
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
  const [newRequestKey, setNewRequestKey] = useState(0);

  useEffect(() => {
    if (ws.project) {
      setNavHeader({
        title: `Dependencies · ${ws.project.name}`,
        description: "Manage milestone dependency rules",
        actions: canManage
          ? [
              {
                label: "New dependency",
                onClick: () => setNewRequestKey((k) => k + 1),
                icon: "add",
              },
            ]
          : undefined,
      });
    } else {
      setNavHeader({ title: "Dependencies", description: "" });
    }
  }, [setNavHeader, ws.project, canManage]);

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
    <div className="relative z-10 max-w-5xl mx-auto">
      <MilestoneDependencyPanel
        dependencies={ws.dependencies}
        milestones={ws.milestones}
        projectId={ws.project.id}
        canManage={canManage}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={ws.refresh}
        newRequestKey={newRequestKey}
      />
    </div>
  );
}
