const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", dot: "bg-indigo-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", dot: "bg-violet-500" },
  rose: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500" },
  blue: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  slate: { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-500" },
};

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
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:shadow-${color}-100/50 hover:border-${color}-200 ${c.bg}/20`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {label}
          </p>
          <p className={`text-2xl font-bold tracking-tight ${c.text}`}>
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                trend.direction === "up" ? "text-emerald-600" : "text-red-500"
              }`}>
                <span className="material-symbols-outlined text-sm">
                  {trend.direction === "up" ? "trending_up" : "trending_down"}
                </span>
                {trend.label}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shrink-0 ml-3`}>
            <span className={`material-symbols-outlined text-2xl ${c.text}`}>
              {icon}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
