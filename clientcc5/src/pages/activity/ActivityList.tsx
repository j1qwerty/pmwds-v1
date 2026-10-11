import { useState } from "react";
import type { ActivityLogRecord, User } from "../../types";
import { Avatar, EmptyState, GlassCard, type ViewMode } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ActivityListProps {
  logs: ActivityLogRecord[];
  users: User[];
  view: ViewMode;
  /** Kept for backward compatibility — the toggle now lives in the filter bar. */
  onViewChange?: (view: ViewMode) => void;
}

/* ------------------------------------------------------------------ */
/* Shared helpers (page-folder local, no new dependencies)             */
/* ------------------------------------------------------------------ */

/** Consistent type → icon + soft-color mapping (StatCard colorMap convention). */
export interface ActivityVisual {
  icon: string;
  tile: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dot: string;
}

const VISUALS: Record<string, ActivityVisual> = {
  emerald: {
    icon: "add",
    tile: "bg-emerald-50 text-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-100",
    dot: "bg-emerald-500",
  },
  red: {
    icon: "delete",
    tile: "bg-red-50 text-red-600",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    badgeBorder: "border-red-100",
    dot: "bg-red-500",
  },
  amber: {
    icon: "edit",
    tile: "bg-amber-50 text-amber-600",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-100",
    dot: "bg-amber-500",
  },
  blue: {
    icon: "visibility",
    tile: "bg-blue-50 text-blue-600",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-100",
    dot: "bg-blue-500",
  },
  indigo: {
    icon: "history",
    tile: "bg-indigo-50 text-indigo-600",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-100",
    dot: "bg-indigo-500",
  },
};

export function getActivityVisual(type: string): ActivityVisual {
  const lower = type?.toLowerCase() || "";
  if (lower.includes("login")) return { ...VISUALS.emerald, icon: "login" };
  if (lower.includes("logout")) return { ...VISUALS.red, icon: "logout" };
  if (lower.includes("create") || lower.includes("add")) return { ...VISUALS.emerald, icon: "add" };
  if (lower.includes("complete")) return { ...VISUALS.emerald, icon: "check_circle" };
  if (lower.includes("approve")) return { ...VISUALS.emerald, icon: "check" };
  if (lower.includes("submit")) return { ...VISUALS.emerald, icon: "arrow_forward" };
  if (lower.includes("delete") || lower.includes("reject")) return { ...VISUALS.red, icon: "delete" };
  if (lower.includes("update") || lower.includes("edit")) return { ...VISUALS.amber, icon: "edit" };
  if (lower.includes("assign")) return { ...VISUALS.amber, icon: "person_add" };
  if (lower.includes("import")) return { ...VISUALS.amber, icon: "upload" };
  if (lower.includes("export")) return { ...VISUALS.blue, icon: "download" };
  if (lower.includes("view")) return { ...VISUALS.blue, icon: "visibility" };
  return VISUALS.indigo;
}

/** Tiny relative-time formatter: "just now", "5m ago", "2h ago", "3d ago", falls back to a date. */
export function relTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const suffix = diffMs >= 0 ? "ago" : "from now";
  const absMinutes = Math.floor(Math.abs(diffMs) / 60000);
  if (absMinutes < 1) return "just now";
  if (absMinutes < 60) return `${absMinutes}m ${suffix}`;
  const hours = Math.floor(absMinutes / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ${suffix}`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    "en-GB",
    sameYear
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" }
  );
}

/** Absolute timestamp for title attributes: "5 Mar 2025, 14:32". */
function absoluteTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  return JSON.stringify(metadata, null, 2);
}

function metadataOf(log: ActivityLogRecord): string | null {
  return typeof log.metadata === "string"
    ? log.metadata
    : formatMetadata(log.metadata as Record<string, unknown> | null);
}

function TypeBadge({ type, className = "" }: { type: string; className?: string }) {
  const visual = getActivityVisual(type);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${visual.badgeBg} ${visual.badgeText} ${visual.badgeBorder} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${visual.dot}`} />
      <span className="max-w-[160px] truncate">{type}</span>
    </span>
  );
}

function EntityChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 max-w-[180px]">
      <Icon name="folder_open" size={10} className="text-slate-400 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function ActorName({ user, userName }: { user: User | undefined; userName?: string | null }) {
  return (
    <span
      className={`text-[11px] font-semibold truncate ${user?.isActive === false ? "text-red-400" : "text-slate-600"}`}
    >
      {userName || "Unknown user"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ActivityList({ logs, users, view }: ActivityListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <GlassCard className="view-fade">
        <EmptyState
          icon="history"
          title="No activity found"
          description="Nothing matches the current filters. Try adjusting or clearing the filters to see more activity."
          accent="primary"
        />
      </GlassCard>
    );
  }

  if (view === "card") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 view-fade">
        {logs.map((log, idx) => {
          const user = users.find((u) => u.id === log.userId);
          const userName = log.userName ?? user?.fullName;
          const visual = getActivityVisual(log.activityType);
          const metadata = metadataOf(log);

          return (
            <GlassCard
              key={log.id}
              className="card-stagger p-4 hover:border-indigo-200 hover:shadow-md"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.tile}`}
                  title={log.activityType}
                >
                  <Icon name={visual.icon} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <TypeBadge type={log.activityType} />
                    <span
                      className="text-[10px] font-medium text-slate-400 shrink-0 whitespace-nowrap"
                      title={absoluteTime(log.timestamp)}
                    >
                      {relTime(log.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mb-2.5">
                    {log.description || "No description provided."}
                  </p>

                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      person={user ?? undefined}
                      name={user ? undefined : (userName ?? undefined)}
                      size="xs"
                      className="shrink-0 shadow-none ring-0"
                    />
                    <ActorName user={user} userName={userName} />
                    {log.projectName && <EntityChip label={log.projectName} />}
                  </div>

                  {metadata && (
                    <details className="mt-2.5">
                      <summary className="text-[10px] text-indigo-500 cursor-pointer hover:text-indigo-600 font-semibold select-none">
                        View metadata
                      </summary>
                      <pre className="mt-1.5 p-2 rounded-lg bg-slate-50 text-[10px] text-slate-600 overflow-x-auto font-mono border border-slate-100">
                        {metadata}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    );
  }

  return (
    <GlassCard className="overflow-hidden view-fade">
      <div className="divide-y divide-slate-100">
        {logs.map((log, idx) => {
          const user = users.find((u) => u.id === log.userId);
          const userName = log.userName ?? user?.fullName;
          const visual = getActivityVisual(log.activityType);
          const metadata = metadataOf(log);
          const expanded = expandedId === log.id;

          return (
            <div
              key={log.id}
              className="card-stagger group px-4 py-3 hover:bg-slate-50/70 transition-colors"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.tile}`}
                  title={log.activityType}
                >
                  <Icon name={visual.icon} size={17} />
                </div>

                <div className="flex items-center gap-2 w-32 sm:w-40 shrink-0 min-w-0">
                  <Avatar
                    person={user ?? undefined}
                    name={user ? undefined : (userName ?? undefined)}
                    size="sm"
                    className="shrink-0"
                  />
                  <ActorName user={user} userName={userName} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 truncate">
                    {log.description || <span className="text-slate-400">No description provided.</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                      {log.activityType}
                    </span>
                    {log.projectName && (
                      <span className="hidden sm:inline-flex">
                        <EntityChip label={log.projectName} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {metadata && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : log.id)}
                      aria-label="Toggle metadata"
                      aria-expanded={expanded}
                      title="View metadata"
                      className="w-7 h-7 rounded-lg hidden sm:flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Icon name="hi-code" size={14} />
                    </button>
                  )}
                  <span
                    className="text-[11px] font-medium text-slate-400 w-16 text-right whitespace-nowrap"
                    title={absoluteTime(log.timestamp)}
                  >
                    {relTime(log.timestamp)}
                  </span>
                </div>
              </div>

              {expanded && metadata && (
                <pre className="mt-2.5 p-2.5 rounded-lg bg-slate-50 text-[10px] text-slate-600 overflow-x-auto font-mono border border-slate-100">
                  {metadata}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
