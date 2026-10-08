import { useEffect, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { InfoTip } from "../../shared/index";

function AIGauge({
  label,
  value,
  type,
  info,
}: {
  label: string;
  value: number;
  type: "health" | "risk";
  info?: string;
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
    <div className="relative flex flex-col items-center p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center gap-1 self-start">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {info && <InfoTip title={label} summary={info} />}
      </div>
      <div className="relative w-32 h-20 overflow-hidden flex items-end justify-center mt-1 mb-1">
        <svg className="w-full h-full" viewBox="0 0 100 50" aria-hidden="true">
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
        <div className="absolute bottom-0 font-bold text-2xl text-slate-700 tracking-tight group-hover:scale-110 transition-transform duration-300">
          {type === "health" ? animatedValue : `${animatedValue}%`}
        </div>
      </div>
    </div>
  );
}

export function OverviewAIInsights({ ws }: { ws: { project: { aiHealthScore?: number; aiDelayRiskScore?: number; aiBudgetRiskScore?: number; aiInsightsSummary?: string | null } | null } }) {
  if (!ws?.project) return null;

  const hasScores =
    ws.project.aiHealthScore != null ||
    ws.project.aiDelayRiskScore != null ||
    ws.project.aiBudgetRiskScore != null;

  return (
    <section className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      {/* Soft indigo→violet AI banner header */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-violet-50/60 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
            <Icon name="hi-sparkles" size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800">AI insights</h3>
            <p className="text-[11px] text-slate-500">Automated health and risk signals for this project</p>
          </div>
          <InfoTip
            title="How these scores work"
            summary="Each score is a 0–100 estimate computed from this project's schedule, budget, and task activity."
            points={[
              "Health: higher is better — progress pace, budget use, and completion trends combined.",
              "Delay risk: higher means a larger chance of missing the planned end date.",
              "Budget risk: higher means spending is trending above plan.",
            ]}
            note="Scores update as project data changes; treat them as guidance, not guarantees."
          />
        </div>
      </div>

      <div className="p-5">
        {hasScores ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AIGauge
              label="Health score"
              value={ws.project.aiHealthScore ?? 0}
              type="health"
              info="Overall project health. Higher is better."
            />
            <AIGauge
              label="Delay risk"
              value={ws.project.aiDelayRiskScore ?? 0}
              type="risk"
              info="Chance of finishing later than planned. Lower is better."
            />
            <AIGauge
              label="Budget risk"
              value={ws.project.aiBudgetRiskScore ?? 0}
              type="risk"
              info="Risk of exceeding the planned budget. Lower is better."
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-xs">
            <Icon name="hi-sparkles" size={16} className="text-slate-400 shrink-0" />
            AI scores are not available for this project yet.
          </div>
        )}

        {ws.project.aiInsightsSummary && (
          <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/80 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="hi-light-bulb" size={14} className="text-violet-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">Summary</p>
                <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{ws.project.aiInsightsSummary}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
