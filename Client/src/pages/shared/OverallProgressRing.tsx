import type { Project } from "../../types";
import { formatMoney } from "../../lib/formatters";
import { useEffect, useState } from "react";

interface OverallProgressRingProps {
  progress: number;
  project: Project;
  delayRisk: number | null;
  healthScore?: number | null;
}

export function OverallProgressRing({ progress, project, delayRisk, healthScore }: OverallProgressRingProps) {
  const circumference = 2 * Math.PI * 56;
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [animatedHealth, setAnimatedHealth] = useState(0);

  useEffect(() => {
    setAnimatedProgress(progress);
    setAnimatedHealth(healthScore ?? 0);
  }, [progress, healthScore]);

  const offset = circumference - (Math.min(animatedProgress, 100) / 100) * circumference;

  return (
    <div className="bg-white border w-full border-slate-200 rounded-xl p-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
        {/* Progress Ring */}
        <div className="flex justify-center items-center flex-col">
          <div className="relative size-32 flex items-center justify-center">
            <svg className="size-full -rotate-90" viewBox="0 0 128 128">
              <circle className="stroke-slate-100" cx="64" cy="64" fill="none" r="56" strokeWidth="8" />
              <circle
                className="stroke-indigo-500 transition-all duration-1000 ease-out"
                cx="64" cy="64" fill="none" r="56"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                strokeWidth="8"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold text-slate-800">{Math.round(animatedProgress)}%</span>
              <span className="text-[10px] text-slate-400 font-medium">Complete</span>
            </div>
          </div>
          <span className="text-[10px] text-indigo-500 font-normal mt-1">Auto-calculated from milestones</span>
        </div>

        {/* Metrics */}
        <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Budget Utilized */}
          <div className="bg-slate-50 p-4 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1" title="Project budget is shown in lakhs">
              Budget Utilized
            </div>
            <div className="text-lg font-bold text-slate-800 mb-1">
              {formatMoney(project.actualCost)}
              <span className="text-sm text-slate-400 font-normal"> / {formatMoney(project.plannedBudget)}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${project.plannedBudget ? Math.min((project.actualCost ?? 0) / project.plannedBudget * 100, 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Delay Risk */}
          <div className="bg-slate-50 p-4 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Delay Risk</div>
            <div className={`text-lg font-bold mb-1 ${delayRisk && delayRisk > 50 ? "text-orange-600" : "text-emerald-600"}`}>
              {delayRisk != null ? `${delayRisk}%` : "\u2014"}
            </div>
            <div className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_down</span>
              {delayRisk && delayRisk < 30 ? "Low risk" : "Moderate risk"}
            </div>
          </div>

          {/* Health Score – Full Width Below */}
          <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-indigo-500 text-lg">monitoring</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Health Score</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">AI Assessed</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-indigo-600 transition-all duration-700">
                {healthScore != null ? `${Math.round(animatedHealth)}%` : "\u2014"}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${animatedHealth}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}