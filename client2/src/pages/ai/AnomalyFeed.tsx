import { GlassCard, InfoTip } from "../shared";
import { computeAnomalies, type Anomaly } from "./aiCalculations";

interface AnomalyFeedProps {
  projects: Parameters<typeof computeAnomalies>[0];
  overdue: Parameters<typeof computeAnomalies>[1];
  escalated: Parameters<typeof computeAnomalies>[2];
}

const DOT: Record<Anomaly["tone"], string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  indigo: "bg-indigo-500",
};

export function AnomalyFeed({ projects, overdue, escalated }: AnomalyFeedProps) {
  const anomalies = computeAnomalies(projects, overdue, escalated);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anomaly Feed</span>
        <InfoTip
          title="Anomaly Feed"
          summary="Things that are currently out of place in your portfolio, newest concern first."
          points={[
            "Escalated tasks: work a manager has flagged as needing attention.",
            "Overdue tasks: work that passed its due date without being finished.",
            "Projects past their end date: still open, but the planned finish has gone by.",
          ]}
          note="This reads your live data rather than a fixed sample list."
        />
      </div>

      <div className="space-y-3">
        {anomalies.map((anomaly, i) => (
          <div key={`${anomaly.title}-${i}`} className="flex gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${DOT[anomaly.tone]}`} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-700">{anomaly.title}</span>
              <span className="text-[10px] text-slate-500 leading-tight">{anomaly.detail}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-1 uppercase">{anomaly.time}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
