import { GlassCard } from "../shared";

const MOCK_ANOMALIES = [
  {
    id: 1,
    title: "Pipeline Failure",
    description: "Backend repo 'Hydra' failed build 10.4.",
    time: "2 mins ago",
    type: "error",
  },
  {
    id: 2,
    title: "New Insight",
    description: "Potential resource conflict detected in Mobile Sprint.",
    time: "14 mins ago",
    type: "info",
  },
  {
    id: 3,
    title: "Budget Alert",
    description: "Q3 forecast variance exceeded 12% threshold.",
    time: "1 hour ago",
    type: "warning",
  },
];

export function AnomalyFeed() {
  return (
    <GlassCard className="p-4">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
        Anomaly Feed
      </div>
      
      <div className="space-y-3">
        {MOCK_ANOMALIES.map((anomaly) => (
          <div key={anomaly.id} className="flex gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(186,26,26,0.3)] ${
              anomaly.type === "error" ? "bg-red-500" : anomaly.type === "warning" ? "bg-amber-500" : "bg-indigo-500"
            }`}></div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-700">{anomaly.title}</span>
              <span className="text-[10px] text-slate-500 leading-tight">{anomaly.description}</span>
              <span className="text-[9px] text-slate-400 font-medium mt-1 uppercase">{anomaly.time}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}