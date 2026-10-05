import type { Project, ProjectHealth } from "../../types";
import { formatPercent } from "../../ui";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface HealthCardProps {
  project: Project | null;
  health: ProjectHealth | null;
}

export function HealthCard({ project, health }: HealthCardProps) {
  // Use health data if available, otherwise generate dummy data
  const healthData = health || {
    overallHealthScore: 0.88,
    scheduleHealth: 0.82,
    budgetHealth: 0.76,
    teamHealth: 0.91,
  };

  const hasRealData = !!health;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="monitoring" size={20} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">
            {project?.name || "Project"} Health
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasRealData ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500'}`}></span>
          {!hasRealData && (
            <span className="text-[9px] text-amber-500 font-medium">Sample Data</span>
          )}
        </div>
      </div>

      {/* Overall Health Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500">Overall Health Score</span>
          <span className="font-bold text-emerald-600">
            {formatPercent(healthData.overallHealthScore)}
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((healthData.overallHealthScore || 0) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniHealthMetric 
          label="Schedule" 
          value={formatPercent(healthData.scheduleHealth)} 
          color="indigo"
          subtext={healthData.scheduleHealth > 0.8 ? "On Track" : healthData.scheduleHealth > 0.6 ? "At Risk" : "Delayed"}
        />
        <MiniHealthMetric 
          label="Budget" 
          value={formatPercent(healthData.budgetHealth)} 
          color="emerald"
          subtext={healthData.budgetHealth > 0.8 ? "Within Budget" : healthData.budgetHealth > 0.6 ? "Warning" : "Over Budget"}
        />
        <MiniHealthMetric 
          label="Team" 
          value={formatPercent(healthData.teamHealth)} 
          color="violet"
          subtext={healthData.teamHealth > 0.8 ? "Strong" : healthData.teamHealth > 0.6 ? "Stable" : "Stressed"}
        />
      </div>

      {/* Health Indicators */}
      <div className="space-y-2">
        <HealthIndicator 
          label="Schedule Variance" 
          value={healthData.scheduleHealth} 
          color={healthData.scheduleHealth > 0.8 ? "emerald" : healthData.scheduleHealth > 0.6 ? "amber" : "red"} 
        />
        <HealthIndicator 
          label="Budget Utilization" 
          value={healthData.budgetHealth} 
          color={healthData.budgetHealth > 0.8 ? "emerald" : healthData.budgetHealth > 0.6 ? "amber" : "red"} 
        />
        <HealthIndicator 
          label="Team Morale" 
          value={healthData.teamHealth} 
          color={healthData.teamHealth > 0.8 ? "emerald" : healthData.teamHealth > 0.6 ? "amber" : "red"} 
        />
      </div>

      {/* Status Tags */}
      <div className="flex gap-2 mt-4">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
          healthData.overallHealthScore > 0.8 
            ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
            : "bg-amber-50 text-amber-600 border border-amber-100"
        }`}>
          {healthData.overallHealthScore > 0.8 ? "Stable" : "Needs Attention"}
        </span>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
          {hasRealData ? "Live Data" : "Estimated"}
        </span>
      </div>
    </GlassCard>
  );
}

function MiniHealthMetric({ label, value, color, subtext }: { 
  label: string; 
  value: string; 
  color: string;
  subtext: string;
}) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    violet: "text-violet-600 bg-violet-50",
  };
  
  return (
    <div className={`rounded-lg p-3 text-center ${colors[color] || colors.indigo}`}>
      <div className="text-[9px] font-semibold uppercase mb-0.5 opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[8px] font-medium mt-0.5 opacity-60">{subtext}</div>
    </div>
  );
}

function HealthIndicator({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, { bar: string; bg: string }> = {
    emerald: { bar: "bg-emerald-400", bg: "bg-emerald-50" },
    amber: { bar: "bg-amber-400", bg: "bg-amber-50" },
    red: { bar: "bg-red-400", bg: "bg-red-50" },
  };
  const colors = colorMap[color] || colorMap.emerald;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-slate-500 w-28">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div 
          className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
          style={{ width: `${Math.min(value * 100, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 w-12 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}