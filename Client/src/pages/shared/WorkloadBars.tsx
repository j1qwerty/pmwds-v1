export interface WorkloadItem {
  id: string;
  name: string;
  score: number;
  workloadScore?: number;
  activeTasks?: number;
  memberCount?: number;
}

export function WorkloadBars({
  items,
  title = "Workload Distribution",
  isDepartment = false,
}: {
  items?: WorkloadItem[];
  title?: string;
  isDepartment?: boolean;
}) {
  const workloadItems = items?.map(item => ({
    ...item,
    score: item.workloadScore ?? item.score,
  })) ?? [];

  if (!workloadItems.length) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-lg ambient-glow">
        <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
          <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">more_horiz</span>
        </div>
        <div className="flex flex-col items-center justify-center py-lg text-center">
          <span className="material-symbols-outlined text-outline text-4xl mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            monitoring
          </span>
          <p className="text-on-surface-variant text-sm">No workload data</p>
        </div>
      </div>
    );
  }

  const departmentColors = [
    { barColor: "bg-primary", textColor: "text-primary", gradient: "from-primary/20 to-primary/5" },
    { barColor: "bg-secondary", textColor: "text-secondary", gradient: "from-secondary/20 to-secondary/5" },
    { barColor: "bg-tertiary", textColor: "text-tertiary", gradient: "from-tertiary/20 to-tertiary/5" },
    { barColor: "bg-error", textColor: "text-error", gradient: "from-error/20 to-error/5" },
    { barColor: "bg-amber-500", textColor: "text-amber-600", gradient: "from-amber-500/20 to-amber-500/5" },
    { barColor: "bg-emerald-500", textColor: "text-emerald-600", gradient: "from-emerald-500/20 to-emerald-500/5" },
    { barColor: "bg-blue-500", textColor: "text-blue-600", gradient: "from-blue-500/20 to-blue-500/5" },
    { barColor: "bg-purple-500", textColor: "text-purple-600", gradient: "from-purple-500/20 to-purple-500/5" },
  ];

  const getCapacityInfo = (index: number, score: number) => {
    const color = departmentColors[index % departmentColors.length];
    
    if (score >= 100) {
      return {
        label: "Overflow",
        barColor: "bg-error",
        textColor: "text-error font-bold",
      };
    }
    if (score >= 80) {
      return {
        label: "Capacity",
        barColor: color.barColor,
        textColor: color.textColor,
      };
    }
    return {
      label: "Optimal",
      barColor: color.barColor,
      textColor: color.textColor,
    };
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-lg ambient-glow">
      <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors">more_horiz</span>
      </div>
      <div className="flex flex-col gap-lg mt-md">
        {workloadItems.map((item, index) => {
          const score = Number(item.score ?? 0);
          const normalizedScore = score <= 1 ? score * 100 : score;
          const capacity = getCapacityInfo(index, normalizedScore);
          const color = departmentColors[index % departmentColors.length];

          return (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-[13px]">
                <div className="flex flex-col">
                  <span className={`font-medium ${color.textColor}`}>{item.name}</span>
                  {isDepartment && item.memberCount !== undefined && (
                    <span className="text-[11px] text-on-surface-variant">{item.memberCount} members</span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className={`font-numeric ${capacity.textColor}`}>
                    {Math.round(normalizedScore)}% {capacity.label}
                  </span>
                  {item.activeTasks !== undefined && (
                    <span className="text-[11px] text-on-surface-variant">{item.activeTasks} active</span>
                  )}
                </div>
              </div>
              <div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden">
                <div 
                  className={`h-full ${capacity.barColor} rounded-full`} 
                  style={{ width: `${Math.min(normalizedScore, 100)}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}