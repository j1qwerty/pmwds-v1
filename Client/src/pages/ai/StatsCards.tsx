import type { BurnoutRiskRecord, ProjectHealth } from "../../types";
import { AIInfoHint } from "./AIInfoHint";

interface StatsCardsProps {
  health: ProjectHealth | null;
  burnout: BurnoutRiskRecord[];
  delay: { delayProbability?: number } | null;
}

export function StatsCards({ health, burnout, delay }: StatsCardsProps) {
  const highRiskBurnout = burnout.filter((item) => Number(item.burnoutRisk || 0) > 0.6).length;
  const riskAlerts = highRiskBurnout + (delay && Number(delay.delayProbability || 0) >= 0.7 ? 1 : 0);
  const activeSignals = (health?.weaknesses.length ?? 0) + (health?.risks.length ?? 0) + riskAlerts;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Active Signals"
        value={activeSignals}
        subtext="Current delivery risks"
        icon="psychology"
        color="indigo"
        hint="Active signals count current health weaknesses, risk items, high-risk team burnout records, and high-delay tasks."
      />
      <StatCard
        label="Overall Health"
        value={health ? Math.round(health.overallHealthScore * 100) + "%" : "—"}
        subtext={health?.healthStatus || "Awaiting project data"}
        icon="monitoring"
        color="emerald"
        hint="This uses the selected project's overall health score. It is based on schedule, budget, team capacity, and completed work."
      />
      <StatCard
        label="Risk Alerts"
        value={riskAlerts}
        subtext="Requires attention"
        icon="warning"
        color="red"
        hint="Risk alerts count team members above the burnout-risk threshold plus the selected task when its delay probability is 70% or higher."
      />
      <StatCard
        label="Delay Risk"
        value={delay ? Math.round(Number(delay.delayProbability || 0) * 100) + "%" : "—"}
        subtext={delay?.delayProbability !== undefined ? (Number(delay.delayProbability) >= 0.7 ? "High" : Number(delay.delayProbability) >= 0.4 ? "Medium" : "Low") : "Awaiting task data"}
        icon="speed"
        color="violet"
        hint="Delay risk is the selected task's probability of finishing after its planned due date. AI output is used when available, otherwise the live-data fallback uses current progress and dates."
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  color,
  hint,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: string;
  color: "indigo" | "emerald" | "red" | "violet";
  hint?: string;
}) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  };
  const colors = colorMap[color];

  return (
    <div className={"rounded-xl border " + colors.border + " bg-white/90 backdrop-blur-sm overflow-hidden"} style={{ padding: "clamp(6px, 1.5vw, 12px)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-400 uppercase tracking-wider" style={{ fontSize: "clamp(8px, 2vw, 11px)" }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={"material-symbols-outlined leading-none " + colors.text} style={{ fontSize: "clamp(16px, 3.5vw, 24px)" }}>{icon}</span>
          {hint && <AIInfoHint title={label}>{hint}</AIInfoHint>}
        </div>
      </div>
      <span className={"font-bold " + colors.text} style={{ fontSize: "clamp(16px, 4.5vw, 30px)" }}>{value}</span>
      <p className="text-slate-400 mt-1" style={{ fontSize: "clamp(10px, 2.2vw, 13px)" }}>{subtext}</p>
    </div>
  );
}
