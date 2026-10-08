import { useMemo, useState } from "react";
import type { StoredReportRecord } from "../../types";
import {
  SectionCard,
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  Modal,
  ModalCancelButton,
  ModalDangerButton,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface GeneratedReportsProps {
  reports: StoredReportRecord[];
  onView: (report: StoredReportRecord) => void;
  onDownload: (report: StoredReportRecord) => void;
  /** Widened to allow awaiting the parent's delete flow for the confirm-modal loading state. */
  onDelete: (id: string) => void | Promise<void>;
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

/** Soft tile colors keyed by file format (pdf=red, doc=blue, xls/csv=emerald, json=indigo, other=slate). */
const FORMAT_TILES: Record<string, string> = {
  pdf: "bg-red-50 text-red-600",
  doc: "bg-blue-50 text-blue-600",
  docx: "bg-blue-50 text-blue-600",
  xls: "bg-emerald-50 text-emerald-600",
  xlsx: "bg-emerald-50 text-emerald-600",
  csv: "bg-emerald-50 text-emerald-600",
  json: "bg-indigo-50 text-indigo-600",
};

const FORMAT_BADGES: Record<string, string> = {
  pdf: "bg-red-50 text-red-600 border-red-100",
  doc: "bg-blue-50 text-blue-600 border-blue-100",
  docx: "bg-blue-50 text-blue-600 border-blue-100",
  xls: "bg-emerald-50 text-emerald-600 border-emerald-100",
  xlsx: "bg-emerald-50 text-emerald-600 border-emerald-100",
  csv: "bg-emerald-50 text-emerald-600 border-emerald-100",
  json: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function formatTileCls(format: string): string {
  return FORMAT_TILES[format.toLowerCase()] ?? "bg-slate-100 text-slate-600";
}

function formatBadgeCls(format: string): string {
  return FORMAT_BADGES[format.toLowerCase()] ?? "bg-slate-50 text-slate-600 border-slate-200";
}

/** Date-range label derived from the stored generation parameters (when present). */
function dateRangeLabel(record: StoredReportRecord): string | null {
  const start = typeof record.parameters?.startDate === "string" ? record.parameters.startDate : "";
  const end = typeof record.parameters?.endDate === "string" ? record.parameters.endDate : "";
  if (!start && !end) return null;
  const fmt = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt(start || end);
}

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
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [confirmDelete, setConfirmDelete] = useState<StoredReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-report-type counts for the filter chips
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const report of reports) {
      counts[report.reportType] = (counts[report.reportType] ?? 0) + 1;
    }
    return counts;
  }, [reports]);

  const typeOptions = useMemo(() => {
    const known = Object.keys(REPORT_NAMES).filter((type) => typeCounts[type]);
    const unknown = Object.keys(typeCounts).filter((type) => !REPORT_NAMES[type]);
    return [...known, ...unknown].map((type) => ({
      value: type,
      label: REPORT_NAMES[type] ?? type,
      count: typeCounts[type],
    }));
  }, [typeCounts]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = reports;
    if (typeFilter) {
      list = list.filter((report) => report.reportType === typeFilter);
    }
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
  }, [reports, query, typeFilter, sortKey]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(confirmDelete.id);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderMeta = (report: StoredReportRecord) => {
    const range = dateRangeLabel(report);
    const typeLabel = REPORT_NAMES[report.reportType] ?? report.reportType.replace(/-/g, " ");
    return (
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
          <Icon name="analytics" size={10} />
          {typeLabel}
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Icon name="calendar_today" size={11} />
          {new Date(report.generatedDate).toLocaleDateString()}
        </span>
        <span className="text-[10px] text-slate-400">{formatSize(report.sizeBytes)}</span>
        {range && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
            <Icon name="schedule" size={10} />
            {range}
          </span>
        )}
      </div>
    );
  };

  const renderActions = (report: StoredReportRecord, layout: "card" | "row") => {
    if (layout === "card") {
      return (
        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onView(report)}
            aria-label={`View report: ${REPORT_NAMES[report.reportType] || report.name}`}
            className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
          >
            <Icon name="view" size={12} />
            View
          </button>
          <button
            type="button"
            onClick={() => onDownload(report)}
            aria-label={`Download report: ${REPORT_NAMES[report.reportType] || report.name}`}
            className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            <Icon name="download" size={12} />
            Download
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(report)}
            aria-label={`Delete report: ${REPORT_NAMES[report.reportType] || report.name}`}
            title="Delete report"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <Icon name="delete" size={12} />
          </button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onView(report)}
          aria-label={`View report: ${REPORT_NAMES[report.reportType] || report.name}`}
          title="View report"
          className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
        >
          <Icon name="view" size={13} className="text-indigo-600" />
        </button>
        <button
          type="button"
          onClick={() => onDownload(report)}
          aria-label={`Download report: ${REPORT_NAMES[report.reportType] || report.name}`}
          title="Download report"
          className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors"
        >
          <Icon name="download" size={13} className="text-emerald-600" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(report)}
          aria-label={`Delete report: ${REPORT_NAMES[report.reportType] || report.name}`}
          title="Delete report"
          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
        >
          <Icon name="delete" size={13} className="text-red-500" />
        </button>
      </div>
    );
  };

  return (
    <SectionCard
      title="Generated reports"
      description="Recently generated reports stored in your workspace"
      icon="description"
      noBodyPadding
      bodyClassName="flex flex-col"
    >
      {/* Filter Bar */}
      <div className="p-3 border-b border-slate-100">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search reports..."
          chipGroups={
            typeOptions.length > 0
              ? [
                  {
                    key: "type",
                    label: "Type",
                    options: [
                      { value: "", label: "All", count: reports.length },
                      ...typeOptions,
                    ],
                    value: typeFilter,
                    onChange: setTypeFilter,
                  },
                ]
              : []
          }
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
          reports.length === 0 ? (
            <EmptyState
              icon="description"
              title="No reports yet"
              description="Generate a report above to see it stored here."
              accent="primary"
              compact
            />
          ) : (
            <EmptyState
              icon="search"
              title="No reports match"
              description="Nothing matches the current search or type filter. Adjust them to see more results."
              accent="neutral"
              compact
            />
          )
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 gap-2 view-fade">
            {filtered.map((report, index) => {
              const icon = REPORT_ICONS[report.reportType] || "description";
              const name = REPORT_NAMES[report.reportType] || report.name;
              return (
                <div
                  key={report.id}
                  className="card-stagger flex flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formatTileCls(report.format)}`}>
                      <Icon name={icon} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-slate-800 block truncate">
                          {name}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${formatBadgeCls(report.format)}`}>
                          {report.format}
                        </span>
                      </div>
                      {renderMeta(report)}
                    </div>
                  </div>
                  {renderActions(report, "card")}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 view-fade">
            {filtered.map((report, index) => {
              const icon = REPORT_ICONS[report.reportType] || "description";
              const name = REPORT_NAMES[report.reportType] || report.name;
              return (
                <div
                  key={report.id}
                  className="card-stagger group flex items-center gap-3 py-2.5 px-1.5 rounded-lg hover:bg-slate-50/70 transition-colors"
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formatTileCls(report.format)}`}>
                    <Icon name={icon} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-semibold text-slate-700 block truncate">
                        {name}
                      </span>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border ${formatBadgeCls(report.format)}`}>
                        {report.format}
                      </span>
                    </div>
                    {renderMeta(report)}
                  </div>
                  {renderActions(report, "row")}
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

      {/* Delete confirmation */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        title="Delete report"
        description={
          confirmDelete
            ? `This will permanently delete "${REPORT_NAMES[confirmDelete.reportType] || confirmDelete.name}".`
            : undefined
        }
        icon="delete"
        accent="danger"
        size="sm"
        footer={
          <>
            <ModalCancelButton
              onClick={() => setConfirmDelete(null)}
            />
            <ModalDangerButton
              onClick={handleConfirmDelete}
              loading={deleting}
              label="Delete report"
            />
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <Icon name="info" size={14} className="shrink-0 mt-0.5" />
          <span>The stored file will be removed from your workspace. This action cannot be undone.</span>
        </div>
      </Modal>
    </SectionCard>
  );
}
