import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";

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

  // Dependencies are not milestones, but the API hangs them off the milestones
  // controller: POST/PUT /milestones/dependencies is gated on Milestones.Edit
  // and DELETE on Milestones.Delete. Mirror those two policies exactly rather
  // than the old manage-or-any-CRD check, which let a delete-only grant (or any
  // milestone.create) render an "Add" button the server would reject.
  const canEditDependencies = perm.canModule("edit", "milestone");
  const canDeleteDependencies = perm.canModule("delete", "milestone");
  const [newRequestKey, setNewRequestKey] = useState(0);

  useEffect(() => {
    if (ws.project) {
      setNavHeader({
        title: `Dependencies · ${ws.project.name}`,
        description: "Manage milestone dependency rules",
        actions: canEditDependencies
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
  }, [setNavHeader, ws.project, canEditDependencies]);

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
        canEdit={canEditDependencies}
        canDelete={canDeleteDependencies}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={ws.refresh}
        newRequestKey={newRequestKey}
      />
    </div>
  );
}
