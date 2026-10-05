import type { ReactNode } from "react";

export interface MetricStatDetail {
  id: string;
  title: string;
  subtitle?: string;
  /**
   * Set by the owner so the row can be a link target. The card itself does not know about
   * routing; `onOpenDetail` decides what to do with it.
   */
  projectId?: string;
}

const MAX_DETAILS = 10;

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
  /** When provided the hover rows become clickable. */
  onOpenDetail?: (detail: MetricStatDetail) => void;
}

/**
 * A dashboard metric with a hover/focus panel listing the items behind the number.
 *
 * The panel is rendered below the card rather than in a portal, so it relies on no ancestor
 * clipping it. It reveals on hover *and* on focus-within, and the card is focusable, so the
 * same list is reachable from the keyboard.
 */
export function MetricStatCard({
  icon,
  value,
  label,
  tone,
  details,
  detailLabel = "Latest",
  onOpenDetail,
}: MetricStatCardProps) {
  const shown = details.slice(0, MAX_DETAILS);

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

      <div
        className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border border-slate-200 bg-white p-3 text-left opacity-0 shadow-xl transition-all duration-150 invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        // Rows are interactive only when there is a handler; keeping the panel itself
        // pointer-transparent would otherwise make the links unclickable.
        style={onOpenDetail ? undefined : { pointerEvents: "none" }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{detailLabel}</span>
          <span className="text-[10px] text-slate-400">
            {details.length > shown.length ? `showing ${shown.length} of ${details.length}` : `${shown.length} shown`}
          </span>
        </div>
        {shown.length === 0 ? (
          <p className="text-xs text-slate-400">No matching items.</p>
        ) : (
          <ul className="space-y-1">
            {shown.map((detail) => {
              const content = (
                <>
                  <p className="truncate text-xs font-semibold text-slate-700">{detail.title}</p>
                  {detail.subtitle && <p className="truncate text-[10px] text-slate-400">{detail.subtitle}</p>}
                </>
              );

              return (
                <li key={detail.id} className="min-w-0">
                  {onOpenDetail ? (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(detail)}
                      className="w-full text-left rounded-md px-1.5 py-1 -mx-1.5 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="px-1.5 py-1 -mx-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}