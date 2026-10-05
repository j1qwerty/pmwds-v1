import { useState } from "react";
import { FiChevronDown, FiBarChart2, FiClock } from "react-icons/fi";
import { formatPercent } from "../../../lib/formatters";

interface AiInsightsSectionProps {
  recommendation?: any;
  delay?: any;
  isEscalated: boolean;
}

export function AiInsightsSection({
  recommendation,
  delay,
  isEscalated,
}: AiInsightsSectionProps) {
  const [aiExpanded, setAiExpanded] = useState(false);

  if (!recommendation && !delay) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
      <button
        onClick={() => setAiExpanded(!aiExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider">
          <FiBarChart2 className="w-3.5 h-3.5" /> AI Insights
          {(delay || isEscalated) && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </div>
        <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${aiExpanded ? "rotate-180" : ""}`} />
      </button>
      {aiExpanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {delay && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
              <FiClock className="text-amber-500 w-4 h-4" />
              <span className="text-sm font-medium text-amber-700">Delay Risk</span>
              <span className="ml-auto text-sm font-bold text-amber-600">
                {formatPercent(delay.delayProbability * 100)}
              </span>
            </div>
          )}
          {recommendation && (
            <div>
              <p className="text-sm text-indigo-800 font-medium mb-1">Recommendation</p>
              <p className="text-sm text-indigo-700">{recommendation.message}</p>
              {recommendation.suggestedActions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recommendation.suggestedActions.map((action: string) => (
                    <span key={action} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                      {action}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
