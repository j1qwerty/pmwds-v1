const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", dot: "bg-violet-500" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500" },
  red: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  sky: { bg: "bg-sky-50", text: "text-sky-600", dot: "bg-sky-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  slate: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-500" },
};

/**
 * Shared stat card, restyled to match the dashboard's stat card language
 * (pages/dashboard/dashboardStats.tsx → MetricStatCard):
 *   - glass card: bg-white/90 backdrop-blur-xl, rounded-2xl, border-slate-200/60
 *   - micro-caps label (text-[10px] font-bold uppercase tracking-wider)
 *   - big bold number (text-2xl font-bold text-slate-800, tabular)
 *   - icon in a soft tinted tile (the `color` prop drives the tile)
 *
 * The icon is rendered as a raw Material Symbols ligature span so every
 * caller-passed name keeps working (many are not in the Icon iconMap).
 */
export function StatCard({
  label,
  value,
  color = "indigo",
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: string;
  trend?: { direction: "up" | "down"; label: string };
}) {
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="h-full min-w-0 bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300/60">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums mt-1.5 break-words">
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                trend.direction === "up" ? "text-emerald-600" : "text-red-500"
              }`}>
                <span className="material-symbols-outlined text-sm leading-none">
                  {trend.direction === "up" ? "trending_up" : "trending_down"}
                </span>
                {trend.label}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
            <span className={`material-symbols-outlined text-xl leading-none ${c.text}`}>
              {icon}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
