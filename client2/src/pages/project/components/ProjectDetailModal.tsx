import { useCallback, useState } from "react";
import type { Milestone, MilestoneDependency, Project, User } from "../../../types";
import { api } from "../../../api";
import { Sheet } from "../../shared/index";
import { formatMoney } from "../../../lib/formatters";
import { AIInsightsSection } from "./AIInsightsSection";
import { DocumentsSection } from "./DocumentsSection";
import { ProjectBasicDetails } from "./ProjectBasicDetails";
import { Icon } from "../../../components/ui/Icon";

interface ProjectDetailModalProps {
  project: Project | null;
  canManage: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStatusChange?: (status: string) => void;
  authToken?: string | null;
  users?: User[];
  milestones?: Milestone[];
  dependencies?: MilestoneDependency[];
}

/**
 * Right-side detail sheet for a single project: summary header with inline
 * status change, plus Documents / AI insights / Dependencies tabs.
 * Rendered as a Sheet so the underlying board stays visible.
 */
export function ProjectDetailModal({
  project,
  canManage,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  authToken,
  users = [],
  milestones = [],
  dependencies = [],
}: ProjectDetailModalProps) {
  const [pendingWarning, setPendingWarning] = useState<{
    incompleteCount: number;
    totalCount: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"ai" | "dependencies" | "documents">("documents");

  const handleStatusChange = useCallback(
    (status: string) => {
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
      onStatusChange?.(status);
    },
    [milestones, onStatusChange],
  );

  const handleForceComplete = useCallback(async () => {
    if (!authToken || !pendingWarning || !onStatusChange) return;
    setPendingWarning(null);
    const incomplete = milestones.filter((m) => m.status !== "Completed");
    await Promise.allSettled(incomplete.map((m) => api.completeMilestone(authToken, m.id, true)));
    onStatusChange("Completed");
  }, [authToken, milestones, onStatusChange, pendingWarning]);

  if (!project) return null;

  const healthScore = normalizePercent(project.aiHealthScore);
  const delayRisk = normalizePercent(project.aiDelayRiskScore);
  const progress = project.progressPercentage || 0;
  const manager = users.find((user) => user.id === project.projectManagerId);

  const tabs: Array<{ id: typeof activeTab; label: string; icon: string; count?: number }> = [
    { id: "documents", label: "Documents", icon: "description" },
    { id: "ai", label: "AI insights", icon: "hi-sparkles" },
    { id: "dependencies", label: "Dependencies", icon: "account_tree", count: dependencies.length },
  ];

  return (
    <Sheet
      open={true}
      onClose={onClose}
      size="xl"
      icon="folder_open"
      accent="primary"
      title={project.name}
      description={project.projectCode ? `${project.projectCode} · ${project.category}` : project.category}
    >
      <div className="space-y-5">
        {/* Project basic details (status change lives here) */}
        <ProjectBasicDetails
          project={project}
          canManage={canManage}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={handleStatusChange}
          users={users}
          milestonesCount={milestones.length}
          bare
          pendingWarning={pendingWarning}
          setPendingWarning={setPendingWarning}
          handleForceComplete={handleForceComplete}
        />

        {/* Tabs — clean underline style */}
        <div className="border-b border-slate-200/80">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Project detail sections">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                    isActive ? "text-indigo-600" : "text-slate-500 hover:bg-slate-50/80 hover:text-slate-700"
                  }`}
                >
                  <Icon name={tab.icon} size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="min-h-[300px] view-fade" key={activeTab}>
          {activeTab === "ai" ? (
            <AIInsightsSection
              project={project}
              progress={progress}
              healthScore={healthScore}
              delayRisk={delayRisk}
              manager={manager}
              formatMoney={formatMoney}
            />
          ) : activeTab === "dependencies" ? (
            <DependenciesSection dependencies={dependencies} milestones={milestones} />
          ) : (
            <DocumentsSection
              projectId={project.id}
              authToken={authToken}
              milestones={milestones}
              users={users}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}

function DependenciesSection({
  dependencies,
  milestones,
}: {
  dependencies: MilestoneDependency[];
  milestones: Milestone[];
}) {
  if (dependencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Icon name="account_tree" size={28} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-600">No dependencies defined</p>
        <p className="text-xs mt-1 text-slate-400">Go to the milestones to add dependency rules.</p>
      </div>
    );
  }

  const metCount = dependencies.filter((d) => d.isMet).length;
  const unmetCount = dependencies.filter((d) => !d.isMet).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
          <Icon name="account_tree" size={14} />
          {dependencies.length} total
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
          <Icon name="check-circle" size={14} />
          {metCount} met
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
          <Icon name="hi-ban" size={14} />
          {unmetCount} unmet
        </div>
      </div>

      <div className="space-y-2">
        {dependencies.map((dep) => {
          const prereqName =
            dep.prerequisiteMilestoneName ||
            milestones.find((m) => m.id === dep.prerequisiteMilestoneId)?.name ||
            "Unknown";
          const depName =
            dep.dependentMilestoneName ||
            milestones.find((m) => m.id === dep.dependentMilestoneId)?.name ||
            "Unknown";
          return (
            <div
              key={dep.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                dep.isMet
                  ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70"
                  : "border-amber-200 bg-amber-50/40 hover:bg-amber-50/70"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  dep.isMet ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                }`}
              >
                <Icon name={dep.isMet ? "check-circle" : "hi-ban"} size={15} />
              </div>
              <div className="text-xs flex-1 min-w-0 flex flex-wrap items-center gap-1">
                <span className="font-semibold text-slate-700">{prereqName}</span>
                <Icon name="arrow-right" size={12} className="text-slate-400 mx-0.5" />
                <span className="font-semibold text-slate-700">{depName}</span>
                <span className="ml-1 text-[10px] text-slate-400">
                  {dep.type === "CompletionBased" ? "(must complete)" : `(reach ${dep.thresholdPercentage}%)`}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                  dep.isMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {dep.isMet ? "Met" : "Unmet"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizePercent(value?: number | null) {
  if (value == null) return null;
  return Math.min(Math.round(value > 1 ? value : value * 100), 100);
}
