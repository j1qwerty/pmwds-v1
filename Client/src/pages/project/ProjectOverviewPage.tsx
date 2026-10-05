import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import type { Milestone, MilestoneDependency, ProjectDocument, TaskAttachment } from "../../types";
import {
  GlassCard,
  getStatusColor,
  getPriorityColor,
  LoadingPage,
  useNavHeader,
  PERMISSION_GROUPS,
  usePermission,
  useToast,
  UtilizationCertificates,
} from "../shared/index";
import { useProjectWorkspace } from "./useProjectWorkspace";
import { ProjectNotFound } from "./ProjectNotFound";
import { ProjectInfoCard } from "./ProjectInfoCard";
import { Icon } from "../../components/ui/Icon";
import { Avatar } from "../shared/Avatar";
import { TaskStatusDonut, MilestoneTimeline, BudgetBar } from "./components/OverviewCharts";
import { OverviewAIInsights } from "./components/OverviewAIInsights";
import { formatLakhs } from "../../lib/formatters";

function KpiCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", iconBg: "bg-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", iconBg: "bg-emerald-100" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-amber-100" },
    rose: { bg: "bg-rose-50", text: "text-rose-600", iconBg: "bg-rose-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", iconBg: "bg-violet-100" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-600", iconBg: "bg-cyan-100" },
    slate: { bg: "bg-slate-50", text: "text-slate-600", iconBg: "bg-slate-100" },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:shadow-md ${c.bg}/30`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold mt-1 ${c.text}`}>{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0 ml-2`}>
          <Icon name={icon} size={16} className={c.text} />
        </div>
      </div>
    </div>
  );
}

export function ProjectOverviewPage() {
  const navigate = useNavigate();
  const ws = useProjectWorkspace();
  const { auth } = useAuth();
  const { addToast } = useToast();
  const perm = usePermission();
  const { setNavHeader } = useNavHeader();

  const canManageProjects = perm.has(PERMISSION_GROUPS.project.manage);

  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const PAGE_SIZE = 15;
  const PIN_THRESHOLD = 5;
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedScrollPos, setSavedScrollPos] = useState(0);
  const [pinnedMilestone, setPinnedMilestone] = useState<Milestone | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const currentUser = ws.users.find((u) => u.id === auth?.userId);
  const isPrimaryDept = currentUser?.departmentId === ws.project?.departmentId;
  const canUploadProjectDocs = perm.isSuperAdmin || hasRoleKey(perm.roleKeys, RoleKey.Director) || isPrimaryDept;

  useEffect(() => {
    if (!ws.project || !auth) return;
    setLoadingDocs(true);
    api
      .getProjectDocuments(auth.token, ws.project.id)
      .then(setProjectDocs)
      .catch(() => setProjectDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [ws.project?.id, auth]);

  useEffect(() => {
    if (!ws.project) {
      setNavHeader({ title: "Overview", description: "" });
      return;
    }
    setNavHeader({
      title: `Overview · ${ws.project.name}`,
      description: "Project summary with stats, charts, and insights",
    });
  }, [setNavHeader, ws.project]);

  const taskStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of ws.tasks) {
      const key = t.status || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    const order = ["Todo", "InProgress", "OnHold", "Completed", "Delayed", "Cancelled", "Unknown"];
    return order.filter((s) => counts[s]).map((s) => ({ status: s, count: counts[s] }));
  }, [ws.tasks]);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of ws.tasks) {
      const p = t.priority || "Medium";
      counts[p] = (counts[p] || 0) + 1;
    }
    return Object.entries(counts).map(([priority, count]) => ({ priority, count }));
  }, [ws.tasks]);

  const teamTaskCounts = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      user?: (typeof ws.users)[number];
      name: string;
      active: number;
      completed: number;
      total: number;
    }>();

    for (const t of ws.tasks) {
      const assignments = t.assignees?.length
        ? t.assignees.map((assignee) => ({
          userId: assignee.userId,
          name: assignee.fullName ?? undefined,
        }))
        : t.assignedToUserId
          ? [{ userId: t.assignedToUserId, name: t.assignedToUserName ?? undefined }]
          : [];

      for (const assignment of assignments) {
        if (!assignment.userId) continue;

        let row = map.get(assignment.userId);
        if (!row) {
          const user = ws.users.find((u) => u.id === assignment.userId);
          row = {
            userId: assignment.userId,
            user,
            name: user?.fullName || assignment.name || "Unknown user",
            active: 0,
            completed: 0,
            total: 0,
          };
          map.set(assignment.userId, row);
        }

        row.total++;
        if (t.status === "Completed") row.completed++;
        else if (t.status !== "Cancelled") row.active++;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [ws.tasks, ws.users]);

  const overdueCount = ws.tasks.filter((t) => t.isOverdue).length;
  const escalatedCount = ws.tasks.filter((t) => t.isEscalated).length;
  const completedCount = ws.tasks.filter((t) => t.status === "Completed").length;
  const inProgressCount = ws.tasks.filter((t) => t.status === "InProgress").length;

  const avgProgress = ws.tasks.length
    ? Math.round(ws.tasks.reduce((s, t) => s + (t.progressPercentage || 0), 0) / ws.tasks.length)
    : 0;

  const totalDocs = projectDocs.length;
  const totalTaskAttachments = ws.tasks.reduce((s, t) => s + (t.attachments?.length || 0), 0);

  // Utilization certificates have their own block above, so keep them out of
  // the plain document table to avoid showing the same file twice.
  const plainDocs = useMemo(
    () => projectDocs.filter((doc) => doc.category !== "UtilizationCertificate"),
    [projectDocs],
  );

  const uniqueAssignees = new Set<string>();
  for (const task of ws.tasks) {
    if (task.assignees?.length) {
      task.assignees.forEach((assignee) => {
        if (assignee.userId) uniqueAssignees.add(assignee.userId);
      });
    } else if (task.assignedToUserId) {
      uniqueAssignees.add(task.assignedToUserId);
    }
  }
  const totalTeamMembers = uniqueAssignees.size;

  const budgetUtilPct = ws.project?.plannedBudget
    ? Math.min(Math.round(((ws.project?.actualCost || 0) / ws.project.plannedBudget) * 100), 100)
    : 0;

  const budgetColor =
    budgetUtilPct > 100 ? "bg-red-500" :
      budgetUtilPct > 85 ? "bg-amber-500" :
        "bg-emerald-500";

  const cMilestones = ws.milestones.filter((m) => m.status === "Completed").length;
  const criticalMilestones = ws.milestones.filter((m) => m.isCritical).length;
  const blockedMilestones = ws.milestones.filter((m) => m.isBlocked).length;
  const depsMet = ws.dependencies.filter((d) => d.isMet).length;

  const sortedMilestones = useMemo(() => {
    if (ws.dependencies.length === 0) return ws.milestones;
    const deps = ws.dependencies;
    const mils = ws.milestones;
    const milestoneSet = new Set(mils.map(m => m.id));
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const m of mils) { adj.set(m.id, []); inDegree.set(m.id, 0); }
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
      for (const neighbor of adj.get(id) || []) { if (!visited.has(neighbor)) dfs(neighbor); }
    };
    for (const root of roots) dfs(root.id);
    for (const m of mils) if (!visited.has(m.id)) orderedIds.push(m.id);
    const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
    return [...mils].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [ws.milestones, ws.dependencies]);

  const filteredSortedMilestones = useMemo(
    () => sortedMilestones.filter((m) => m.name.toLowerCase().includes(sidebarSearch.toLowerCase())),
    [sortedMilestones, sidebarSearch]
  );

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [sidebarSearch]);

  const visibleSortedMilestones = useMemo(
    () => filteredSortedMilestones.slice(0, visibleCount),
    [filteredSortedMilestones, visibleCount]
  );

  const remaining = filteredSortedMilestones.length - visibleCount;

  const handleMilestoneClick = useCallback((m: Milestone) => {
    const idx = filteredSortedMilestones.findIndex((ms) => ms.id === m.id);
    if (idx >= PIN_THRESHOLD) {
      setSavedScrollPos(window.scrollY);
      setPinnedMilestone(m);
    } else {
      setPinnedMilestone(null);
      setSavedScrollPos(0);
    }
    navigate(`/projects/${ws.project!.id}/milestones`);
  }, [filteredSortedMilestones, navigate, ws.project]);

  const handleJumpBack = useCallback(() => {
    setPinnedMilestone(null);
    if (savedScrollPos > 0) window.scrollTo({ top: savedScrollPos, behavior: "smooth" });
    setSavedScrollPos(0);
  }, [savedScrollPos]);

  const handleDocUpload = async () => {
    if (!auth || !uploadFile || !ws.project) return;
    try {
      await api.uploadProjectDocument(auth.token, ws.project.id, uploadFile);
      setUploadFile(null);
      addToast("Document uploaded");
      const docs = await api.getProjectDocuments(auth.token, ws.project.id);
      setProjectDocs(docs);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  };

  const getMilestoneName = (id: string) => ws.milestones.find((m) => m.id === id)?.name || "Unknown";
  const getMilestoneProgress = (id: string) => ws.milestones.find((m) => m.id === id)?.progressPercentage || 0;
  const getMilestoneStatus = (id: string) => ws.milestones.find((m) => m.id === id)?.status || "";

  const sortedDeps = useMemo(() => {
    return [...ws.dependencies].sort((a, b) => {
      if (a.isMet !== b.isMet) return a.isMet ? 1 : -1;
      if (a.type !== b.type) return a.type === "CompletionBased" ? -1 : 1;
      return 0;
    });
  }, [ws.dependencies]);

  if (ws.loading) return <LoadingPage label="Loading project overview..." />;
  if (!ws.project) return <ProjectNotFound />;

  return (
    <div className="mb-15">
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

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ── Left Panel: Milestones Sidebar ── */}
        <aside className="space-y-3">
          <GlassCard className="p-4 flex flex-col relative">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="hi-flag" size={14} />
                Milestones
              </h3>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {sortedMilestones.length}
              </span>
            </div>

            <div className="relative mb-3 shrink-0">
              <Icon name="search" size={14} className="absolute left-2.5 top-1.5 text-slate-400" />
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow outline-none shadow-sm"
                placeholder="Filter milestones..."
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>

            <div ref={listRef} className="flex flex-col gap-0 flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* Timeline track */}
              <div className="relative ml-[11px]">
                {/* Vertical timeline line */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-slate-200" />

                {/* Pinned milestone */}
                {pinnedMilestone && (
                  <div className="relative pb-3">
                    {/* Checkpoint dot */}
                    <div className={`absolute left-0 top-3 -translate-x-1/2 z-10 w-3 h-3 rounded-full border-2 border-white shadow-sm ${pinnedMilestone.status === "Completed"
                        ? "bg-emerald-500"
                        : pinnedMilestone.status === "In Progress"
                          ? "bg-blue-500 ring-2 ring-blue-200"
                          : "bg-slate-300"
                      } ${pinnedMilestone.status !== "Completed" && new Date(pinnedMilestone.dueDate).getTime() < Date.now() ? "animate-pulse ring-2 ring-red-200" : ""}`} />

                    <div className="ml-5 relative">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${ws.project!.id}/milestones`)}
                        className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors group rounded-lg border border-indigo-100 bg-indigo-50/50"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                              <span
                                title={pinnedMilestone.name}
                                className="text-xs font-semibold text-slate-800 leading-snug break-words group-hover:text-indigo-600 transition-colors"
                              >
                                {pinnedMilestone.name}
                              </span>
                              {pinnedMilestone.isCritical && (
                                <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">CRITICAL</span>
                              )}
                              {pinnedMilestone.isBlocked && (
                                <Icon name="hi-ban" size={10} className="text-amber-500 shrink-0" />
                              )}
                            </div>

                            {/* Progress bar with checkpoints */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${pinnedMilestone.status === "Completed"
                                        ? "bg-emerald-500"
                                        : pinnedMilestone.status === "In Progress"
                                          ? "bg-blue-500"
                                          : "bg-slate-400"
                                      }`}
                                    style={{ width: `${pinnedMilestone.progressPercentage}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{pinnedMilestone.progressPercentage}%</span>
                              </div>

                              {/* Mini checkpoints */}
                              {/* <div className="flex gap-1">
                        {[25, 50, 75, 100].map((checkpoint) => (
                          <div
                            key={checkpoint}
                            className={`flex-1 h-0.5 rounded-full ${
                              pinnedMilestone.progressPercentage >= checkpoint 
                                ? "bg-indigo-400" 
                                : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div> */}
                            </div>

                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] text-slate-500">
                                {new Date(pinnedMilestone.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              {pinnedMilestone.status !== "Completed" && new Date(pinnedMilestone.dueDate).getTime() < Date.now() && (
                                <span className="text-[8px] font-bold text-red-500 animate-pulse">OVERDUE</span>
                              )}
                            </div>
                          </div>
                          <Icon name="chevron-right" size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0 mt-0.5" />
                        </div>
                      </button>
                      <span className="absolute -top-1 -right-1 text-[8px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full border border-indigo-200">
                        PINNED
                      </span>
                    </div>
                  </div>
                )}

                {/* Other milestones */}
                {visibleSortedMilestones.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 ml-5">
                    <Icon name="flag" size={24} className="mx-auto mb-2" />
                    <p className="text-xs font-medium">No milestones match filters</p>
                  </div>
                ) : (
                  visibleSortedMilestones.map((m, index) => {
                    const color = getStatusColor(m.status);
                    const due = new Date(m.dueDate).getTime();
                    const overdue = m.status !== "Completed" && due < Date.now();
                    const isLast = index === visibleSortedMilestones.length - 1 && remaining === 0;

                    return (
                      <div key={m.id} className={`relative ${!isLast ? "pb-2" : ""}`}>
                        {/* Checkpoint dot with connector */}
                        <div className="absolute left-0 top-3 -translate-x-1/2 z-10">
                          <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm transition-all ${m.status === "Completed"
                              ? "bg-emerald-500"
                              : m.status === "In Progress"
                                ? "bg-blue-500 ring-2 ring-blue-200"
                                : "bg-slate-300"
                            } ${overdue ? "animate-pulse ring-2 ring-red-200 bg-red-400" : ""}`} />
                        </div>

                        <div className="ml-5">
                          <button
                            type="button"
                            onClick={() => handleMilestoneClick(m)}
                            className="w-full text-left p-2 hover:bg-slate-50 transition-colors group rounded-lg"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  <span
                                    title={m.name}
                                    className="text-xs font-medium text-slate-700 leading-snug break-words group-hover:text-indigo-600 transition-colors"
                                  >
                                    {m.name}
                                  </span>
                                  {m.isCritical && (
                                    <span className="text-[8px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">!</span>
                                  )}
                                  {m.isBlocked && (
                                    <Icon name="hi-ban" size={10} className="text-amber-500 shrink-0" />
                                  )}
                                </div>

                                <div className="mt-1.5 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${m.status === "Completed"
                                            ? "bg-emerald-500"
                                            : m.status === "In Progress"
                                              ? "bg-blue-500"
                                              : "bg-slate-400"
                                          }`}
                                        style={{ width: `${m.progressPercentage}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-medium text-slate-500">{m.progressPercentage}%</span>
                                  </div>

                                  {/* Mini checkpoint indicators */}
                                  {/* <div className="flex gap-0.5">
                            {[25, 50, 75, 100].map((checkpoint) => (
                              <div
                                key={checkpoint}
                                className={`flex-1 h-0.5 rounded-full transition-colors ${
                                  m.progressPercentage >= checkpoint 
                                    ? "bg-indigo-400" 
                                    : "bg-slate-200"
                                }`}
                                title={`${checkpoint}% checkpoint`}
                              />
                            ))}
                          </div> */}
                                </div>

                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-slate-400">
                                    {new Date(m.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                  {overdue && (
                                    <span className="text-[8px] font-bold text-red-500">OVERDUE</span>
                                  )}
                                </div>
                              </div>
                              <Icon name="chevron-right" size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0 mt-0.5" />
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Load more button */}
                {remaining > 0 && (
                  <div className="relative pt-1 ml-5">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="w-full text-[10px] font-medium text-indigo-500 hover:text-indigo-700 py-1.5 px-2 rounded-md hover:bg-indigo-50 transition-colors border border-dashed border-indigo-200"
                    >
                      Show {Math.min(remaining, PAGE_SIZE)} more milestones ({remaining} remaining)
                    </button>
                  </div>
                )}

                {visibleCount > PAGE_SIZE && (
                  <div className="relative ml-5">
                    <button
                      type="button"
                      onClick={() => setVisibleCount(PAGE_SIZE)}
                      className="w-full text-[10px] font-medium text-slate-400 hover:text-slate-600 py-1.5 px-2 rounded-md hover:bg-slate-50 transition-colors"
                    >
                      Show less
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer stats */}
            <div className="shrink-0 mt-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>{cMilestones} / {sortedMilestones.length} completed</span>
                {criticalMilestones > 0 && (
                  <span className="text-rose-500 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-rose-400" />
                    {criticalMilestones} critical
                  </span>
                )}
              </div>
              {/* Overall progress */}
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${sortedMilestones.length > 0 ? (cMilestones / sortedMilestones.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Jump back button */}
            {savedScrollPos > 0 && createPortal(
              <button
                type="button"
                onClick={handleJumpBack}
                className="fixed bottom-4 z-50 size-9 flex items-center justify-center rounded-full bg-white border border-blue-200 shadow-lg text-blue-500 transition-all max-md:!left-auto max-md:right-4 animate-[bounce-glow_2.5s_ease-in-out_infinite]"
                style={{
                  left: 'calc(clamp(200px,25vw,240px) + 280px)',
                }}
                title="Back to previous position"
              >
                <Icon name="arrow-down" size={16} />
                <style>{`
          @keyframes bounce-glow {
            0%, 100% { 
              transform: translateY(0);
              box-shadow: 0 2px 8px rgba(59,130,246,0.15), 0 1px 3px rgba(0,0,0,0.08);
            }
            50% { 
              transform: translateY(-6px);
              box-shadow: 0 8px 25px rgba(59,130,246,0.35), 0 2px 8px rgba(59,130,246,0.2);
            }
          }
        `}</style>
              </button>,
              document.body
            )}
          </GlassCard>
        </aside>

        {/* ── Right Panel: Main Content ── */}
        <div className="space-y-5 min-w-0">

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total Tasks" value={ws.tasks.length} color="indigo" icon="hi-clipboard" />
            <KpiCard label="In Progress" value={inProgressCount} color="cyan" icon="clock" />
            <KpiCard label="Completed" value={completedCount} color="emerald" icon="check-circle" />
            <KpiCard label="Overdue" value={overdueCount} color="rose" icon="alert-circle" />
          </div>

          <OverviewAIInsights ws={ws} />

          {/* Task Distribution + Budget */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard className="p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="hi-chart-bar" size={16} className="text-indigo-500" />
                    Task Status
                  </h3>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400">Avg progress</span>
                    <span className="font-semibold text-slate-600">{avgProgress}%</span>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <TaskStatusDonut data={taskStatusData} />
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="hi-cash" size={16} className="text-emerald-500" />
                    Budget Overview
                  </h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ws.project.budgetVariance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    }`}>
                    {ws.project.budgetVariance >= 0 ? "Under" : "Over"} budget
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <BudgetBar
                  label="Planned Budget"
                  value={ws.project.plannedBudget}
                  max={ws.project.plannedBudget}
                  color="bg-indigo-500"
                />
                <BudgetBar
                  label="Actual Cost"
                  value={ws.project.actualCost}
                  max={ws.project.plannedBudget}
                  color={budgetColor}
                />
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Budget Variance</span>
                    <span className={`font-bold ${ws.project.budgetVariance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {ws.project.budgetVariance >= 0 ? "+" : ""}{formatLakhs(ws.project.budgetVariance)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-slate-500">Utilization</span>
                    <span className="font-semibold text-slate-700">{budgetUtilPct}%</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Milestone Timeline + Dependencies */}
          <div className="max-h-150 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard className="p-0 overflow-hidden  max-h-150 flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="timeline" size={16} className="text-amber-500" />
                    Milestone Timeline
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${ws.project!.id}/milestones`)}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                  >
                    View all
                    <Icon name="chevron-right" size={12} />
                  </button>
                </div>
              </div>
              <div className="p-5 flex-1 overflow-y-auto min-h-0">
                <MilestoneTimeline
                  milestones={sortedMilestones}
                  startDate={ws.project.plannedStartDate}
                  endDate={ws.project.plannedEndDate}
                  onNavigate={(id) => navigate(`/projects/${ws.project!.id}/milestones`)}
                />
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden max-h-150  flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="account_tree" size={16} className="text-cyan-500" />
                    Dependencies
                  </h3>
                  <span className="text-[10px] text-slate-400">{ws.dependencies.length} total</span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-2 gap-3 mb-3 shrink-0">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-lg font-bold text-emerald-600">{depsMet}</p>
                    <p className="text-[10px] text-emerald-700">Met</p>
                  </div>
                  <div className="rounded-xl  p-3 text-center">
                    <p className="text-lg font-bold text-amber-600">{ws.dependencies.length - depsMet}</p>
                    <p className="text-[10px] text-amber-700">Unmet</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 sidebar-scrollbar">
                  {sortedDeps.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Icon name="account_tree" size={24} className="mx-auto mb-2" />
                      <p className="text-xs text-slate-500">No dependencies</p>
                    </div>
                  ) : (
                    sortedDeps.map((dep: MilestoneDependency) => {
                      const prereqProgress = getMilestoneProgress(dep.prerequisiteMilestoneId);
                      const prereqStatus = getMilestoneStatus(dep.prerequisiteMilestoneId);
                      return (
                        <div
                          key={dep.id}
                          className={`p-2.5 rounded-lg border ${dep.isMet ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"
                            }`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon
                              name={dep.isMet ? "check-circle" : "warning"}
                              size={14}
                              className={`mt-0.5 shrink-0 ${dep.isMet ? "text-emerald-500" : "text-amber-500"}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-amber-700 truncate max-w-[130px]">
                                  {getMilestoneName(dep.prerequisiteMilestoneId)}
                                </span>
                                <span className="text-[9px] text-slate-400 shrink-0">blocks</span>
                                <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[130px]">
                                  {getMilestoneName(dep.dependentMilestoneId)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                {dep.type === "CompletionBased" ? (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${prereqStatus === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    }`}>
                                    Must complete{prereqStatus === "Completed" ? " ✓" : ""}
                                  </span>
                                ) : (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${prereqProgress >= (dep.thresholdPercentage || 0) ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                                    }`}>
                                    {prereqProgress}% / {dep.thresholdPercentage}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Team Assignment + Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlassCard className="p-0 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="hi-user-group" size={16} className="text-violet-500" />
                    Team Assignment
                  </h3>
                  <span className="text-[10px] text-slate-400">{totalTeamMembers} members</span>
                </div>
              </div>
              <div className="max-h-[320px] overflow-y-auto sidebar-scrollbar">
                {teamTaskCounts.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">No assigned tasks</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-[9px] text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Member</th>
                        <th className="text-center px-2 py-2 font-medium">Active</th>
                        <th className="text-center px-2 py-2 font-medium">Done</th>
                        <th className="text-center px-2 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {teamTaskCounts.map(({ userId, user, name, active, completed, total }) => (
                        <tr key={userId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar person={user} name={name} size="xs" />
                              <span className="font-medium text-slate-700 truncate max-w-[120px]">
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="text-center px-2 py-2 text-cyan-600 font-semibold">{active}</td>
                          <td className="text-center px-2 py-2 text-emerald-600 font-semibold">{completed}</td>
                          <td className="text-center px-2 py-2 text-slate-700 font-semibold">{total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-0 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Icon name="description" size={16} className="text-slate-500" />
                    Documents
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {totalDocs} project · {totalTaskAttachments} task
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-4">
                {/* Utilization Certificates get their own block: they carry finance
                    metadata and an approval lifecycle, not just a file. The
                    explainer is behind the ? icon so it is not always on screen. */}
                <UtilizationCertificates
                  projectId={ws.project?.id ?? ""}
                  milestones={ws.milestones}
                  tasks={ws.tasks}
                />

                {canUploadProjectDocs && (
                  <div className="flex items-center justify-end">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold cursor-pointer hover:bg-indigo-100 transition-colors border border-indigo-200">
                      <Icon name="upload" size={14} />
                      Upload Document
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                )}

                {uploadFile && (
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <Icon name="file" size={16} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{uploadFile.name}</p>
                        <p className="text-[10px] text-slate-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setUploadFile(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDocUpload}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                )}

                {loadingDocs ? (
                  <div className="text-center text-xs text-slate-400 py-4">Loading documents...</div>
                ) : plainDocs.length > 0 ? (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Icon name="hi-folder-open" size={12} />
                      Project Documents
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-[9px] text-slate-400 uppercase tracking-wider bg-slate-50/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Title</th>
                            <th className="text-right px-3 py-2 font-medium">Size</th>
                            <th className="text-right px-3 py-2 font-medium">Version</th>
                            <th className="text-right px-3 py-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {plainDocs.slice(0, 5).map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 font-medium text-slate-700">{doc.title}</td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {(doc.fileSizeBytes / 1024).toFixed(0)} KB
                              </td>
                              <td className="px-3 py-2 text-right text-slate-500">v{doc.version}</td>
                              <td className="px-3 py-2 text-right text-slate-500">
                                {new Date(doc.createdDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {plainDocs.length > 5 && (
                        <div className="text-center pt-2">
                          <span className="text-[10px] text-indigo-500 font-semibold">+{plainDocs.length - 5} more</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-400 py-2">No project documents</div>
                )}

                {totalTaskAttachments > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Icon name="hi-paper-clip" size={12} />
                      Task Attachments
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {ws.tasks.slice(0, 10).map((task) =>
                        (task.attachments || []).map((att) => (
                          <div
                            key={att.id}
                            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 flex items-center gap-1.5"
                          >
                            <Icon name="file" size={12} className="text-slate-400" />
                            <span className="truncate max-w-[120px]">{att.fileName}</span>
                          </div>
                        ))
                      )}
                      {totalTaskAttachments > 10 && (
                        <span className="text-[10px] text-slate-400 self-center">+{totalTaskAttachments - 10} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Escalated Tasks Alert */}
          {escalatedCount > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <Icon name="emergency" size={18} className="text-rose-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-800">{escalatedCount} Escalated Task{escalatedCount > 1 ? "s" : ""}</p>
                <p className="text-xs text-rose-600 mt-0.5">
                  {ws.tasks.filter((t) => t.isEscalated).slice(0, 3).map((t) => t.title).join(", ")}
                  {escalatedCount > 3 && ` +${escalatedCount - 3} more`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
