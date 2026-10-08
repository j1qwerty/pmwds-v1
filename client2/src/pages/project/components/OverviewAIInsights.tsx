import { useEffect, useState } from "react";
import { GlassCard } from "../../shared/index";
import { Icon } from "../../../components/ui/Icon";

function AIGauge({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "health" | "risk";
}) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const getColorClass = () => {
    if (type === "health") {
      if (value >= 80) return "text-violet-500 stroke-violet-500";
      if (value >= 60) return "text-amber-500 stroke-amber-500";
      return "text-red-500 stroke-red-500";
    }
    if (value <= 20) return "text-emerald-500 stroke-emerald-500";
    if (value <= 50) return "text-amber-500 stroke-amber-500";
    return "text-red-500 stroke-red-500";
  };

  const colorClass = getColorClass();
  const dashArray = 125;
  const dashOffset = dashArray - (dashArray * animatedValue) / 100;

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer">
      <div className="relative w-32 h-20 overflow-hidden flex items-end justify-center mb-2">
        <svg className="w-full h-full" viewBox="0 0 100 50">
          <path
            className="text-slate-100"
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="12"
          />
          <path
            className={`${colorClass} transition-all duration-1000 ease-out`}
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="12"
          />
        </svg>
        <div className="absolute bottom-0 font-bold text-2xl text-slate-700 group-hover:scale-110 transition-transform duration-300">
          {type === "health" ? animatedValue : `${animatedValue}%`}
        </div>
      </div>
      <div className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export function OverviewAIInsights({ ws }: { ws: { project: { aiHealthScore?: number; aiDelayRiskScore?: number; aiBudgetRiskScore?: number; aiInsightsSummary?: string | null } | null } }) {
  if (!ws?.project) return null;

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon name="hi-sparkles" size={16} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-700">AI Insights</h3>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AIGauge
            label="Health Score"
            value={ws.project.aiHealthScore ?? 0}
            type="health"
          />
          <AIGauge
            label="Delay Risk"
            value={ws.project.aiDelayRiskScore ?? 0}
            type="risk"
          />
          <AIGauge
            label="Budget Risk"
            value={ws.project.aiBudgetRiskScore ?? 0}
            type="risk"
          />
        </div>
        {ws.project.aiInsightsSummary && (
          <div className="mt-4 p-3 rounded-xl bg-violet-50 border border-violet-100">
            <div className="flex items-start gap-2">
              <Icon name="hi-light-bulb" size={14} className="text-violet-500 mt-0.5 shrink-0" />
              <p className="text-xs text-violet-700 leading-relaxed">{ws.project.aiInsightsSummary}</p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
