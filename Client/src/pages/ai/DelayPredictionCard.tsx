import type { DelayPrediction, Task } from "../../types";
import { formatDate, formatPercent } from "../../lib/formatters";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";

interface DelayPredictionCardProps {
  /** The prediction to show: the server's, or the live-data fallback. */
  delay: DelayPrediction | null;
  /** True when `delay` came from the server rather than the fallback calculation. */
  fromServer: boolean;
  /**
   * When given, a task picker is drawn so the person can choose which task the
   * prediction is for. The portfolio AI page omits it and keeps its first-task default.
   */
  tasks?: Task[];
  selectedTaskId?: string;
  onSelectTask?: (taskId: string) => void;
}

export function DelayPredictionCard({
  delay,
  fromServer,
  tasks,
  selectedTaskId,
  onSelectTask,
}: DelayPredictionCardProps) {
  const showPicker = !!tasks && tasks.length > 0 && !!onSelectTask;

  return (
    <GlassCard className="p-5 border border-amber-100/50">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="speed" size={18} className="text-amber-500" />
          <h4 className="text-sm font-bold text-slate-800">Delay Prediction</h4>
        </div>
        <AIInfoHint title="Task delay prediction">
          Delay probability uses the selected task&apos;s progress, start date, due date, overdue state, and escalation state. The live-data fallback projects completion from the current delivery rate.
        </AIInfoHint>
      </div>

      {showPicker && (
        <select
          aria-label="Task to predict"
          value={selectedTaskId ?? ""}
          onChange={(event) => onSelectTask?.(event.target.value)}
          className="w-full mb-4 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      )}

      {delay ? (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Probability</span>
              <span className="font-bold text-amber-600">{formatPercent(delay.delayProbability * 100)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-red-500 rounded-full"
                style={{ width: Math.min(delay.delayProbability * 100, 100) + "%" }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Risk Level</span>
            <span className="font-semibold text-slate-700">{delay.riskLevel || "Low"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Predicted Completion</span>
            <span className="font-semibold text-slate-700">{formatDate(delay.predictedCompletionDate)}</span>
          </div>
          {delay.contributingFactors?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              {delay.contributingFactors.map((factor: string) => (
                <span
                  key={factor}
                  className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100"
                >
                  {factor}
                </span>
              ))}
            </div>
          )}
          {!fromServer && (
            <p className="text-[9px] text-amber-500">
              Calculated from current task data because AI prediction was unavailable.
            </p>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-slate-400">Select a task with delivery data.</div>
      )}
    </GlassCard>
  );
}
