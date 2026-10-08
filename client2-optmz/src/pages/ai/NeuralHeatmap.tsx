import type { Task, User } from "../../types";
import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";
import { calculateHeatmap } from "./aiCalculations";

interface NeuralHeatmapProps {
  project: { name: string } | null;
  tasks: Task[];
  users: User[];
}

export function NeuralHeatmap({ project, tasks, users }: NeuralHeatmapProps) {
  const heatmapData = calculateHeatmap(tasks, users);
  const highRisk = heatmapData.find((item) => item.risk);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="hub" size={20} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800">Neural Heatmap {project ? "· " + project.name : ""}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {heatmapData.reduce((sum, item) => sum + item.tasks, 0)} active tasks
          </span>
          <AIInfoHint title="Workload heatmap">
            Each group is based on the selected project's active tasks. Intensity combines active task count, estimated hours, and overdue tasks. A group becomes high risk when its calculated intensity is high or it has multiple overdue tasks.
          </AIInfoHint>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        Workload intensity by the department of each assigned task. Unassigned work is kept separate.
      </p>

      <div className="bg-slate-50 border border-slate-200 rounded-xl pt-5 pb-2 relative" style={{ minHeight: "220px" }}>
        <div className="flex items-end h-50 px-8 gap-4">
          {heatmapData.map((item) => (
            <div key={item.name} className="flex-1 flex flex-col items-center group">
              <span className={"text-[10px] font-bold mb-1 " + (item.risk ? "text-red-500" : "text-slate-400")}>
                {item.value}%
              </span>
              <div className="w-full max-w-20 relative overflow-hidden rounded-t-lg bg-slate-200" style={{ height: "176px" }}>
                <div
                  className={"absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500 " + (item.risk ? "bg-gradient-to-t from-red-400/80 to-red-300/60" : "bg-gradient-to-t from-indigo-400/60 to-violet-300/40")}
                  style={{ height: item.value + "%" }}
                />
              </div>
              <span className={"text-[10px] mt-2 font-semibold text-center " + (item.risk ? "text-red-500" : "text-slate-600")}>{item.name}</span>
              <span className="text-[9px] text-slate-400">{item.tasks} tasks</span>
            </div>
          ))}
        </div>
      </div>

      {highRisk && highRisk.tasks > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
          <Icon name="warning" size={18} className="text-red-500 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-red-700 block">{highRisk.name} requires attention</span>
            <span className="text-[10px] text-red-500">Calculated workload intensity is {highRisk.value}% across {highRisk.tasks} active task(s).</span>
          </div>
        </div>
      )}

      <p className="text-[9px] text-slate-400 mt-3 text-right">Based on current project tasks and team data.</p>
    </GlassCard>
  );
}
