import { GlassCard } from "../shared";

interface RecentExportsProps {
  downloads: string[];
}

const REPORT_ICONS: Record<string, string> = {
  "project-status": "monitoring",
  "budget-variance": "account_balance",
  "task-completion": "task_alt",
  "department-workload": "groups",
  "delay-analysis": "speed",
};

const REPORT_COLORS: Record<string, string> = {
  "project-status": "text-indigo-500 bg-indigo-50",
  "budget-variance": "text-emerald-500 bg-emerald-50",
  "task-completion": "text-violet-500 bg-violet-50",
  "department-workload": "text-amber-500 bg-amber-50",
  "delay-analysis": "text-red-500 bg-red-50",
};

export function RecentExports({ downloads }: RecentExportsProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">history</span>
          Recent Exports
        </h3>
        {downloads.length > 0 && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {downloads.length}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        The last report actions from this browser session
      </p>

      {downloads.length > 0 ? (
        <div className="space-y-2">
          {downloads.map((item, index) => {
            const icon = REPORT_ICONS[item] || "description";
            const colorClass = REPORT_COLORS[item] || "text-slate-500 bg-slate-50";
            const label = item.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

            return (
              <div
                key={`${item}-${index}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-700 block truncate">
                    {label}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Downloaded
                    </span>
                    <span className="text-[10px] text-slate-400">
                      PDF
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-lg">description</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-slate-400">folder_open</span>
          </div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">No exports yet</h4>
          <p className="text-xs text-slate-400">
            Generated reports will appear here after download
          </p>
        </div>
      )}

      {/* Quick Stats */}
      {downloads.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total exports this session</span>
            <span className="font-bold text-indigo-600">{downloads.length} reports</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}