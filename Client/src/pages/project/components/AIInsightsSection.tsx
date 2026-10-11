import { OverallProgressRing } from "../../shared/index";
import type { Project, User } from "../../../types";
import { Icon } from "../../../components/ui/Icon";

interface AIInsightsSectionProps {
  project: Project;
  progress: number;
  healthScore: number | null;
  delayRisk: number | null;
  manager: User | undefined;
  formatMoney: (amount: number) => string;
}

export function AIInsightsSection({
  project,
  progress,
  healthScore,
  delayRisk,
}: AIInsightsSectionProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
          <Icon name="auto_awesome" size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800">AI insights</h3>
          <p className="text-[11px] text-slate-500">Estimated signals derived from project data</p>
        </div>
        <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">Powered by AI</span>
      </div>

      {/* Progress ring & key metrics */}
      <div className="flex items-start gap-4">
        <OverallProgressRing progress={progress} project={project} delayRisk={delayRisk} healthScore={healthScore} />
      </div>

      {/* Health matrix */}
      <ProjectHealthMatrix project={project} />
    </div>
  );
}

function ProjectHealthMatrix({ project }: { project: Project }) {
  const calculateEstimatedHealth = () => {
    const pct = project.progressPercentage || 0;
    const risk = project.aiDelayRiskScore || 0;
    const budgetRatio = project.plannedBudget
      ? (project.actualCost || 0) / project.plannedBudget
      : 0;

    return [
      {
        label: "Schedule",
        value: Math.max(0, Math.min(1, (pct / 100) * 0.7 + (1 - risk) * 0.3)),
        icon: "calendar_today",
      },
      {
        label: "Budget",
        value: Math.max(0, Math.min(1, budgetRatio <= 1 ? 1 - budgetRatio * 0.5 : Math.max(0, 1.5 - budgetRatio))),
        icon: "account_balance",
      },
      {
        label: "Team",
        value: 0.75,
        icon: "groups",
      },
      {
        label: "Quality",
        value: Math.max(0, Math.min(1, pct > 0 ? 0.5 + pct / 200 : 0.5)),
        icon: "verified_user",
      },
    ];
  };

  const metrics = calculateEstimatedHealth();

  const getHealthColor = (value: number) => {
    if (value >= 0.8) return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-500", label: "Good" };
    if (value >= 0.6) return { dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-400", label: "Fair" };
    return { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-500", label: "At risk" };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="insights" size={16} className="text-indigo-600" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Health matrix</span>
        <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Estimated</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((item) => {
          const healthColor = getHealthColor(item.value);
          return (
            <div
              key={item.label}
              className="p-3.5 bg-white rounded-xl border border-slate-100 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Icon name={item.icon} size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-600">{item.label}</span>
                </div>
                <div className={`size-2 rounded-full ${healthColor.dot}`} />
              </div>

              <div className="flex items-end justify-between mb-2">
                <span className="text-xl font-bold tracking-tight text-slate-800">
                  {Math.round(item.value * 100)}%
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${healthColor.text}`}>
                  {healthColor.label}
                </span>
              </div>

              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${healthColor.bg}`}
                  style={{ width: `${item.value * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI disclaimer */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
        <Icon name="auto_awesome" size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-amber-800 mb-0.5">AI health metrics coming soon</p>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            Currently showing estimates based on project progress, budget, and timeline data.
          </p>
        </div>
      </div>
    </div>
  );
}
