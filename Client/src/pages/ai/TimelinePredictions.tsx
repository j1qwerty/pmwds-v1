import type { Project } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";
import { calculateTimelinePrediction } from "./aiCalculations";

interface TimelinePredictionsProps {
  projects: Project[];
}

export function TimelinePredictions({ projects }: TimelinePredictionsProps) {
  const predictions = projects.slice(0, 5).map(calculateTimelinePrediction);

  const getBarColor = (color: string) =>
    ({
      indigo: "bg-gradient-to-r from-indigo-500 to-violet-500",
      red: "bg-red-500",
      emerald: "bg-emerald-500",
    })[color] || "bg-indigo-500";

  const getStatusColor = (color: string) =>
    ({
      indigo: "text-indigo-600 bg-indigo-50",
      red: "text-red-600 bg-red-50",
      emerald: "text-emerald-600 bg-emerald-50",
    })[color] || "text-indigo-600 bg-indigo-50";

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="timeline" size={20} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Timeline Predictions</h3>
        </div>
        <AIInfoHint title="Timeline prediction">
          The estimate compares current project progress with the planned start and end dates. If enough progress exists, completion is projected from the observed delivery rate. Otherwise the planned end date is shown.
        </AIInfoHint>
      </div>

      {predictions.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">No project timeline data available.</div>
      ) : (
        <div className="space-y-4">
          {predictions.map((prediction) => (
            <div key={prediction.name}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-600 font-medium truncate pr-2">{prediction.name}</span>
                <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 " + getStatusColor(prediction.color)}>
                  {prediction.status}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className={"h-full rounded-full " + getBarColor(prediction.color)} style={{ width: prediction.progress + "%" }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">{prediction.text}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
