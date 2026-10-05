import { GlassCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

const RECOMMENDATIONS = [
  {
    id: 1,
    title: "Optimize Resource Allocation",
    description: "Reassign 2 developers from Project B to Vanguard for 2-week sprint",
    icon: "lightbulb",
    color: "text-indigo-500",
  },
  {
    id: 2,
    title: "Address Budget Variance",
    description: "15% variance detected in Q3 forecast. Review immediately.",
    icon: "priority_high",
    color: "text-red-500",
  },
  {
    id: 3,
    title: "Extend Milestone Delta",
    description: "7-day extension recommended based on velocity analysis",
    icon: "schedule",
    color: "text-emerald-500",
  },
];

export function AIRecommendations() {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="auto_awesome" size={20} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">AI Recommendations</h3>
      </div>

      <div className="space-y-2">
        {RECOMMENDATIONS.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-lg ${rec.color} mt-0.5`}>{rec.icon}</span>
            <div>
              <span className="text-xs font-semibold text-slate-700 block">{rec.title}</span>
              <span className="text-[11px] text-slate-500 leading-relaxed">{rec.description}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}