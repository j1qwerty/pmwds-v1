import { AvatarStack } from "../shared";

export function ActiveObjectives({
  objectives,
  title = "My Tasks",
  subtitle,
}: {
  objectives?: Array<{
    id: string;
    category: string;
    title: string;
    progressPercentage: number;
    assignees?: Array<{ id?: string; userId?: string; fullName?: string; name?: string; profilePictureUrl?: string | null }>;
  }>;
  title?: string;
  subtitle?: string;
}) {
  const objectiveList = objectives ?? [];

  // Map category names to colors
  const getCategoryMeta = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes("infrastructure") || lower.includes("q4")) {
      return {
        barClass: "primary-gradient",
      };
    }
    if (lower.includes("product") || lower.includes("excellence") || lower.includes("design")) {
      return {
        barClass: "bg-secondary",
      };
    }
    if (lower.includes("security") || lower.includes("ops")) {
      return {
        barClass: "bg-error",
      };
    }
    return {
      barClass: "primary-gradient",
    };
  };

  if (!objectiveList.length) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-lg ambient-glow">
        <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary">track_changes</span>
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
          </div>
          {subtitle && <span className="text-outline font-label-caps text-[10px]">{subtitle}</span>}
        </div>
        <div className="flex flex-col items-center justify-center py-lg text-center">
          <span className="material-symbols-outlined text-outline text-4xl mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            track_changes
          </span>
          <p className="text-on-surface-variant text-sm">No active Tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl p-lg ambient-glow">
      <div className="flex justify-between items-center mb-md pb-sm border-b border-surface-variant">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">track_changes</span>
            <span className=" text-lg font-h2 text-on-surface">{title}</span>
        </div>
        {subtitle && <span className="text-outline font-label-caps text-[10px]">{subtitle}</span>}
      </div>
      <div className="flex flex-col">
        {objectiveList.map((obj) => {
          const meta = getCategoryMeta(obj.category);
          const progress = Math.min(obj.progressPercentage, 100);
          const isCompleted = progress >= 100;

          return (
            <div
              key={obj.id}
              className="flex items-center justify-between py-md px-sm rounded-lg hover:bg-surface-container-low transition-colors group border-b border-surface-variant/50 last:border-b-0"
            >
              <div className="flex items-center gap-md">
                <span className={`material-symbols-outlined ${isCompleted ? "text-primary" : "text-outline"} group-hover:text-primary transition-colors`}>
                  {isCompleted ? "check_circle" : "radio_button_unchecked"}
                </span>
                <div className="flex flex-col">
                  <span className="font-body-md text-on-surface font-medium">{obj.title}</span>
                  <span className="text-[11px] text-on-surface-variant">
                    {obj.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-xl">
                <div className="w-24">
                  <div className="flex flex-col gap-xs">
                    <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${meta.barClass} rounded-full`} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                    <span className="text-[11px] font-numeric text-on-surface-variant text-right">
                      {progress}% Complete
                    </span>
                  </div>
                </div>
                {/* {obj.assignees && obj.assignees.length > 0 && (
                  <AvatarStack people={obj.assignees} limit={2} size="xs" />
                )} */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}