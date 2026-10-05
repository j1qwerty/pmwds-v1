import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { AIInfoHint } from "./AIInfoHint";

interface AIRecommendationsProps {
  recommendations: string[];
  fallback: boolean;
}

export function AIRecommendations({ recommendations, fallback }: AIRecommendationsProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" size={20} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">AI Recommendations</h3>
        </div>
        <AIInfoHint title="Recommendations">
          Recommendations come from the selected project's health risks and current delivery data. When an AI provider is unavailable, the page uses rule-based suggestions from the same live inputs.
        </AIInfoHint>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">No actions are currently suggested.</div>
      ) : (
        <div className="space-y-2">
          {recommendations.slice(0, 5).map((recommendation) => (
            <div key={recommendation} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-lg text-indigo-500 mt-0.5">lightbulb</span>
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Recommended action</span>
                <span className="text-[11px] text-slate-500 leading-relaxed">{recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {fallback && recommendations.length > 0 && (
        <p className="text-[9px] text-amber-500 mt-3">Using live-data fallback rules because AI recommendations are unavailable.</p>
      )}
    </GlassCard>
  );
}
