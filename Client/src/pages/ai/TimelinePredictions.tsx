import type { Project } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface TimelinePredictionsProps {
  projects: Project[];
}

export function TimelinePredictions({ projects }: TimelinePredictionsProps) {
  const predictions = projects.slice(0, 3).map((p, i) => ({
    name: p.name,
    progress: [65, 42, 78][i],
    status: ["On Track", "At Risk", "Ahead"][i],
    color: ["indigo", "red", "emerald"][i],
    text: [
      "Est. completion: Dec 2024",
      "Delayed by 2 weeks",
      "3 days ahead of schedule",
    ][i],
  }));

  const getBarColor = (color: string) => {
    const map: Record<string, string> = {
      indigo: "bg-gradient-to-r from-indigo-500 to-violet-500",
      red: "bg-red-500",
      emerald: "bg-emerald-500",
    };
    return map[color] || map.indigo;
  };

  const getStatusColor = (color: string) => {
    const map: Record<string, string> = {
      indigo: "text-indigo-600 bg-indigo-50",
      red: "text-red-600 bg-red-50",
      emerald: "text-emerald-600 bg-emerald-50",
    };
    return map[color] || map.indigo;
  };

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="timeline" size={20} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">Timeline Predictions</h3>
      </div>

      <div className="space-y-4">
        {predictions.map((pred) => (
          <div key={pred.name}>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-600 font-medium">{pred.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(pred.color)}`}>
                {pred.status}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${getBarColor(pred.color)}`}
                style={{ width: `${pred.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">{pred.text}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}