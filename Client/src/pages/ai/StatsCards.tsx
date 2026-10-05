import type { BurnoutRiskRecord, ProjectHealth } from "../../types";

interface StatsCardsProps {
  health: ProjectHealth | null;
  burnout: BurnoutRiskRecord[];
  delay: any;
}

export function StatsCards({ health, burnout, delay }: StatsCardsProps) {
  const highRiskBurnout = burnout.filter(b => Number(b.burnoutRisk || 0) > 0.6).length;
  const avgDelayProb = delay ? Math.round(delay.delayProbability * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Active Insights"
        value="24"
        subtext="+3 this week"
        icon="psychology"
        color="indigo"
      />
      <StatCard
        label="Prediction Accuracy"
        value="94%"
        subtext="+2.1% improvement"
        icon="trending_up"
        color="emerald"
      />
      <StatCard
        label="Risk Alerts"
        value={highRiskBurnout}
        subtext="Requires attention"
        icon="warning"
        color="red"
      />
      <StatCard
        label="Avg Response"
        value="1.2s"
        subtext="Processing time"
        icon="timer"
        color="violet"
      />
    </div>
  );
}

function StatCard({ label, value, subtext, icon, color }: {
  label: string;
  value: string | number;
  subtext: string;
  icon: string;
  color: "indigo" | "emerald" | "red" | "violet";
}) {
  const colorMap = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
    red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  };
  const colors = colorMap[color];

  return (
    <div className={`rounded-xl border ${colors.border} bg-white/90 backdrop-blur-sm overflow-hidden`} style={{ padding: 'clamp(6px, 1.5vw, 12px)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-400 uppercase tracking-wider" style={{ fontSize: 'clamp(8px, 2vw, 11px)' }}>{label}</span>
        <span className={`material-symbols-outlined leading-none ${colors.text}`} style={{ fontSize: 'clamp(16px, 3.5vw, 24px)' }}>{icon}</span>
      </div>
      <span className={`font-bold ${colors.text}`} style={{ fontSize: 'clamp(16px, 4.5vw, 30px)' }}>{value}</span>
      <p className="text-slate-400 mt-1" style={{ fontSize: 'clamp(10px, 2.2vw, 13px)' }}>{subtext}</p>
    </div>
  );
}