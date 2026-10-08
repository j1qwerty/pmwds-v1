import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import { onDataChanged } from "../../realtime";
import { REALTIME_SCOPES } from "../../realtimeScopes";
import type { BurnoutRiskRecord, Project, ProjectHealth, Task } from "../../types";
import { formatDate, formatPercent } from "../../lib/formatters";
import {
  GlassCard,
  LoadingPage,
  OrganizationDepartmentFilter,
  PERMISSION_GROUPS,
  useNavHeader,
  usePermission,
  useToast,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { StatsCards } from "./StatsCards";
import { ProjectList } from "./ProjectList";
import { HealthCard } from "./HealthCard";
import { RiskPredictionCard } from "./RiskPredictionCard";
import { TimelinePredictions } from "./TimelinePredictions";
import { AIRecommendations } from "./AIRecommendations";
import { BurnoutPanel } from "./BurnoutPanel";
import { AIChatPanel } from "./AIChatPanel";
import { NeuralHeatmap } from "./NeuralHeatmap";
import { AnomalyFeed } from "./AnomalyFeed";
import { calculateFallbackBurnout, calculateFallbackDelay, calculateFallbackProjectHealth } from "./aiCalculations";
import { AIInfoHint } from "./AIInfoHint";
import type { ChatResponse } from "./chatTypes";

export function AIPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const { data: appData } = useAppData();
  const { addToast } = useToast();
  const canViewOrganizations = perm.hasAny(PERMISSION_GROUPS.system.manage, PERMISSION_GROUPS.organization.view);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [escalated, setEscalated] = useState<Task[]>([]);
  const [burnout, setBurnout] = useState<BurnoutRiskRecord[]>([]);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [delay, setDelay] = useState<any>(null);
  const [provider, setProvider] = useState("OpenRouter");
  const [model, setModel] = useState("");
  const [chatPrompt, setChatPrompt] = useState("Summarize the highest operational risk in the current delivery portfolio.");
  const [chatResult, setChatResult] = useState<ChatResponse | null>(null);
  const [chatPending, setChatPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "AI Insights", description: "Neural analysis, predictions, and intelligent recommendations" });
  }, [setNavHeader]);

  const loadProjects = useCallback(async () => {
    if (!auth) return;
    const data = await api.getProjects(auth.token);
    setProjects(data);
    setSelectedProjectId((current) => current || data[0]?.id || "");
  }, [auth]);

  const loadMyTasks = useCallback(async () => {
    if (!auth) return;
    try {
      const response = await api.getMyTasks(auth.token);
      setMyTasks(response);
      setSelectedTaskId((current) => current || response[0]?.id || "");
    } catch {
      setMyTasks([]);
    }
  }, [auth]);

  const loadAISettings = useCallback(async () => {
    if (!auth) return;
    try {
      const settings = await api.getAISettings(auth.token);
      setProvider(settings.defaultProvider || "OpenRouter");
      setModel(settings.defaultModel || "");
    } catch {
      setProvider("OpenRouter");
      setModel("");
    }
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    let disposed = false;

    const load = async () => {
      setLoading(true);
      try {
        await loadProjects();
        if (disposed) return;
        await loadMyTasks();
        if (disposed) return;
        await loadAISettings();
      } catch (cause) {
        if (!disposed) {
          addToast(cause instanceof Error ? cause.message : "Failed to load AI project data", "error");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [auth, loadProjects, loadMyTasks, loadAISettings, addToast]);

  const visibleDepartments = useMemo(() => {
    return selectedOrganizationId
      ? appData.departments.filter((department) => department.organizationId === selectedOrganizationId)
      : appData.departments;
  }, [appData.departments, selectedOrganizationId]);

  const visibleProjects = useMemo(() => {
    if (selectedDepartmentId) {
      const departmentId = selectedDepartmentId;
      return projects.filter((project) =>
        (project.departmentIds ?? [project.departmentId]).includes(departmentId),
      );
    }

    if (selectedOrganizationId) {
      const departmentIds = new Set(visibleDepartments.map((department) => department.id));
      return projects.filter((project) =>
        (project.departmentIds ?? [project.departmentId]).some((departmentId) => departmentIds.has(departmentId)),
      );
    }

    return projects;
  }, [projects, selectedDepartmentId, selectedOrganizationId, visibleDepartments]);

  useEffect(() => {
    if (selectedDepartmentId && !visibleDepartments.some((department) => department.id === selectedDepartmentId)) {
      setSelectedDepartmentId("");
      setSelectedProjectId("");
      return;
    }

    if (selectedProjectId && !visibleProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(visibleProjects[0]?.id ?? "");
    }
  }, [selectedDepartmentId, selectedProjectId, visibleDepartments, visibleProjects]);

  const selectedProject = visibleProjects.find((project) => project.id === selectedProjectId) ?? null;

  const loadProjectTasks = useCallback(async () => {
    if (!auth || !selectedProjectId) {
      setProjectTasks([]);
      return;
    }

    setProjectTasks([]);
    try {
      const tasks = await api.getTasksByProject(auth.token, selectedProjectId);
      setProjectTasks(tasks);
      setSelectedTaskId((current) => {
        if (current && tasks.some((task) => task.id === current)) return current;
        return tasks[0]?.id || "";
      });
    } catch {
      setProjectTasks([]);
    }
  }, [auth, selectedProjectId]);

  useEffect(() => {
    void loadProjectTasks();
  }, [loadProjectTasks]);

  const fallbackHealth = useMemo(
    () => calculateFallbackProjectHealth(selectedProject, projectTasks, appData.users),
    [selectedProject, projectTasks, appData.users],
  );

  const fallbackDelay = useMemo(() => {
    const task =
      projectTasks.find((item) => item.id === selectedTaskId) ??
      myTasks.find((item) => item.id === selectedTaskId) ??
      null;
    return calculateFallbackDelay(task);
  }, [projectTasks, myTasks, selectedTaskId]);

  const fallbackBurnout = useMemo(
    () => calculateFallbackBurnout(appData.users, projectTasks.length ? projectTasks : myTasks, selectedDepartmentId || null),
    [appData.users, projectTasks, myTasks, selectedDepartmentId],
  );

  const loadAIProjectSignals = useCallback(async () => {
    if (!auth || !selectedProjectId) {
      setHealth(null);
      return;
    }

    try {
      setHealth(await api.getAiProjectHealth(auth.token, selectedProjectId));
    } catch {
      setHealth(null);
    }
  }, [auth, selectedProjectId]);

  const loadAITaskSignal = useCallback(async () => {
    if (!auth || !selectedTaskId) {
      setDelay(null);
      return;
    }

    try {
      setDelay(await api.getTaskDelay(auth.token, selectedTaskId));
    } catch {
      setDelay(null);
    }
  }, [auth, selectedTaskId]);

  const loadBurnout = useCallback(async () => {
    if (!auth) return;
    try {
      const result = await api.getAiBurnoutRisk(auth.token, selectedDepartmentId || null);
      setBurnout(result);
    } catch {
      setBurnout([]);
    }
  }, [auth, selectedDepartmentId]);

  useEffect(() => {
    void loadAIProjectSignals();
  }, [loadAIProjectSignals]);

  useEffect(() => {
    void loadAITaskSignal();
  }, [loadAITaskSignal]);

  useEffect(() => {
    void loadBurnout();
  }, [loadBurnout]);

  // Overdue + escalated feed the anomaly feed. Loaded once and reused rather
  // than only when the AI calls fail.
  useEffect(() => {
    if (!auth) return;
    api.getOverdueTasks(auth.token).then((t) => setOverdue(t as Task[])).catch(() => setOverdue([]));
    api.getEscalatedTasks(auth.token).then((t) => setEscalated(t as Task[])).catch(() => setEscalated([]));
  }, [auth]);

  useEffect(() => {
    if (!auth) return;

    let timer: number | undefined;
    const stop = onDataChanged((change) => {
      const scope = change.scope;
      if (
        scope !== REALTIME_SCOPES.projects &&
        scope !== REALTIME_SCOPES.tasks &&
        scope !== REALTIME_SCOPES.milestones &&
        scope !== REALTIME_SCOPES.users &&
        scope !== REALTIME_SCOPES.departments
      ) {
        return;
      }

      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          // Refresh only the slice affected by the event. The old handler fired five
          // independent reads for every change, which created a burst of database work on
          // busy workspaces even though most of the results were unchanged.
          if (scope === REALTIME_SCOPES.projects) {
            await loadProjects();
            await loadAIProjectSignals();
            return;
          }

          if (scope === REALTIME_SCOPES.users || scope === REALTIME_SCOPES.departments) {
            await loadBurnout();
            return;
          }

          await loadProjectTasks();
          await loadAIProjectSignals();
          await loadAITaskSignal();
          if (scope === REALTIME_SCOPES.milestones) {
            await loadBurnout();
          }
        })().catch(() => undefined);
      }, 250);
    });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      stop();
    };
  }, [auth, loadProjects, loadProjectTasks, loadAIProjectSignals, loadAITaskSignal, loadBurnout]);

  const effectiveHealth = health ?? fallbackHealth;
  const effectiveDelay = delay ?? fallbackDelay;
  const effectiveBurnout = burnout.length ? burnout : fallbackBurnout;

  const handleChat = async () => {
    if (!auth || !chatPrompt.trim()) return;
    setChatPending(true);
    try {
      const result = await api.chat(auth.token, chatPrompt, provider, model);
      setChatResult(result);
    } catch (cause) {
      // Surface the real reason inline. Replacing every failure with a generic
      // line gave the user nothing to act on.
      setChatResult({
        message:
          cause instanceof Error && cause.message
            ? cause.message
            : "The AI provider could not be reached. Check the API key, provider, and model in AI Settings.",
        intent: "error",
      });
    } finally {
      setChatPending(false);
    }
  };

  if (loading) return <LoadingPage label="Loading AI insights..." />;

  return (
    <div>
      <div className="relative z-10 mb-5">
        <OrganizationDepartmentFilter
          organizations={canViewOrganizations ? appData.organizations : []}
          departments={appData.departments}
          users={appData.users}
          selectedOrganizationId={selectedOrganizationId}
          selectedDepartmentId={selectedDepartmentId}
          onOrganizationChange={(organizationId) => {
            setSelectedOrganizationId(organizationId);
            setSelectedDepartmentId("");
            setSelectedProjectId("");
          }}
          onDepartmentChange={(departmentId) => {
            setSelectedDepartmentId(departmentId);
            setSelectedProjectId("");
          }}
        />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6">
        <div className="flex flex-col gap-5 lg:max-h-150">
          <ProjectList
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />

          <AnomalyFeed projects={visibleProjects} overdue={overdue} escalated={escalated} />
        </div>

        <div className="flex flex-col gap-5">
          <StatsCards health={effectiveHealth} burnout={effectiveBurnout} delay={effectiveDelay} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HealthCard project={selectedProject} health={health} fallbackHealth={fallbackHealth} />
            <RiskPredictionCard health={health} fallbackHealth={fallbackHealth} />
          </div>

          <NeuralHeatmap project={selectedProject} tasks={projectTasks} users={appData.users} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TimelinePredictions projects={visibleProjects} />
            <AIRecommendations
              project={selectedProject}
              health={effectiveHealth}
              tasks={projectTasks}
              burnout={effectiveBurnout}
            />
          </div>

          <AIChatPanel
            chatPrompt={chatPrompt}
            setChatPrompt={setChatPrompt}
            chatResult={chatResult}
            onChat={handleChat}
            pending={chatPending}
            provider={provider}
            model={model}
          />
        </div>

        <div className="flex flex-col gap-5">
          <GlassCard className="p-5 border border-amber-100/50">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Icon name="speed" size={18} className="text-amber-500" />
                <h4 className="text-sm font-bold text-slate-800">Delay Prediction</h4>
              </div>
              <AIInfoHint title="Task delay prediction">
                Delay probability uses the selected task's progress, start date, due date, overdue state, and escalation state. The live-data fallback projects completion from the current delivery rate.
              </AIInfoHint>
            </div>
            {effectiveDelay ? (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Probability</span>
                    <span className="font-bold text-amber-600">{formatPercent(effectiveDelay.delayProbability * 100)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full" style={{ width: Math.min(effectiveDelay.delayProbability * 100, 100) + "%" }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk Level</span>
                  <span className="font-semibold text-slate-700">{effectiveDelay.riskLevel || "Low"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Predicted Completion</span>
                  <span className="font-semibold text-slate-700">{formatDate(effectiveDelay.predictedCompletionDate)}</span>
                </div>
                {effectiveDelay.contributingFactors?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {effectiveDelay.contributingFactors.map((factor: string) => (
                      <span key={factor} className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100">{factor}</span>
                    ))}
                  </div>
                )}
                {!delay && <p className="text-[9px] text-amber-500">Calculated from current task data because AI prediction was unavailable.</p>}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">Select a task with delivery data.</div>
            )}
          </GlassCard>

          <BurnoutPanel burnout={burnout} fallbackBurnout={fallbackBurnout} />
        </div>
      </div>
    </div>
  );
}
