import type { Project, ProjectHealth, Task } from "../../types";
import { GlassCard, InfoTip } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { computeInsights, type Insight } from "./aiCalculations";

interface AIRecommendationsProps {
  project: Project | null;
  health: ProjectHealth | null;
  tasks: Task[];
  burnout: Array<{ fullName: string; burnoutRisk: number; activeTasks: number }>;
}

const TONE: Record<Insight["tone"], { text: string; bg: string; icon: string }> = {
  red: { text: "text-red-600", bg: "bg-red-50 border-red-100", icon: "priority_high" },
  amber: { text: "text-amber-600", bg: "bg-amber-50 border-amber-100", icon: "warning" },
  indigo: { text: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", icon: "lightbulb" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", icon: "check_circle" },
};

export function AIRecommendations({ project, health, tasks, burnout }: AIRecommendationsProps) {
  const insights = computeInsights(project, health, tasks, burnout);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="auto_awesome" size={20} className="text-indigo-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 truncate">Recommendations</h3>
        </div>
        <InfoTip
          title="Recommendations"
          summary="Suggestions on what to fix first, worked out from the selected project's live state."
          points={[
            "Budget overrun",
            "Overdue tasks",
            "Unassigned work",
            "Stalled tasks",
            "Team load",
          ]}
          note="When the AI health service is available its own weaknesses are added to the end of the list."
        />
      </div>

      <div className="space-y-2">
        {insights.map((insight) => {
          const tone = TONE[insight.tone];
          return (
            <div key={insight.title} className={`flex items-start gap-3 p-3 rounded-lg border ${tone.bg}`}>
              <span className={`material-symbols-outlined text-lg ${tone.text} mt-0.5 shrink-0`}>{tone.icon}</span>
              <div className="min-w-0">
                <span className={`text-xs font-semibold ${tone.text} block`}>{insight.title}</span>
                <span className="text-[11px] text-slate-600 leading-relaxed">{insight.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
