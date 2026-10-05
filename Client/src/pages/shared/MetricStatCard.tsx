import type { ReactNode } from "react";

export interface MetricStatDetail {
  id: string;
  title: string;
  subtitle?: string;
}

interface MetricStatCardProps {
  icon: ReactNode;
  value: number;
  label: string;
  tone: {
    bg: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    shadowHoverColor: string;
  };
  details: MetricStatDetail[];
  detailLabel?: string;
}

export function MetricStatCard({
  icon,
  value,
  label,
  tone,
  details,
  detailLabel = "Latest",
}: MetricStatCardProps) {
  return (
    <div
      tabIndex={0}
      className={`group relative min-w-0 ${tone.badgeBg} ${tone.shadowHoverColor} rounded-2xl p-4 transition-all duration-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 h-full flex flex-col justify-between border-0`}
      aria-label={`${label}: ${value}. Hover or focus to see details.`}
    >
      <div className="relative flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 ${tone.badgeBg} rounded-lg flex items-center justify-center ${tone.badgeText} shrink-0`}>
          {icon}
        </div>
        <span className={`text-xs font-medium ${tone.badgeText} uppercase tracking-wider`}>
          {label}
        </span>
      </div>

      <div className="relative mt-2">
        <span className={`text-2xl font-bold text-center tracking-wider ${tone.text}`}>
          {value.toLocaleString()}
        </span>
      </div>

      <div className="pointer-events-none invisible absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border border-slate-200 bg-white p-3 text-left opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{detailLabel}</span>
          <span className="text-[10px] text-slate-400">{Math.min(details.length, 5)} shown</span>
        </div>
        {details.length === 0 ? (
          <p className="text-xs text-slate-400">No matching items.</p>
        ) : (
          <div className="space-y-2">
            {details.slice(0, 5).map((detail) => (
              <div key={detail.id} className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-700">{detail.title}</p>
                {detail.subtitle && <p className="truncate text-[10px] text-slate-400">{detail.subtitle}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
