import { useCallback, useMemo, useState } from "react";
import { api } from "../../../api";
import type { Milestone, Project, ProjectHealth, User } from "../../../types";
import { ProjectBasicDetails } from "./ProjectBasicDetails";
import { AIInsightsSection } from "./AIInsightsSection";
import { MilestonesTab } from "../../shared/MilestonesTab";
import { DocumentsSection } from "./DocumentsSection";

interface ProjectDetailkProps {
  project: Project | null;
  health: ProjectHealth | null;
  insights: string[];
  canManageProjects: boolean;
  onStatusChange: (status: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  formatMoney: (amount: number) => string;
  authToken?: string | null;
  users?: User[];
  milestones?: Milestone[];
}

function normalizePercent(value?: number | null) {
  if (value == null) return null;
  return Math.min(Math.round(value > 1 ? value : value * 100), 100);
}

export function ProjectDetailk({
  project,
  canManageProjects,
  onStatusChange,
  onEdit,
  onDelete,
  formatMoney,
  authToken,
  users = [],
  milestones = [],
}: ProjectDetailkProps) {
  const [pendingWarning, setPendingWarning] = useState<{
    incompleteCount: number;
    totalCount: number;
  } | null>(null);

  const healthScore = normalizePercent(project?.aiHealthScore);
  const delayRisk = normalizePercent(project?.aiDelayRiskScore);
  const progress = project?.progressPercentage || 0;
  const manager = useMemo(
    () => users.find((user) => user.id === project?.projectManagerId),
    [users, project?.projectManagerId]
  );

  const handleStatusChange = useCallback((status: string) => {
    if (status === "Completed" && milestones.length > 0) {
      const incomplete = milestones.filter((m) => m.status !== "Completed");
      if (incomplete.length > 0) {
        setPendingWarning({
          incompleteCount: incomplete.length,
          totalCount: milestones.length,
        });
        return;
      }
    }
    onStatusChange(status);
  }, [milestones, onStatusChange]);

  const handleForceComplete = useCallback(async () => {
    if (!authToken || !pendingWarning || !onStatusChange) return;
    setPendingWarning(null);
    const incomplete = milestones.filter((m) => m.status !== "Completed");
    await Promise.allSettled(
      incomplete.map((m) => api.completeMilestone(authToken, m.id, true))
    );
    onStatusChange("Completed");
  }, [authToken, milestones, onStatusChange, pendingWarning]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white/50">
        <span className="material-symbols-outlined text-5xl mb-3">folder_open</span>
        <p className="text-sm font-medium">Select or create a project</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      
<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  {/* Left Column: Milestones */}
  <MilestonesTab
    key={project.id}
    projectId={project.id}
    authToken={authToken ?? undefined}
  />

  {/* Right Column: Basic Details + AI Insights */}
  <div className="flex flex-col gap-5">
    <ProjectBasicDetails
      project={project}
      canManage={canManageProjects}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={handleStatusChange}
      users={users}
      milestonesCount={milestones.length}
      pendingWarning={pendingWarning}
      setPendingWarning={setPendingWarning}
      handleForceComplete={handleForceComplete}
    />

    <AIInsightsSection
      project={project}
      progress={progress}
      healthScore={healthScore}
      delayRisk={delayRisk}
      manager={manager}
      formatMoney={formatMoney}
    />
  </div>

  {/* Documents Section - Commented out */}
  {/* <DocumentsSection
    projectId={project.id}
    authToken={authToken}
  /> */}
</div>

     
    </div>
  );
}
