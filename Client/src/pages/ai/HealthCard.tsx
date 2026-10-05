import type { Project, ProjectHealth } from "../../types";
import { formatPercent } from "../../ui";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";

interface HealthCardProps {
  project: Project | null;
  health: ProjectHealth | null;
  fallbackHealth: ProjectHealth | null;
}

export function HealthCard({ project, health, fallbackHealth }: HealthCardProps) {
  const healthData = health ?? fallbackHealth;
  const sourceLabel = health ? "AI + live data" : fallbackHealth ? "Calculated from live data" : "Waiting for project data";

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="monitoring" size={20} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800 truncate">{project?.name || "Project"} Health</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={"w-2 h-2 rounded-full " + (health ? "bg-emerald-500" : "bg-amber-500")} />
          <AIInfoHint title="Overall health score">
            Overall health combines schedule (40%), budget (25%), team capacity (20%), and completed-work quality (15%). The fallback uses the selected project's real dates, progress, budget, tasks, overdue work, and team availability.
          </AIInfoHint>
        </div>
      </div>

      {!healthData ? (
        <div className="py-10 text-center text-xs text-slate-400">Select a project with available delivery data.</div>
      ) : (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">Overall Health Score</span>
              <span className="font-bold text-emerald-600">{formatPercent(healthData.overallHealthScore)}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: Math.min(healthData.overallHealthScore * 100, 100) + "%" }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniHealthMetric label="Schedule" value={formatPercent(healthData.scheduleHealth)} color="indigo" subtext={healthData.scheduleHealth > 0.8 ? "On Track" : healthData.scheduleHealth > 0.6 ? "At Risk" : "Delayed"} />
            <MiniHealthMetric label="Budget" value={formatPercent(healthData.budgetHealth)} color="emerald" subtext={healthData.budgetHealth > 0.8 ? "Within Budget" : healthData.budgetHealth > 0.6 ? "Warning" : "Over Budget"} />
            <MiniHealthMetric label="Team" value={formatPercent(healthData.teamHealth)} color="violet" subtext={healthData.teamHealth > 0.8 ? "Strong" : healthData.teamHealth > 0.6 ? "Stable" : "Stressed"} />
          </div>

          <div className="space-y-2">
            <HealthIndicator label="Schedule Variance" value={healthData.scheduleHealth} color={healthData.scheduleHealth > 0.8 ? "emerald" : healthData.scheduleHealth > 0.6 ? "amber" : "red"} />
            <HealthIndicator label="Budget Utilization" value={healthData.budgetHealth} color={healthData.budgetHealth > 0.8 ? "emerald" : healthData.budgetHealth > 0.6 ? "amber" : "red"} />
            <HealthIndicator label="Team Capacity" value={healthData.teamHealth} color={healthData.teamHealth > 0.8 ? "emerald" : healthData.teamHealth > 0.6 ? "amber" : "red"} />
          </div>

          <div className="flex items-center justify-between gap-2 mt-4">
            <span className={"px-2.5 py-1 rounded-full text-[10px] font-medium " + (healthData.overallHealthScore > 0.8 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100")}>
              {healthData.healthStatus}
            </span>
            <span className="text-[9px] text-slate-400">{sourceLabel}</span>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function MiniHealthMetric({ label, value, color, subtext }: { label: string; value: string; color: string; subtext: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50",
    emerald: "text-emerald-600 bg-emerald-50",
    violet: "text-violet-600 bg-violet-50",
  };
  return <div className={"rounded-lg p-3 text-center " + (colors[color] || colors.indigo)}><div className="text-[9px] font-semibold uppercase mb-0.5 opacity-70">{label}</div><div className="text-lg font-bold">{value}</div><div className="text-[8px] font-medium mt-0.5 opacity-60">{subtext}</div></div>;
}

function HealthIndicator({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = { emerald: "bg-emerald-400", amber: "bg-amber-400", red: "bg-red-400" };
  return <div className="flex items-center gap-3"><span className="text-[10px] text-slate-500 w-28">{label}</span><div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className={"h-full rounded-full " + (colorMap[color] || colorMap.emerald)} style={{ width: Math.min(value * 100, 100) + "%" }} /></div><span className="text-[10px] font-semibold text-slate-600 w-12 text-right">{Math.round(value * 100)}%</span></div>;
}
