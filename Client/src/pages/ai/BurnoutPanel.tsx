import type { BurnoutRiskRecord } from "../../types";
import { formatPercent } from "../../ui";
import { Avatar, GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";

interface BurnoutPanelProps {
  burnout: BurnoutRiskRecord[];
  fallbackBurnout: BurnoutRiskRecord[];
}

export function BurnoutPanel({ burnout, fallbackBurnout }: BurnoutPanelProps) {
  const records = burnout.length ? burnout : fallbackBurnout;
  const highRisk = records.filter((item) => Number(item.burnoutRisk || 0) > 0.6);
  const mediumRisk = records.filter((item) => {
    const risk = Number(item.burnoutRisk || 0);
    return risk > 0.3 && risk <= 0.6;
  });

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="psychology" size={18} className="text-red-500" />
          <h4 className="text-sm font-bold text-slate-800">Burnout Risk</h4>
        </div>
        <AIInfoHint title="Burnout and workload">
          Workload uses active task count and estimated hours. Burnout adds pressure from limited availability and overdue work. AI results are used when available; otherwise the calculation uses the same current team and task data.
        </AIInfoHint>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-600">{highRisk.length}</div>
          <div className="text-[9px] font-semibold text-red-400 uppercase">High Risk</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-amber-600">{mediumRisk.length}</div>
          <div className="text-[9px] font-semibold text-amber-400 uppercase">Medium Risk</div>
        </div>
      </div>

      <div className="max-h-150 overflow-y-auto space-y-2">
        {records.slice(0, 8).map((item, index) => {
          const risk = Number(item.burnoutRisk || 0);
          const workload = Number(item.workloadScore || 0);
          const riskPercent = risk <= 1 ? risk * 100 : risk;
          const workloadPercent = workload <= 1 ? workload * 100 : workload;

          return (
            <div key={item.userId + "-" + index} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
              <Avatar person={{ userId: item.userId, fullName: item.fullName }} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-slate-700 truncate">{item.fullName}</span>
                  <span className={"text-[10px] font-bold " + (riskPercent > 60 ? "text-red-500" : riskPercent > 30 ? "text-amber-500" : "text-emerald-500")}>
                    {formatPercent(riskPercent)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div className={"h-full rounded-full " + (riskPercent > 60 ? "bg-red-400" : riskPercent > 30 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: Math.min(riskPercent, 100) + "%" }} />
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5">Workload {formatPercent(workloadPercent)} · {item.activeTasks} active task(s)</span>
              </div>
            </div>
          );
        })}
      </div>

      {records.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Icon name="sentiment_satisfied" size={22} className="mb-2 block" />
          <p className="text-xs">No team workload data available.</p>
        </div>
      )}

      {!burnout.length && records.length > 0 && (
        <p className="text-[9px] text-amber-500 mt-3">Calculated from current team and task data because AI burnout data was unavailable.</p>
      )}
    </GlassCard>
  );
}
