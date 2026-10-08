import type { ProjectHealth } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";

interface RiskPredictionCardProps {
  health: ProjectHealth | null;
  fallbackHealth: ProjectHealth | null;
}

export function RiskPredictionCard({ health, fallbackHealth }: RiskPredictionCardProps) {
  const source = health ?? fallbackHealth;
  const risks = source
    ? [
        { label: "Budget Overrun", value: (1 - source.budgetHealth) * 100, color: "red" },
        { label: "Schedule Delay", value: (1 - source.scheduleHealth) * 100, color: "amber" },
        { label: "Resource Conflict", value: (1 - source.teamHealth) * 100, color: "indigo" },
      ]
    : [];

  const getRiskLevel = (value: number) => {
    if (value > 70) return { text: "High", color: "text-red-500" };
    if (value > 40) return { text: "Medium", color: "text-amber-500" };
    return { text: "Low", color: "text-emerald-500" };
  };

  const getBarColor = (color: string) =>
    ({
      red: "bg-gradient-to-r from-red-400 to-red-500",
      amber: "bg-gradient-to-r from-amber-400 to-amber-500",
      indigo: "bg-gradient-to-r from-indigo-400 to-violet-500",
    })[color] || "bg-indigo-500";

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="speed" size={20} className="text-red-500" />
          <h3 className="text-sm font-bold text-slate-800">Risk Prediction</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <AIInfoHint title="Risk prediction">
            Budget risk comes from actual cost versus planned budget. Schedule risk comes from the gap between expected and actual progress. Resource risk uses active task pressure and team availability. When AI is unavailable, the same live inputs are used for the fallback.
          </AIInfoHint>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">Waiting for project data.</div>
      ) : (
        <div className="space-y-4">
          {risks.map((risk) => {
            const level = getRiskLevel(risk.value);
            return (
              <div key={risk.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-slate-500">{risk.label}</span>
                  <span className={"text-xs font-bold " + level.color}>{level.text}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className={"h-full rounded-full " + getBarColor(risk.color)} style={{ width: Math.min(Math.max(risk.value, 0), 100) + "%" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
