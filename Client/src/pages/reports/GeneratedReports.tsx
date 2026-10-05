import type { StoredReportRecord } from "../../types";
import { GlassCard } from "../shared";

interface GeneratedReportsProps {
  reports: StoredReportRecord[];
  onView: (report: StoredReportRecord) => void;
  onDownload: (report: StoredReportRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

const REPORT_ICONS: Record<string, string> = {
  "project-status": "monitoring",
  "budget-variance": "account_balance",
  "task-completion": "task_alt",
  "department-workload": "groups",
  "delay-analysis": "speed",
};

const REPORT_NAMES: Record<string, string> = {
  "project-status": "Project Status",
  "budget-variance": "Budget Variance",
  "task-completion": "Task Completion",
  "department-workload": "Department Workload",
  "delay-analysis": "Delay Analysis",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GeneratedReports({ reports, onView, onDownload, onDelete, loading }: GeneratedReportsProps) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">history</span>
          Generated Reports
        </h3>
        {reports.length > 0 && (
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
            {reports.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((report) => {
            const icon = REPORT_ICONS[report.reportType] || "description";
            const name = REPORT_NAMES[report.reportType] || report.name;
            const date = new Date(report.generatedDate).toLocaleDateString();

            return (
              <div
                key={report.id}
                className="group flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-lg text-indigo-500">{icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-700 block truncate">
                    {name}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">calendar_today</span>
                      {date}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatSize(report.sizeBytes)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onView(report)}
                    className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                    title="View report"
                  >
                    <span className="material-symbols-outlined text-sm text-indigo-500">visibility</span>
                  </button>
                  <button
                    onClick={() => onDownload(report)}
                    className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                    title="Download report"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-500">download</span>
                  </button>
                  <button
                    onClick={() => onDelete(report.id)}
                    className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                    title="Delete report"
                  >
                    <span className="material-symbols-outlined text-sm text-red-500">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-slate-400">folder_open</span>
          </div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">No reports yet</h4>
          <p className="text-xs text-slate-400">
            Generate a report above to see it here
          </p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total reports stored</span>
            <span className="font-bold text-indigo-600">{reports.length} reports</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
