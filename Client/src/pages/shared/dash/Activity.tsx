interface ActivityDataPoint {
  day: string;
  value: number;
}

interface ActivityProps {
  data?: ActivityDataPoint[];
  title?: string;
  filterOptions?: string[];
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
}

export function Activity({
  data,
  title = "Activity",
  filterOptions = ["All Tasks"],
  selectedFilter = "All Tasks",
  onFilterChange
}: ActivityProps) {
  // No dummy data. When the caller has nothing yet, every day reads zero - which is the
  // truth, not a placeholder curve.
  const activityData: ActivityDataPoint[] =
    data && data.length > 0
      ? data
      : [
          { day: "Sun", value: 0 },
          { day: "Mon", value: 0 },
          { day: "Tue", value: 0 },
          { day: "Wed", value: 0 },
          { day: "Thu", value: 0 },
          { day: "Fri", value: 0 },
          { day: "Sat", value: 0 },
        ];
  
  // Chart dimensions
  const width = 300;
  const height = 150;
  const padding = 10;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  
  // Calculate points for SVG path
  const points = activityData.map((point, index) => {
    const x = padding + (index / (activityData.length - 1)) * chartWidth;
    const maxValue = Math.max(...activityData.map(d => d.value));
    const normalizedValue = maxValue > 0 ? point.value / maxValue : 0;
    const y = padding + chartHeight - normalizedValue * chartHeight;
    return { x, y, ...point };
  });

  // Generate SVG path
  const linePath = points.map((point, index) => {
    if (index === 0) return `M${point.x},${point.y}`;
    
    // Create smooth curve using quadratic bezier
    const prevPoint = points[index - 1];
    const controlX = (prevPoint.x + point.x) / 2;
    return `Q${controlX},${prevPoint.y} ${point.x},${point.y}`;
  }).join(' ');

  // Generate area path (same as line but with bottom closing)
  const areaPath = linePath + ` L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const total = activityData.reduce((sum, point) => sum + (point.value || 0), 0);
  const maxValue = activityData.reduce((max, point) => Math.max(max, point.value || 0), 0);
  const busiest = activityData.reduce(
    (best, point) => (point.value > best.value ? point : best),
    activityData[0] ?? { day: "-", value: 0 },
  );

  return (
    <div
      tabIndex={0}
      className="group relative bg-white rounded-2xl p-5 border border-slate-100 shadow-md h-[360px] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      aria-label={`${title}: ${total} entries over the last 7 days. Hover or focus to see the daily breakdown.`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 tabular-nums" title="Entries in the last 7 days">
            {total}
          </span>
          {filterOptions.length > 0 && (
            <select
              className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer"
              value={selectedFilter}
              onChange={(e) => onFilterChange?.(e.target.value)}
            >
              {filterOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Line chart */}
          <path
            d={linePath}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
          />

          {/* Area fill */}
          <path
            d={areaPath}
            fill="url(#activityGradient)"
            opacity="0.1"
          />
        </svg>
      </div>

      <div className="flex justify-between text-xs text-slate-400 mt-2">
        {activityData.map((point, index) => (
          <span key={index} title={`${point.day}: ${point.value}`}>{point.day}</span>
        ))}
      </div>

      {/* Daily breakdown. The curve shows the shape; this says what the numbers are. */}
      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border border-slate-200 bg-white p-3 text-left opacity-0 shadow-xl transition-all duration-150 invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last 7 days</span>
          <span className="text-[10px] text-slate-400">
            {total} total{busiest.value > 0 && ` · peak ${busiest.value} on ${busiest.day}`}
          </span>
        </div>
        <ul className="space-y-1">
          {activityData.map((point, index) => (
            <li key={index} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-slate-500">{point.day}</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-16 rounded-full bg-slate-100 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-violet-400"
                    style={{ width: `${maxValue > 0 ? (point.value / maxValue) * 100 : 0}%` }}
                  />
                </span>
                <span className="font-semibold text-slate-700 tabular-nums w-6 text-right">{point.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}