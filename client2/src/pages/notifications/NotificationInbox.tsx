import { useMemo, useState } from "react";
import type { NotificationItem } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
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
  Medium: 1,
  Low: 2,
};

const PRIORITY_BADGE: Record<string, string> = {
  High: "bg-red-50 text-red-600 border border-red-100",
  Medium: "bg-amber-50 text-amber-600 border border-amber-100",
  Low: "bg-blue-50 text-blue-600 border border-blue-100",
};

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
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
  }, [items, query, sortKey]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search notifications..."
        chipGroups={[
          {
            key: "view",
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
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
              title="Mark all as read"
            >
              <Icon name="check-circle" size={14} />
              Mark All Read
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={() => void onBroadcast()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                <Icon name="hi-speakerphone" size={14} />
                Broadcast
              </button>
            )}
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

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          {items.length} notifications
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={view === "unread" ? "check-circle" : "hi-inbox"}
          title={view === "unread" ? "No unread notifications" : "No notifications"}
          description={
            view === "unread"
              ? "You are all caught up."
              : "You are all caught up!"
          }
          accent={view === "unread" ? "success" : "primary"}
        />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
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
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden pb-10 view-fade">
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onOpen={() => void onOpen(item)}
                onMarkRead={() => void onMarkRead(item.id)}
                onDelete={() => void onDelete(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
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
  const priorityCls =
    PRIORITY_BADGE[item.priority] || "bg-slate-100 text-slate-600 border border-slate-200";

  return (
    <div
      className={`group flex flex-col h-full rounded-2xl border bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 ${
        !item.isRead ? "border-indigo-200" : "border-slate-100"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded-lg"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {!item.isRead && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            )}
            <h3
              className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-indigo-700 transition-colors"
              title={item.title}
            >
              {item.title}
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium shrink-0">
            {item.type}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-3">
          {item.message}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${priorityCls}`}
          >
            {item.priority}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              item.isRead
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-amber-50 text-amber-600 border border-amber-100"
            }`}
          >
            {item.isRead ? "Read" : "Unread"}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Icon name="schedule" size={11} />
            {new Date(item.createdDate).toLocaleDateString()}
          </span>
        </div>
      </button>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
        {!item.isRead && (
          <button
            type="button"
            onClick={onMarkRead}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors"
          >
            <Icon name="check-circle" size={11} />
            Mark Read
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
        >
          <Icon name="delete" size={11} />
          Delete
        </button>
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
  const priorityCls =
    PRIORITY_BADGE[item.priority] || "bg-slate-100 text-slate-600 border border-slate-200";

  return (
    <div
      className={`p-4 transition-colors ${
        !item.isRead
          ? "bg-indigo-50/40 border-l-4 border-l-indigo-500"
          : "hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {!item.isRead && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
            )}
            <strong className="text-slate-800 font-semibold text-sm">{item.title}</strong>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
              {item.type}
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-2 line-clamp-2">{item.message}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${priorityCls}`}
            >
              {item.priority}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                item.isRead
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}
            >
              {item.isRead ? "Read" : "Unread"}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Icon name="schedule" size={11} />
              {new Date(item.createdDate).toLocaleDateString()}
            </span>
          </div>
        </button>
        <div className="flex flex-col gap-1.5 shrink-0">
          {!item.isRead && (
            <button
              type="button"
              onClick={onMarkRead}
              className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
            >
              Mark Read
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
