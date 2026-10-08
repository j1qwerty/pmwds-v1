import { useMemo, useState } from "react";
import type { StoredReportRecord } from "../../types";
import {
  SectionCard,
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

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

type SortKey = "newest" | "oldest" | "nameAsc" | "sizeDesc";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "sizeDesc", label: "Largest size" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GeneratedReports({ reports, onView, onDownload, onDelete, loading }: GeneratedReportsProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = reports;
    if (term) {
      list = list.filter((report) => {
        const name = REPORT_NAMES[report.reportType] || report.name;
        return [name, report.reportType, report.format]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
    }
    const sorted = [...list];
    if (sortKey === "newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.generatedDate).getTime() -
          new Date(a.generatedDate).getTime()
      );
    } else if (sortKey === "oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.generatedDate).getTime() -
          new Date(b.generatedDate).getTime()
      );
    } else if (sortKey === "nameAsc") {
      sorted.sort((a, b) => {
        const an = REPORT_NAMES[a.reportType] || a.name;
        const bn = REPORT_NAMES[b.reportType] || b.name;
        return an.localeCompare(bn);
      });
    } else if (sortKey === "sizeDesc") {
      sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
    }
    return sorted;
  }, [reports, query, sortKey]);

  return (
    <SectionCard
      title="Generated Reports"
      description="Recently generated reports stored in your workspace"
      icon="schedule"
      noBodyPadding
      bodyClassName="flex flex-col"
    >
      {/* Filter Bar */}
      <div className="p-3 border-b border-slate-100">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search reports..."
          actions={
            <>
              <SortDropdown
                value={sortKey}
                onChange={(v) => setSortKey(v as SortKey)}
                options={SORT_OPTIONS}
              />
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                available={["card", "list"]}
              />
            </>
          }
        />
      </div>

      {/* Results meta */}
      {reports.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100 bg-slate-50/40">
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          {reports.length} reports
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title="No reports yet"
            description="Generate a report above to see it here."
            accent="primary"
            compact
          />
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 gap-2 view-fade">
            {filtered.map((report) => {
              const icon = REPORT_ICONS[report.reportType] || "description";
              const name = REPORT_NAMES[report.reportType] || report.name;
              const date = new Date(report.generatedDate).toLocaleDateString();
              return (
                <div
                  key={report.id}
                  className="group flex flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Icon name={icon} size={16} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-800 block truncate">
                        {name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Icon name="calendar_today" size={11} />
                          {date}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatSize(report.sizeBytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => onView(report)}
                      className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <Icon name="view" size={12} />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(report)}
                      className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      <Icon name="download" size={12} />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(report.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                      title="Delete report"
                    >
                      <Icon name="delete" size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 view-fade">
            {filtered.map((report) => {
              const icon = REPORT_ICONS[report.reportType] || "description";
              const name = REPORT_NAMES[report.reportType] || report.name;
              const date = new Date(report.generatedDate).toLocaleDateString();
              return (
                <div
                  key={report.id}
                  className="group flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon name={icon} size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-700 block truncate">
                      {name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Icon name="calendar_today" size={11} />
                        {date}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatSize(report.sizeBytes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onView(report)}
                      className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                      title="View report"
                    >
                      <Icon name="view" size={13} className="text-indigo-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(report)}
                      className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                      title="Download report"
                    >
                      <Icon name="download" size={13} className="text-emerald-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(report.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="Delete report"
                    >
                      <Icon name="delete" size={13} className="text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {reports.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between text-xs">
          <span className="text-slate-400">Total reports stored</span>
          <span className="font-bold text-indigo-600">{reports.length} reports</span>
        </div>
      )}
    </SectionCard>
  );
}
