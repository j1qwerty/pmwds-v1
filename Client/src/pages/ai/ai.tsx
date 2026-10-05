import { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { BurnoutRiskRecord, Department, OrganizationRecord, Project, ProjectHealth } from "../../types";
import { formatPercent, formatDate } from "../../ui";
import { AnimatedBackground, useNavHeader, GlassCard, LoadingPage, OrganizationDepartmentFilter, PERMISSION_GROUPS, getProjectDepartmentIds, projectBelongsToDepartment, usePermission, BgRenderer } from "../shared";
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

export function AIPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const canViewOrganizations = perm.hasAny(PERMISSION_GROUPS.system.manage, PERMISSION_GROUPS.organization.view);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [burnout, setBurnout] = useState<BurnoutRiskRecord[]>([]);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [delay, setDelay] = useState<any>(null);
  const [provider, setProvider] = useState("OpenRouter");
  const [model, setModel] = useState("");
  const [chatPrompt, setChatPrompt] = useState("Summarize the highest operational risk in the current delivery portfolio.");
  const [chatResult, setChatResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "AI Insights", description: "Neural analysis, predictions, and intelligent recommendations" });
  }, [setNavHeader]);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    Promise.all([
      api.getProjects(auth.token),
      api.getDepartments(auth.token),
      canViewOrganizations ? api.getOrganizations(auth.token) : Promise.resolve([]),
      api.getMyTasks(auth.token),
      api.getAISettings(auth.token),
    ]).then(([projectData, departmentData, organizationData, taskData, settings]) => {
      setProjects(projectData);
      setDepartments(departmentData);
      setOrganizations(organizationData);
      setProvider(settings.defaultProvider || "OpenRouter");
      setModel(settings.defaultModel || "");
      if (projectData[0]) setSelectedProjectId(projectData[0].id);
      if (taskData[0]) setSelectedTaskId(taskData[0].id);
    }).finally(() => setLoading(false));
  }, [auth, canViewOrganizations]);

  useEffect(() => {
    if (!auth) return;
    api.getAiBurnoutRisk(auth.token, selectedDepartmentId || null)
      .then(setBurnout)
      .catch(() => setBurnout([]));
  }, [auth, selectedDepartmentId]);

  const visibleDepartments = useMemo(() => {
    return selectedOrganizationId
      ? departments.filter((department) => department.organizationId === selectedOrganizationId)
      : departments;
  }, [departments, selectedOrganizationId]);

  const visibleProjects = useMemo(() => {
    if (selectedDepartmentId) {
      return projects.filter((project) => projectBelongsToDepartment(project, selectedDepartmentId));
    }

    if (selectedOrganizationId) {
      const departmentIds = new Set(visibleDepartments.map((department) => department.id));
      return projects.filter((project) => getProjectDepartmentIds(project).some((departmentId) => departmentIds.has(departmentId)));
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

  useEffect(() => {
    if (!auth || !selectedProjectId) return;
    api.getAiProjectHealth(auth.token, selectedProjectId).then(setHealth).catch(() => setHealth(null));
  }, [auth, selectedProjectId]);

  useEffect(() => {
    if (!auth || !selectedTaskId) return;
    api.getTaskDelay(auth.token, selectedTaskId).then(setDelay).catch(() => setDelay(null));
  }, [auth, selectedTaskId]);

  const handleChat = async () => {
    if (!auth) return;
    try {
      const result = await api.chat(auth.token, chatPrompt, provider, model);
      setChatResult(result);
    } catch (e) {
      setChatResult({ message: "Failed to get AI response", intent: "error" });
    }
  };

  const selectedProject = visibleProjects.find(p => p.id === selectedProjectId) ?? null;

  if (loading) return <LoadingPage label="Loading AI insights..." />;

  return (
    <div>
      {/* <AnimatedBackground /> */}
      {/* <BgRenderer
        config={{
          gradient: { enabled: true, type: "radial", color1: "#4F46E5", color2: "#27cbec", color3: "#A855F7", angle: 0, opacity: 0.15 },
          patterns: {
            hexagons: { enabled: true, color: "#4F46E5", opacity: 0.21, size: 120, strokeWidth: 0.3 },
            grid: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5 },
            dots: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5 },
            diagonal: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5, angle: 45 },
            crosshatch: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5, angle: 45 },
            rings: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5 },
            diamonds: { enabled: false, color: "#4F46E5", opacity: 0.3, size: 40, strokeWidth: 0.5 },
          },
          waves: { enabled: false, color: "#4F46E5", opacity: 0.2, amplitude: 15, frequency: 2, speed: 1, count: 3 },
          blobs: { enabled: true, color1: "#4F46E5", color2: "#7C3AED", opacity: 0.12, count: 3, animation: "float", speed: 1, size: 1 },
        }}
      /> */}




      <div className="relative z-10 mb-5">
        <OrganizationDepartmentFilter
          organizations={organizations}
          departments={departments}
          users={[]}
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

      {/* Main Grid Layout */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6">

        {/* Left Sidebar: Projects (Agents) */}
        <div className="flex flex-col gap-5 lg:max-h-150">
          <ProjectList
            projects={visibleProjects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />

          {/* System Load Card */}
          <GlassCard className="p-4 border border-indigo-100/30">
            <div className="flex items-center gap-2 mb-3 text-indigo-600">
              <Icon name="bolt" size={18} />
              <span className="text-[11px] font-bold uppercase tracking-wider">System Load</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="w-1/4 h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"></div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400 uppercase">Compute Unit B-12</span>
              <span className="text-xs font-bold text-indigo-600">24%</span>
            </div>
          </GlassCard>

          {/* Anomaly Feed */}
          <AnomalyFeed />
        </div>

        {/* Center: Main Content */}
        <div className="flex flex-col gap-5">
          {/* Stats Cards */}
          <StatsCards health={health} burnout={burnout} delay={delay} />

          {/* Health & Risk Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <HealthCard
              project={selectedProject}
              health={health}
            // projects={projects}
            // selectedProjectId={selectedProjectId}
            // onProjectChange={setSelectedProjectId}
            />
            <RiskPredictionCard health={health} />
          </div>

          {/* Neural Heatmap */}
          <NeuralHeatmap project={selectedProject} />

          {/* Timeline & Recommendations Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TimelinePredictions projects={visibleProjects} />
            <AIRecommendations />
          </div>

          {/* AI Chat */}
          <AIChatPanel
            chatPrompt={chatPrompt}
            setChatPrompt={setChatPrompt}
            chatResult={chatResult}
            onChat={handleChat}
          />
        </div>

        {/* Right Sidebar: Details & Burnout */}
        <div className="flex flex-col gap-5">
          {/* Task Delay Prediction */}
          {delay && (
            <GlassCard className="p-5 border border-amber-100/50">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="speed" size={18} className="text-amber-500" />
                <h4 className="text-sm font-bold text-slate-800">Delay Prediction</h4>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Probability</span>
                    <span className="font-bold text-amber-600">{formatPercent(delay.delayProbability * 100)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full"
                      style={{ width: `${Math.min(delay.delayProbability * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk Level</span>
                  <span className="font-semibold text-slate-700">{delay.riskLevel || "N/A"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Predicted Completion</span>
                  <span className="font-semibold text-slate-700">{formatDate(delay.predictedCompletionDate)}</span>
                </div>
                {delay.contributingFactors?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {delay.contributingFactors.map((factor: string) => (
                      <span key={factor} className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100">
                        {factor}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          )}

          {/* Burnout Risk Panel */}
          <BurnoutPanel burnout={burnout} />

          {/* Upgrade CTA */}
          <GlassCard className="p-5 border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-400/20 to-violet-400/20 rounded-full blur-2xl"></div>
            <h5 className="text-xs font-bold text-slate-800 mb-2 relative">Advance Neural Engine</h5>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed relative">
              Unlock Tier-3 predictive modeling for enterprise projects.
            </p>
            <button className="w-full py-2.5 bg-indigo-600 text-white border border-indigo-600 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition-all shadow-sm relative">
              Upgrade Agent
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
