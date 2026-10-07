import { useEffect, useState } from "react";
import { InfoTip } from "../../shared";
import { DASHBOARD_OVERVIEW_CARD_HEIGHT } from "../../constants";

interface ActivityDataPoint {
  day: string;
  value: number;
  /**
   * What was logged on this day, busiest first. Optional so a caller that only has
   * counts still works - the popup then says how many events without naming them.
   */
  events?: { label: string; count: number }[];
}

interface ActivityProps {
  data?: ActivityDataPoint[];
  title?: string;
  filterOptions?: string[];
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
  /** True when the figures are limited to one person, matching the chart. */
  isFiltered?: boolean;
  filterLabel?: string;
}

const EMPTY_WEEK: ActivityDataPoint[] = [
  { day: "Sun", value: 0 },
  { day: "Mon", value: 0 },
  { day: "Tue", value: 0 },
  { day: "Wed", value: 0 },
  { day: "Thu", value: 0 },
  { day: "Fri", value: 0 },
  { day: "Sat", value: 0 },
];

export function Activity({
  data,
  title = "Activity",
  filterOptions = ["All Tasks"],
  selectedFilter = "All Tasks",
  onFilterChange,
  isFiltered = false,
  filterLabel,
}: ActivityProps) {
  // No dummy data. When the caller has nothing yet, every day reads zero - which is the
  // truth, not a placeholder curve.
  const activityData: ActivityDataPoint[] =
    data && data.length > 0 ? data : EMPTY_WEEK;

  // Two indices rather than one.
  //
  // Hover is transient - it follows the pointer. Click pins, so the popup survives
  // the pointer leaving to reach a button inside it. Hover wins while it is active,
  // so moving along the line reads the days in turn, and the pinned day reappears
  // once the pointer is off the chart.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const total = activityData.reduce((sum, point) => sum + point.value, 0);

  // Chart dimensions
  const width = 300;
  const height = 150;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(...activityData.map((d) => d.value));

  // Calculate points for SVG path
  const points = activityData.map((point, index) => {
    const x = padding + (index / (activityData.length - 1)) * chartWidth;
    const normalizedValue = maxValue > 0 ? point.value / maxValue : 0;
    const y = padding + chartHeight - normalizedValue * chartHeight;
    return { x, y, ...point };
  });

  // Generate SVG path
  const linePath = points
    .map((point, index) => {
      if (index === 0) return `M${point.x},${point.y}`;
      // Create smooth curve using quadratic bezier
      const prevPoint = points[index - 1];
      const controlX = (prevPoint.x + point.x) / 2;
      return `Q${controlX},${prevPoint.y} ${point.x},${point.y}`;
    })
    .join(" ");

  // Generate area path (same as line but with bottom closing)
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  // ── Day popup ──────────────────────────────────────────────────────────
  // Both the index and the lookup are clamped rather than reset by an effect when
  // the data changes. A filter switch rebuilds the points, so a stored index would
  // otherwise point at a different day than the one the user was looking at.
  const inRange = (index: number | null) =>
    index !== null && index >= 0 && index < activityData.length ? index : null;

  const activeIndex = inRange(hoveredIndex) ?? inRange(pinnedIndex);
  const selected = activeIndex === null ? null : points[activeIndex];

  useEffect(() => {
    if (pinnedIndex === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnedIndex(null);
    };
    const onClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-activity-day]")) return;
      if (target?.closest("[data-activity-popup]")) return;
      setPinnedIndex(null);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickAway);
    };
  }, [pinnedIndex]);

  // Popup placement. Anchored in HTML rather than SVG because the chart scales with
  // preserveAspectRatio="none", which would turn any circle drawn inside it into an
  // ellipse.
  //
  // Horizontal: shifted so the popup stays inside the card at the edges.
  // Vertical: flipped to the other side of the point when the point sits low, so a
  // peak near the bottom does not push the popup off the card.
  const popupLeftPercent = selected ? (selected.x / width) * 100 : 0;
  const popupTopPercent = selected ? (selected.y / height) * 100 : 0;
  const popupBelow = popupTopPercent < 50;
  const popupShift = popupLeftPercent > 60 ? "-100%" : popupLeftPercent < 40 ? "0%" : "-50%";

  const hoverProps = (index: number) => ({
    onMouseEnter: () => setHoveredIndex(index),
    onMouseLeave: () => setHoveredIndex(null),
    onFocus: () => setHoveredIndex(index),
    onBlur: () => setHoveredIndex(null),
  });

  const clickProps = (index: number) => ({
    onClick: () => setPinnedIndex(inRange(pinnedIndex) === index ? null : index),
  });

  const scopeLabel = isFiltered ? filterLabel ?? selectedFilter : "Your workspace";

  return (
    <div
      className={`group bg-white rounded-2xl p-5 border border-slate-100 shadow-md ${DASHBOARD_OVERVIEW_CARD_HEIGHT} flex flex-col`}
    >
      <div className="flex justify-between items-center mb-4 relative">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex items-center gap-2">
          {filterOptions.length > 0 && (
            <select
              className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer"
              value={selectedFilter}
              onChange={(e) => onFilterChange?.(e.target.value)}
            >
              {filterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          <InfoTip
            title="Activity"
            summary="Activity on last seven days."
            points={[
              "tasks created, updated, commented on, escalated or completed, plus project and milestone changes.",
            ]}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {total === 0 ? (
          // Explicit empty state. Previously this drew a flat line along the
          // baseline with a gradient fill under it, which read as a broken chart
          // rather than as "nothing happened".
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
            <span className="material-symbols-outlined text-2xl text-slate-300 mb-1.5">insights</span>
            <p className="text-xs font-medium text-slate-500">No activity in the last 7 days</p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              {scopeLabel} has no recorded events in this period. The chart appears once
              something is logged.
            </p>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#8b5cf6", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#8b5cf6", stopOpacity: 0 }} />
                </linearGradient>
              </defs>

              {/* Baseline, so a day at zero still reads as a position on the axis
                  rather than as the edge of the chart. */}
              <line
                x1={padding}
                y1={padding + chartHeight}
                x2={padding + chartWidth}
                y2={padding + chartHeight}
                stroke="#e2e8f0"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path d={areaPath} fill="url(#activityGradient)" opacity="0.1" />
            </svg>

            {/* Interactive points, in HTML so they stay circular under the chart's
                non-uniform scaling and so no coordinate maths is needed. */}
            {points.map((point, index) => {
              const isActive = activeIndex === index;
              const isPinned = inRange(pinnedIndex) === index;
              return (
                <button
                  key={point.day}
                  type="button"
                  data-activity-day={index}
                  aria-label={`${point.day}: ${point.value} event${point.value === 1 ? "" : "s"}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full cursor-pointer
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  style={{
                    left: `${(point.x / width) * 100}%`,
                    top: `${(point.y / height) * 100}%`,
                    // A generous hit area around a small dot, so the target is
                    // usable rather than needing pixel accuracy.
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: isActive ? 20 : 10,
                  }}
                  {...hoverProps(index)}
                  {...clickProps(index)}
                >
                  <span
                    className={`block rounded-full transition-all ${
                      isPinned
                        ? "bg-violet-700 ring-4 ring-violet-300"
                        : isActive
                        ? "bg-violet-600 ring-4 ring-violet-200"
                        : point.value === 0
                        ? "bg-white border-2 border-slate-300 group-hover:border-violet-400"
                        : "bg-violet-500 group-hover:bg-violet-600"
                    }`}
                    style={{ width: 9, height: 9 }}
                  />
                </button>
              );
            })}

            {/* Peak marker. Without it the reader has no way to tell what the
                chart's scale is - the same shape could mean 2 events or 200. */}
            <span
              className="absolute text-[9px] font-semibold text-slate-400 pointer-events-none"
              style={{ left: 4, top: 2 }}
            >
              {maxValue}
            </span>

            {selected && (
              <div
                data-activity-popup
                role="dialog"
                aria-label={`Activity on ${selected.day}`}
                className="absolute z-30 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                style={{
                  left: `${popupLeftPercent}%`,
                  transform: `translateX(${popupShift})`,
                  ...(popupBelow
                    ? { top: `${popupTopPercent}%`, marginTop: 14 }
                    : { bottom: `${100 - popupTopPercent}%`, marginBottom: 14 }),
                }}
              >
                <p className="text-[11px] font-bold text-slate-700">{selected.day}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {selected.value === 0
                    ? "Nothing logged on this day."
                    : `${selected.value} event${selected.value === 1 ? "" : "s"} logged.`}
                </p>

                {(selected.events?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1">
                    {selected.events!.map((entry) => (
                      <li key={entry.label} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-600 truncate">{entry.label}</span>
                        <span className="text-[10px] font-bold text-violet-600 shrink-0">{entry.count}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {selected.value > 0 && (selected.events?.length ?? 0) === 0 && (
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Detail for this day was not supplied by the dashboard.
                  </p>
                )}

                {inRange(pinnedIndex) !== null && (
                  <button
                    type="button"
                    onClick={() => setPinnedIndex(null)}
                    className="mt-2.5 w-full text-[10px] font-semibold text-slate-500 hover:text-slate-700 py-1 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-slate-400 mt-2">
        {activityData.map((point, index) => (
          <button
            key={index}
            type="button"
            data-activity-day={index}
            className={`p-0 transition-colors hover:text-violet-500 ${
              activeIndex === index ? "text-violet-600 font-semibold" : ""
            }`}
            {...hoverProps(index)}
            {...clickProps(index)}
          >
            {point.day}
          </button>
        ))}
      </div>
    </div>
  );
}
