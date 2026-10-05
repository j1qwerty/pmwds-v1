import type { ProjectHealth } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface RiskPredictionCardProps {
  health: ProjectHealth | null;
}

export function RiskPredictionCard({ health }: RiskPredictionCardProps) {
  const risks = [
    { label: "Budget Overrun", value: health?.budgetHealth ? (1 - health.budgetHealth) * 100 : 75, color: "red" },
    { label: "Schedule Delay", value: health?.scheduleHealth ? (1 - health.scheduleHealth) * 100 : 45, color: "amber" },
    { label: "Resource Conflict", value: health?.teamHealth ? (1 - health.teamHealth) * 100 : 15, color: "indigo" },
  ];

  const getRiskLevel = (value: number) => {
    if (value > 70) return { text: "High", color: "text-red-500" };
    if (value > 40) return { text: "Medium", color: "text-amber-500" };
    return { text: "Low", color: "text-emerald-500" };
  };

  const getBarColor = (color: string) => {
    const map: Record<string, string> = {
      red: "bg-gradient-to-r from-red-400 to-red-500",
      amber: "bg-gradient-to-r from-amber-400 to-amber-500",
      indigo: "bg-gradient-to-r from-indigo-400 to-violet-500",
    };
    return map[color] || map.indigo;
  };

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="speed" size={20} className="text-red-500" />
          <h3 className="text-sm font-bold text-slate-800">Risk Prediction</h3>
        </div>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
      </div>

      <div className="space-y-4">
        {risks.map((risk) => {
          const level = getRiskLevel(risk.value);
          return (
            <div key={risk.label}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500">{risk.label}</span>
                <span className={`text-xs font-bold ${level.color}`}>{level.text}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${getBarColor(risk.color)}`}
                  style={{ width: `${Math.min(risk.value, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}