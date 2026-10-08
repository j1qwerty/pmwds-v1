import { useMemo, useState } from "react";
import type { NotificationItem } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  PageContainer,
  StatCard,
  getPriorityColor,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationInboxProps {
  /** Already narrowed to the active view. */
  items: NotificationItem[];
  /**
   * Unread total across the whole inbox. Passed separately because `items` is filtered, so
   * the badge on the Unread tab would otherwise read 0 while that tab is selected.
   */
  unreadCount: number;
  /** Total across the whole inbox, for the All tab badge. */
  totalCount: number;
  view: "all" | "unread";
  onViewChange: (view: "all" | "unread") => void;
  onOpen: (item: NotificationItem) => void | Promise<void>;
  onMarkRead: (id: string) => void | Promise<void>;
  onMarkAllRead: () => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onBroadcast: () => void | Promise<void>;
  canWrite: boolean;
}

type SortKey = "newest" | "oldest" | "priority";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "Priority (high → low)" },
];

const PRIORITY_RANK: Record<string, number> = {
  High: 0,
  Critical: 0,
  Medium: 1,
  Low: 2,
};

/* ── Relative timestamps (inline, no new deps) ───────────────────── */

function formatRelativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function isToday(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}

/* ── Small presentational helpers ────────────────────────────────── */

function TypeChip({ type }: { type: string }) {
  return (
    <span className="inline-flex max-w-[140px] items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
      {type}
    </span>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const c = getPriorityColor(priority);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.border} ${c.text}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {priority}
    </span>
  );
}

function UnreadChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
      New
    </span>
  );
}

function IconAction({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone: "indigo" | "red";
}) {
  const toneCls =
    tone === "indigo"
      ? "text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
      : "text-slate-400 hover:bg-red-50 hover:text-red-600";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${toneCls}`}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

export function NotificationInbox({
  items,
  unreadCount,
  totalCount,
  view,
  onViewChange,
  onOpen,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onBroadcast,
  canWrite,
}: NotificationInboxProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.type, (counts.get(item.type) ?? 0) + 1));
    return [
      { value: "", label: "All types", count: items.length },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = items;
    if (term) {
      list = list.filter((item) =>
        [item.title, item.message, item.type, item.priority]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    if (typeFilter) {
      list = list.filter((item) => item.type === typeFilter);
    }
    const sorted = [...list];
    if (sortKey === "newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
      );
    } else if (sortKey === "oldest") {
      sorted.sort(
        (a, b) =>
          new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
      );
    } else if (sortKey === "priority") {
      sorted.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)
      );
    }
    return sorted;
  }, [items, query, typeFilter, sortKey]);

  const todayCount = useMemo(
    () => items.filter((item) => isToday(item.createdDate)).length,
    [items]
  );
  const highPriorityCount = useMemo(
    () => items.filter((item) => item.priority === "High" || item.priority === "Critical").length,
    [items]
  );

  const noMatch = filtered.length === 0 && items.length > 0;

  return (
    <PageContainer
      stats={
        <>
          <StatCard label="Total notifications" value={totalCount} color="indigo" icon="notifications" />
          <StatCard label="Unread" value={unreadCount} color="amber" icon="mark_email_unread" />
          <StatCard label="Received today" value={todayCount} color="sky" icon="today" />
          <StatCard label="High priority" value={highPriorityCount} color="red" icon="priority_high" />
        </>
      }
      filters={
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search notifications..."
          chipGroups={[
            {
              key: "view",
              label: "Show",
              options: [
                { value: "all", label: "All", count: totalCount },
                {
                  value: "unread",
                  label: "Unread",
                  count: unreadCount,
                  color: { dot: "bg-amber-500" },
                },
              ],
              value: view,
              onChange: (v) => onViewChange(v as "all" | "unread"),
            },
            ...(items.length > 0
              ? [
                  {
                    key: "type",
                    label: "Type",
                    options: typeOptions,
                    value: typeFilter,
                    onChange: setTypeFilter,
                  },
                ]
              : []),
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                disabled={unreadCount === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Mark all as read"
              >
                <Icon name="check-circle" size={14} />
                Mark all read
              </button>
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
      }
    >
      {items.length > 0 && (
        <div className="mb-3 text-xs text-slate-400">
          Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of{" "}
          {items.length} notifications
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={view === "unread" ? "check-circle" : "hi-inbox"}
          title={noMatch ? "No matching notifications" : view === "unread" ? "No unread notifications" : "No notifications yet"}
          description={
            noMatch
              ? "Nothing matches the current search and filters. Clear them to see the full inbox."
              : view === "unread"
                ? "You are all caught up."
                : "Notifications about tasks, projects, and broadcasts will appear here."
          }
          accent={view === "unread" ? "success" : "primary"}
          action={
            noMatch ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("");
                  if (view === "unread") onViewChange("all");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                <Icon name="restart-alt" size={14} />
                Clear filters
              </button>
            ) : view === "unread" ? (
              <button
                type="button"
                onClick={() => onViewChange("all")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                <Icon name="hi-inbox" size={14} />
                View all notifications
              </button>
            ) : canWrite ? (
              <button
                type="button"
                onClick={() => void onBroadcast()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:from-indigo-700 hover:to-violet-700"
              >
                <Icon name="hi-speakerphone" size={14} />
                New broadcast
              </button>
            ) : undefined
          }
        />
      ) : viewMode === "card" ? (
        <div className="view-fade grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item, idx) => (
            <div
              key={item.id}
              className="card-stagger"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <NotificationCard
                item={item}
                onOpen={() => void onOpen(item)}
                onMarkRead={() => void onMarkRead(item.id)}
                onDelete={() => void onDelete(item.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="view-fade overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
          <div className="divide-y divide-slate-100">
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                className="card-stagger"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <NotificationRow
                  item={item}
                  onOpen={() => void onOpen(item)}
                  onMarkRead={() => void onMarkRead(item.id)}
                  onDelete={() => void onDelete(item.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

    </PageContainer>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function NotificationCard({
  item,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const unread = !item.isRead;

  return (
    <div
      className={`group flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 ${
        unread ? "border-indigo-200 ring-1 ring-indigo-100" : "border-slate-100"
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            unread ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon name="bell" size={16} />
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon name="schedule" size={11} />
          <time dateTime={item.createdDate} title={formatAbsoluteTime(item.createdDate)}>
            {formatRelativeTime(item.createdDate)}
          </time>
        </span>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <span className="flex items-start gap-2">
          {unread && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
          <span
            className={`block line-clamp-2 text-sm leading-snug transition-colors group-hover:text-indigo-700 ${
              unread ? "font-bold text-slate-800" : "font-semibold text-slate-500"
            }`}
            title={item.title}
          >
            {item.title}
          </span>
        </span>
        <span className={`mt-1.5 block line-clamp-3 text-xs leading-relaxed ${unread ? "text-slate-600" : "text-slate-400"}`}>
          {item.message}
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TypeChip type={item.type} />
        <PriorityChip priority={item.priority} />
        {unread && <UnreadChip />}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
        {unread && (
          <IconAction icon="check-circle" label="Mark as read" onClick={onMarkRead} tone="indigo" />
        )}
        <IconAction icon="delete" label="Delete notification" onClick={onDelete} tone="red" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function NotificationRow({
  item,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  item: NotificationItem;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const unread = !item.isRead;

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 transition-colors ${
        unread ? "bg-white" : "hover:bg-slate-50/70"
      }`}
    >
      {unread && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px] rounded-r bg-gradient-to-b from-indigo-500 to-violet-500"
        />
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            unread ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon name="bell" size={16} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`max-w-full truncate text-sm ${
                unread ? "font-bold text-slate-800" : "font-medium text-slate-500"
              }`}
              title={item.title}
            >
              {item.title}
            </span>
            <TypeChip type={item.type} />
            <PriorityChip priority={item.priority} />
          </span>
          <span className={`mt-1 block truncate text-xs ${unread ? "text-slate-600" : "text-slate-400"}`}>
            {item.message}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Icon name="schedule" size={11} />
            <time dateTime={item.createdDate} title={formatAbsoluteTime(item.createdDate)}>
              {formatRelativeTime(item.createdDate)}
            </time>
            {unread && <UnreadChip />}
          </span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        {unread && (
          <IconAction icon="check-circle" label="Mark as read" onClick={onMarkRead} tone="indigo" />
        )}
        <IconAction icon="delete" label="Delete notification" onClick={onDelete} tone="red" />
      </div>
    </div>
  );
}
