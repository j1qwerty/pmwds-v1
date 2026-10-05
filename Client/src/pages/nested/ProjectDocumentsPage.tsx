import { useEffect } from "react";
import { useAuth } from "../../auth";
import { GlassCard, LoadingPage, useNavHeader } from "../shared";
import { DocumentsSection } from "../projectsK/components";
import { useProjectWorkspace } from "./nestedShared";
import { ProjectNotFound } from "./ProjectNotFound";

/**
 * Documents tab for a project. Reuses the shared DocumentsSection so
 * upload/download and the utilization-certificate block behave identically
 * everywhere they appear.
 */
export function ProjectDocumentsPage() {
  const ws = useProjectWorkspace();
  const { auth } = useAuth();
  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    if (!ws.project) {
      setNavHeader({ title: "Documents", description: "" });
      return;
    }
    setNavHeader({
      title: `Documents · ${ws.project.name}`,
      description: "Project documents and utilization certificates",
    });
  }, [setNavHeader, ws.project]);

  if (ws.loading) return <LoadingPage label="Loading project documents..." />;
  if (!ws.project) return <ProjectNotFound />;

  return (
    <div className="relative z-10 mb-15">
      <GlassCard className="p-5">
        <DocumentsSection
          projectId={ws.project.id}
          authToken={auth?.token}
          milestones={ws.milestones}
          tasks={ws.tasks}
        />
      </GlassCard>
    </div>
  );
}