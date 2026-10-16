import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { useAppData } from "../../appData";
import { useAuth } from "../../auth";
import type { BurnoutRiskRecord, ProjectAiCapabilities, ProjectHealth } from "../../types";
import { formatDate, formatMoney, formatPercent } from "../../lib/formatters";
import { EmptyState, GlassCard, LoadingPage, useNavHeader } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { StatsCards } from "../ai/StatsCards";
import { HealthCard } from "../ai/HealthCard";
import { RiskPredictionCard } from "../ai/RiskPredictionCard";
import { NeuralHeatmap } from "../ai/NeuralHeatmap";
import { TimelinePredictions } from "../ai/TimelinePredictions";
import { AIRecommendations } from "../ai/AIRecommendations";
import { AIChatPanel } from "../ai/AIChatPanel";
import { AnomalyFeed } from "../ai/AnomalyFeed";
import { BurnoutPanel } from "../ai/BurnoutPanel";
import { DelayPredictionCard } from "../ai/DelayPredictionCard";
import { calculateFallbackBurnout, calculateFallbackDelay, calculateFallbackProjectHealth } from "../ai/aiCalculations";
import type { ChatResponse } from "../ai/chatTypes";
import { useProjectWorkspace } from "./useProjectWorkspace";
import { ProjectNotFound } from "./ProjectNotFound";

type CapabilityState = "loading" | "ready" | "denied";

const CLOSED_STATUSES = new Set(["Completed", "Cancelled"]);

/**
 * AI Insights tab for a single project.
 *
 * It reuses the portfolio AI page's panels, narrowed to this project and to what the
 * signed-in person may see of it. The capability flags come from the server
 * (`GET ai/project/{id}/capabilities`), the same flags the server uses to build the
 * assistant's data, so a section that is hidden here is also absent from what the
 * assistant is told. A panel is drawn only when the data behind it is permitted.
 */
export function ProjectAIPage() {
  const { projectId } = useParams<{ projectId: string }>();
  // Keyed by project so switching projects starts clean: no stale conversation,
  // capability flags or predictions from the previous project.
  return <ProjectAIPageContent key={projectId} />;
}

function ProjectAIPageContent() {
  const ws = useProjectWorkspace();
  const { auth } = useAuth();
  const { data: appData } = useAppData();
  const { setNavHeader } = useNavHeader();

  const project = ws.project;
  const projectId = project?.id ?? "";

  const [capsState, setCapsState] = useState<CapabilityState>("loading");
  const [caps, setCaps] = useState<ProjectAiCapabilities | null>(null);
  const [healthResult, setHealthResult] = useState<ProjectHealth | null>(null);
  const [delayResult, setDelayResult] = useState<{
    taskId: string;
    data: Awaited<ReturnType<typeof api.getTaskDelay>> | null;
  } | null>(null);
  const [burnoutResult, setBurnoutResult] = useState<BurnoutRiskRecord[]>([]);
  const [pickedTaskId, setPickedTaskId] = useState("");
  const [provider, setProvider] = useState("OpenRouter");
  const [model, setModel] = useState("");
  const [chatPrompt, setChatPrompt] = useState("Summarize the biggest risk in this project.");
  const [chatResult, setChatResult] = useState<ChatResponse | null>(null);
  const [chatPending, setChatPending] = useState(false);

  useEffect(() => {
    setNavHeader({
      title: project ? `AI Insights · ${project.name}` : "AI Insights",
      description: "Predictions and recommendations for this project, limited to what your role can see",
    });
  }, [setNavHeader, project]);

  useEffect(() => {
    if (!auth || !projectId) return;
    let cancelled = false;
    api
      .getAiProjectCapabilities(auth.token, projectId)
      .then((result) => {
        if (cancelled) return;
        setCaps(result);
        setCapsState(result.ai ? "ready" : "denied");
      })
      .catch(() => {
        if (!cancelled) setCapsState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [auth, projectId]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    api
      .getAISettings(auth.token)
      .then((settings) => {
        if (cancelled) return;
        setProvider(settings.defaultProvider || "OpenRouter");
        setModel(settings.defaultModel || "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Only tasks the person is allowed to see reach any panel.
  const canTasks = caps?.tasks ?? false;
  const canPeople = caps?.people ?? false;
  const canBudget = caps?.budget ?? false;
  const wsTasks = ws.tasks;
  const tasks = useMemo(() => (canTasks ? wsTasks : []), [canTasks, wsTasks]);

  const projectManagerId = project?.projectManagerId;
  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of tasks) {
      if (task.assignedToUserId) ids.add(task.assignedToUserId);
      for (const assignee of task.assignees ?? []) ids.add(assignee.userId);
    }
    if (projectManagerId) ids.add(projectManagerId);
    return ids;
  }, [tasks, projectManagerId]);

  const participants = useMemo(
    () => (canPeople ? appData.users.filter((user) => participantIds.has(user.id)) : []),
    [canPeople, appData.users, participantIds],
  );

  const openTasks = useMemo(() => tasks.filter((task) => !CLOSED_STATUSES.has(task.status)), [tasks]);

  // Default the delay prediction to the task most likely to slip; the person can pick another.
  const selectedTaskId = useMemo(() => {
    if (tasks.length === 0) return "";
    if (pickedTaskId && tasks.some((task) => task.id === pickedTaskId)) return pickedTaskId;
    const pool = openTasks.length > 0 ? openTasks : tasks;
    return [...pool].sort((x, y) => (y.aiDelayProbability ?? 0) - (x.aiDelayProbability ?? 0))[0].id;
  }, [tasks, openTasks, pickedTaskId]);

  // Re-fetch AI signals when the work itself changes, not on every workspace refresh.
  const workKey = `${tasks.length}:${openTasks.length}:${Math.round(project?.progressPercentage ?? 0)}`;

  const canReadHealth = caps?.fullProjectDetails ?? false;
  useEffect(() => {
    if (!auth || !projectId || !canReadHealth) return;
    let cancelled = false;
    api
      .getAiProjectHealth(auth.token, projectId)
      .then((result) => {
        if (!cancelled) setHealthResult(result);
      })
      .catch(() => {
        if (!cancelled) setHealthResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, projectId, canReadHealth, workKey]);

  useEffect(() => {
    if (!auth || !selectedTaskId || !canTasks) return;
    let cancelled = false;
    api
      .getTaskDelay(auth.token, selectedTaskId)
      .then((data) => {
        if (!cancelled) setDelayResult({ taskId: selectedTaskId, data });
      })
      .catch(() => {
        if (!cancelled) setDelayResult({ taskId: selectedTaskId, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [auth, selectedTaskId, canTasks, workKey]);

  useEffect(() => {
    if (!auth || !canPeople) return;
    let cancelled = false;
    api
      .getAiBurnoutRisk(auth.token, null)
      .then((records) => {
        // The endpoint covers everyone the person may see; this tab is one project.
        if (!cancelled) setBurnoutResult(records.filter((record) => participantIds.has(record.userId)));
      })
      .catch(() => {
        if (!cancelled) setBurnoutResult([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, canPeople, participantIds]);

  // Results are only used while the matching permission and selection still hold, so a
  // stale value from an earlier selection can never be shown.
  const health = canReadHealth ? healthResult : null;
  const delay = delayResult && delayResult.taskId === selectedTaskId && canTasks ? delayResult.data : null;
  const burnout = canPeople ? burnoutResult : [];

  const fallbackHealth = useMemo(
    () => (canBudget ? calculateFallbackProjectHealth(project, tasks, participants) : null),
    [canBudget, project, tasks, participants],
  );
  const fallbackDelay = useMemo(
    () => calculateFallbackDelay(tasks.find((task) => task.id === selectedTaskId) ?? null),
    [tasks, selectedTaskId],
  );
  const fallbackBurnout = useMemo(
    () => (canPeople ? calculateFallbackBurnout(participants, tasks, null) : []),
    [canPeople, participants, tasks],
  );

  const effectiveHealth = canBudget ? (health ?? fallbackHealth) : null;
  const effectiveDelay = canTasks ? (delay ?? fallbackDelay) : null;
  const effectiveBurnout = canPeople ? (burnout.length ? burnout : fallbackBurnout) : [];

  // Without budget access the recommendations must not be able to mention cost.
  const recommendationProject = useMemo(
    () => (project && !canBudget ? { ...project, plannedBudget: 0, actualCost: 0, budgetVariance: 0 } : project),
    [project, canBudget],
  );

  const overdue = useMemo(() => openTasks.filter((task) => task.isOverdue), [openTasks]);
  const escalated = useMemo(() => tasks.filter((task) => task.isEscalated), [tasks]);

  const suggestions = useMemo(() => {
    if (!caps) return [];
    return [
      "Tell me about this project",
      "What is delayed or at risk?",
      caps.tasks ? "Show my open tasks" : null,
      caps.milestones ? "List the milestones" : null,
      caps.people ? "Who is overloaded?" : null,
      caps.documents ? "Show me the documents" : null,
      caps.budget ? "How is the budget?" : null,
    ].filter((item): item is string => item !== null);
  }, [caps]);

  const hiddenAreas = useMemo(() => {
    if (!caps) return [];
    const hidden: string[] = [];
    if (!caps.tasks) hidden.push("tasks");
    if (!caps.milestones) hidden.push("milestones");
    if (!caps.documents) hidden.push("documents");
    if (!caps.people) hidden.push("team workload");
    if (!caps.budget) hidden.push("budget and health scores");
    return hidden;
  }, [caps]);

  const handleChat = async () => {
    if (!auth || !projectId || !chatPrompt.trim()) return;
    setChatPending(true);
    try {
      setChatResult(await api.chat(auth.token, chatPrompt, provider, model, projectId));
    } catch (cause) {
      const denied = cause instanceof ApiError && cause.status === 403;
      setChatResult({
        message: denied
          ? "Your role doesn't have access to AI insights for this project."
          : cause instanceof Error && cause.message
            ? cause.message
            : "The AI provider could not be reached. Check the API key, provider, and model in AI Settings.",
        intent: denied ? "access" : "error",
      });
    } finally {
      setChatPending(false);
    }
  };

  if (ws.loading || (project && capsState === "loading")) return <LoadingPage label="Loading AI insights..." />;
  if (!project) return <ProjectNotFound />;

  if (capsState === "denied" || !caps) {
    return (
      <div className="relative z-10 mb-15">
        <GlassCard className="p-5">
          <EmptyState
            icon="lock"
            title="AI insights aren't available to your role"
            description="Ask an administrator to grant AI access if you need insights for this project."
            accent="neutral"
          />
        </GlassCard>
      </div>
    );
  }

  const showHealth = caps.budget;
  const showHeatmap = caps.tasks && caps.people;
  const rightColumnHasContent = caps.tasks || caps.people;

  return (
    <div className="relative z-10 mb-15 flex flex-col gap-5">
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-800 truncate">{project.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {project.projectCode}
              {project.departmentName ? ` · ${project.departmentName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {project.status}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {project.priority} priority
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Progress</span>
            <span className="font-bold text-slate-700">{formatPercent(project.progressPercentage)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
              style={{ width: Math.min(Math.max(project.progressPercentage, 0), 100) + "%" }}
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs">
          <Fact label="Planned start" value={formatDate(project.plannedStartDate)} />
          <Fact label="Planned end" value={formatDate(project.plannedEndDate)} />
          <Fact label="Project manager" value={project.projectManagerName || "Not set"} />
          {caps.tasks && <Fact label="Open tasks" value={`${openTasks.length} of ${tasks.length}`} />}
          {caps.tasks && <Fact label="Overdue tasks" value={String(overdue.length)} />}
          {caps.milestones && <Fact label="Milestones" value={String(ws.milestones.length)} />}
          {caps.budget && <Fact label="Budget used" value={`${formatMoney(project.actualCost)} of ${formatMoney(project.plannedBudget)}`} />}
        </dl>

        {hiddenAreas.length > 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
            <Icon name="lock" size={14} className="mt-px shrink-0 text-slate-400" />
            <span>
              Your role limits this tab. {hiddenAreas.join(", ")} {hiddenAreas.length === 1 ? "is" : "are"} hidden,
              and the assistant answers only from what you can see.
            </span>
          </p>
        )}
      </GlassCard>

      <div className={`grid grid-cols-1 gap-6 ${rightColumnHasContent ? "xl:grid-cols-[minmax(0,1fr)_clamp(16rem,22vw,20rem)]" : ""}`}>
        <div className="flex flex-col gap-5 min-w-0">
          <StatsCards health={effectiveHealth} burnout={effectiveBurnout} delay={effectiveDelay} />

          {showHealth && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <HealthCard project={project} health={health} fallbackHealth={fallbackHealth} />
              <RiskPredictionCard health={health} fallbackHealth={fallbackHealth} />
            </div>
          )}

          {showHeatmap && <NeuralHeatmap project={project} tasks={tasks} users={participants} />}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TimelinePredictions projects={[project]} />
            <AIRecommendations
              project={recommendationProject}
              health={effectiveHealth}
              tasks={tasks}
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
            suggestions={suggestions}
            placeholder="Ask about this project..."
            dataScopeNote="The assistant is given only this project, limited to the tasks, milestones, documents and people your role can see."
          />
        </div>

        {rightColumnHasContent && (
          <div className="flex flex-col gap-5 min-w-0">
            {caps.tasks && <AnomalyFeed projects={[project]} overdue={overdue} escalated={escalated} />}
            {caps.tasks && (
              <DelayPredictionCard
                delay={effectiveDelay}
                fromServer={!!delay}
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setPickedTaskId}
              />
            )}
            {caps.people && <BurnoutPanel burnout={burnout} fallbackBurnout={fallbackBurnout} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-700 truncate">{value}</dd>
    </div>
  );
}
