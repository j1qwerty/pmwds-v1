// components/MilestonesTab.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import type { Milestone, MilestoneDependency, Task, ProjectDocument } from "../../types";
import { StatusBadge } from "./StatusBadge";
import { ProjectTaskCardk } from "../projectsK/components/ProjectTaskCardk";
import { DocumentsSection } from "../projectsK/components/DocumentsSection";

interface MilestonesTabProps {
  projectId: string;
  authToken?: string;
}

export function MilestonesTab({ projectId, authToken }: MilestonesTabProps) {
  const [activeTab, setActiveTab] = useState<"milestones" | "documents">("milestones");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [dependencies, setDependencies] = useState<MilestoneDependency[]>([]);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const fetchData = () => {
    if (!authToken || !projectId) return;
    
    setLoading(true);
    Promise.allSettled([
      api.getMilestonesByProject(authToken, projectId),
      api.getTasksByProject(authToken, projectId),
      api.getProjectDocuments(authToken, projectId),
      api.getMilestoneDependencies(authToken, projectId),
    ]).then(([milestoneResult, taskResult, docResult, depResult]) => {
      if (milestoneResult.status === "fulfilled") {
        setMilestones(milestoneResult.value);
      }
      if (taskResult.status === "fulfilled") {
        setTasks(taskResult.value);
      }
      if (docResult.status === "fulfilled") {
        setDocuments(docResult.value);
      }
      if (depResult.status === "fulfilled") {
        setDependencies(depResult.value);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    setActiveTab("milestones");
    fetchData();
  }, [authToken, projectId]);

  const tasksByMilestone = tasks.reduce((acc, task) => {
    const key = task.milestoneId || "standalone";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const parentTasksByMilestone = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (task.parentTaskId) continue;
      const key = task.milestoneId || "standalone";
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  const sortedMilestones = useMemo(() => {
    if (dependencies.length === 0) return milestones;
    const deps = dependencies;
    const mils = milestones;
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
  }, [milestones, dependencies]);

  const getMilestoneProgress = (milestoneId: string) => {
    const milestoneTasks = tasksByMilestone[milestoneId] || [];
    if (milestoneTasks.length === 0) return 0;
    const completed = milestoneTasks.filter(t => t.status === "Completed").length;
    return Math.round((completed / milestoneTasks.length) * 100);
  };

  const getProgressColor = (progress: number): string => {
    if (progress === 100) return "bg-emerald-500";
    if (progress >= 75) return "bg-amber-400";
    if (progress >= 50) return "bg-cyan-400";
    if (progress >= 25) return "bg-rose-400";
    return "bg-slate-300";
  };

  const getStrokeColor = (progress: number): string => {
    if (progress === 100) return '#10b981';
    if (progress >= 75) return '#fbbf24';
    if (progress >= 50) return '#22d3ee';
    if (progress >= 25) return '#fb7185';
    return '#cbd5e1';
  };

  const toggleMilestoneExpansion = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      Completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
      InProgress: { bg: "bg-blue-50", text: "text-blue-700" },
      Pending: { bg: "bg-slate-50", text: "text-slate-700" },
      Delayed: { bg: "bg-rose-50", text: "text-rose-700" },
    };
    return colors[status] || colors.Pending;
  };

  return (
    <div className="mt-8">
      {/* Tabs Header */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveTab("milestones")}
            className={`
              px-6 py-3 text-sm font-semibold transition-all duration-200
              ${activeTab === "milestones" 
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" 
                : "text-slate-500 border-b-2 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }
            `}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">flag</span>
              Milestones
              {milestones.length > 0 && (
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {milestones.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`
              px-6 py-3 text-sm font-semibold transition-all duration-200
              ${activeTab === "documents" 
                ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" 
                : "text-slate-500 border-b-2 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }
            `}
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">description</span>
              Documents
              {documents.length > 0 && (
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {documents.length}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>


      {/* Milestones Tab Content */}
      {activeTab === "milestones" && (
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading milestones...</p>
              </div>
            </div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-400">flag</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">No Milestones Yet</h3>
              <p className="text-xs text-slate-500">Create milestones to track project progress and organize tasks.</p>
            </div>
          ) : (
            <>
              {dependencies.length > 0 && (
                <div className="flex items-center gap-3 mb-4 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">account_tree</span>
                    Dependencies
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{dependencies.length}</span>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {dependencies.filter(d => d.isMet).length} met
                  </span>
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    {dependencies.filter(d => !d.isMet).length} unmet
                  </span>
                </div>
              )}
            <div className="relative pl-8 ml-4 border-l-2 border-slate-200">
              <div className="space-y-8">
                {sortedMilestones.map((milestone) => {
                  const milestoneParentTasks = parentTasksByMilestone[milestone.id] || [];
                  const isCompleted = milestone.status === "Completed";
                  const progress = getMilestoneProgress(milestone.id);
                  const isExpanded = expandedMilestones.has(milestone.id);
                  const statusColor = getStatusColor(milestone.status);

                  return (
                    <div key={milestone.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <div className={`
                        absolute w-4 h-4 rounded-full -left-[41px] top-6
                        border-2 border-white ring-2 transition-all duration-300
                        ${isCompleted 
                          ? "bg-emerald-500 ring-emerald-200" 
                          : "bg-indigo-600 ring-indigo-200"
                        }
                      `}>
                        {isCompleted && (
                          <span className="material-symbols-outlined text-white text-xs absolute inset-0 flex items-center justify-center">
                            check
                          </span>
                        )}
                      </div>

                      {/* Milestone card */}
                      <div className={`
                        bg-white rounded-xl border transition-all duration-200 hover:shadow-md
                        ${isCompleted 
                          ? "border-emerald-200 bg-emerald-50/30" 
                          : "border-slate-200"
                        }
                      `}>
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`
                                  px-2.5 py-1 rounded-lg text-xs font-semibold
                                  ${statusColor.bg} ${statusColor.text}
                                `}>
                                  {/* {milestone.status} */}
                                </span>
                               
                              </div>
                              <h3 className="text-lg font-bold text-slate-900 mb-1">
                                {milestone.name}
                                {milestone.isBlocked && (
                                  <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded" title={milestone.blockedByMessage || ""}>
                                    🔒 Blocked
                                  </span>
                                )}
                              </h3>
                              {milestone.isBlocked && milestone.blockedByMessage && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-sm">warning</span>
                                  {milestone.blockedByMessage}
                                </p>
                              )}
                              {milestone.description && (
                                <p className="text-sm text-slate-600 line-clamp-2">{milestone.description}</p>
                              )}
                            </div>
                            <StatusBadge status={milestone.status} />
                             {milestone.isCritical && (
                                  <span className="mx-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700">
                                    Critical
                                  </span>
                                )}
                          </div>

                          {/* Progress bar */}
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-medium text-slate-500">
                                {milestoneParentTasks.length} task{milestoneParentTasks.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs font-bold text-slate-700">{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  progress === 100 ? "bg-emerald-500" :
                                  progress >= 75 ? "bg-amber-400" :
                                  progress >= 50 ? "bg-cyan-400" :
                                  progress >= 25 ? "bg-rose-400" : "bg-slate-300"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Tasks toggle button */}
                          {milestoneParentTasks.length > 0 && (
                            <button
                              onClick={() => toggleMilestoneExpansion(milestone.id)}
                              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                            >
                              <span className="material-symbols-outlined text-lg transition-transform duration-200"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                              >
                                chevron_right
                              </span>
                              {isExpanded ? 'Hide' : 'Show'} Tasks ({milestoneParentTasks.length})
                            </button>
                          )}

                          {/* Expanded tasks */}
                          {isExpanded && milestoneParentTasks.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                              {milestoneParentTasks.map((task) => (
                                <ProjectTaskCardk
                                  key={task.id}
                                  task={task}
                                  getProgressColor={getProgressColor}
                                  onRefresh={fetchData}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </div>
      )}

      {/* Documents Tab Content — reuses the shared section so this tab and the
          project detail modal stay in sync (including Utilization Certificates). */}
      {activeTab === "documents" && (
        <div className="mt-6">
          <DocumentsSection
            projectId={projectId}
            authToken={authToken}
            milestones={milestones}
            tasks={tasks}
          />
        </div>
      )}
    </div>
  );
}