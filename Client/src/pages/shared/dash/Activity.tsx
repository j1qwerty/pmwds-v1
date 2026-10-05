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

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-md h-[430px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
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
          <span key={index}>{point.day}</span>
        ))}
      </div>
    </div>
  );
}