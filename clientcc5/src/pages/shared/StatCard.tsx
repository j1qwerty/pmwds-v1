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
 *   - glass card: bg-white/97 , rounded-xl, border-slate-200/60
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
  // Colour carries meaning only for risk states; everything else stays ink.
  const alert = color === "red" || color === "rose" || color === "amber";

  return (
    <div className="h-full min-w-0 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-slate-500">
          {alert && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />}
          {label}
        </p>
        {icon && <span className="material-symbols-outlined shrink-0 text-[16px] leading-none text-slate-300">{icon}</span>}
      </div>
      <p className="mt-1.5 break-words text-[26px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
      {trend && (
        <p className={`mt-2 flex items-center gap-0.5 text-xs font-medium ${trend.direction === "up" ? "text-emerald-600" : "text-rose-600"}`}>
          <span className="material-symbols-outlined text-sm leading-none">
            {trend.direction === "up" ? "trending_up" : "trending_down"}
          </span>
          {trend.label}
        </p>
      )}
    </div>
  );
}
