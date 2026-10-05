interface KpiCardProps {
  title: string;
  value: string | number;
  icon: string;
  iconBgColor: string;      
  iconColor?: string;      
  trend?: {
    value: string;
    positive?: boolean;
    bgColor?: string;       
    textColor?: string;     
  };
  subtext?: string;
  valueClassName?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  iconBgColor,
  iconColor = "text-primary",
  trend,
  subtext,
  valueClassName = "text-on-surface",
}: KpiCardProps) {
  // Use trend’s own colors or fallback to icon colors
  const trendBg = trend?.bgColor ?? iconBgColor;
  const trendText = trend?.textColor ?? iconColor;

  return (
    <div className=" shadow-md group relative overflow-hidden rounded-2xl  from-surface-container-lowest to-surface-container-low p-4  hover:shadow-md  hover:border-blue-500 hover:shadow-blue-300 transition-shadow duration-200 h-full flex flex-col justify-between border-0">
      {/* Animated blur background */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />

      {/* Top row */}
      <div className="flex justify-between items-start">
        <span className="text-[12px] font-semibold  uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center ${iconColor} shrink-0`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>

      {/* Value and extras */}
      <div className="mt-2">
        <div className="flex items-baseline justify-between flex-wrap gap-1">
          <span className={`text-2xl font-bold ${valueClassName}`}>{value}</span>
          {trend && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-0.5 ${trendBg} ${trendText}`}>
              <span className="material-symbols-outlined text-[14px]">{trend.positive ? 'trending_up' : 'trending_down'}</span>
              {trend.value}
            </span>
          )}
        </div>
        {subtext && (
          <div className="text-[9px] font-medium text-on-surface-variant/60 uppercase tracking-wider mt-1">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}