import { useMemo, useState } from "react";
import type { AlertRuleRecord } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  PageContainer,
  StatCard,
  Skeleton,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationRulesProps {
  rules: AlertRuleRecord[];
  onEdit: (rule: AlertRuleRecord) => void;
  onDelete: (rule: AlertRuleRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
  /** True while the rules list is being fetched for this tab. */
  loading?: boolean;
}

type SortKey = "nameAsc" | "nameDesc" | "recent";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "recent", label: "Recently triggered" },
];

/* ── Relative timestamps (inline, no new deps) ───────────────────── */

function formatRelativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "just now";
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

/* ── Small presentational helpers ────────────────────────────────── */

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
      }`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
      {enabled ? "Active" : "Disabled"}
    </span>
  );
}

function ConditionFlow({ condition, action }: { condition: string; action: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        {condition}
      </span>
      <Icon name="arrow_forward" size={12} className="text-slate-300" />
      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
        {action}
      </span>
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

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="divide-y divide-slate-100">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationRules({
  rules,
  onEdit,
  onDelete,
  onCreate,
  canWrite,
  loading = false,
}: NotificationRulesProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nameAsc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = rules;
    if (term) {
      list = list.filter((rule) =>
        [rule.name, rule.conditionType, rule.actionType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    if (statusFilter === "active") list = list.filter((r) => r.isEnabled);
    if (statusFilter === "disabled") list = list.filter((r) => !r.isEnabled);

    const sorted = [...list];
    if (sortKey === "nameAsc") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === "nameDesc") sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortKey === "recent") {
      sorted.sort((a, b) => {
        const at = a.lastTriggered ? new Date(a.lastTriggered).getTime() : 0;
        const bt = b.lastTriggered ? new Date(b.lastTriggered).getTime() : 0;
        return bt - at;
      });
    }
    return sorted;
  }, [rules, query, statusFilter, sortKey]);

  const activeCount = useMemo(() => rules.filter((r) => r.isEnabled).length, [rules]);
  const disabledCount = rules.length - activeCount;
  const neverTriggeredCount = useMemo(
    () => rules.filter((r) => !r.lastTriggered).length,
    [rules]
  );

  const createButton = canWrite ? (
    <button
      type="button"
      onClick={onCreate}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition-all hover:from-indigo-700 hover:to-violet-700"
    >
      <Icon name="add" size={14} />
      New rule
    </button>
  ) : undefined;

  return (
    <PageContainer
      stats={
        loading ? undefined : (
          <>
            <StatCard label="Total rules" value={rules.length} color="indigo" icon="rule" />
            <StatCard label="Active" value={activeCount} color="emerald" icon="check_circle" />
            <StatCard label="Disabled" value={disabledCount} color="slate" icon="pause_circle" />
            <StatCard label="Never triggered" value={neverTriggeredCount} color="amber" icon="history" />
          </>
        )
      }
      filters={
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search rules by name, condition, action..."
          chipGroups={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "", label: "All", count: rules.length },
                {
                  value: "active",
                  label: "Active",
                  count: activeCount,
                  color: { dot: "bg-emerald-500" },
                },
                {
                  value: "disabled",
                  label: "Disabled",
                  count: disabledCount,
                  color: { dot: "bg-slate-400" },
                },
              ],
              value: statusFilter,
              onChange: setStatusFilter,
            },
          ]}
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
              {createButton}
            </>
          }
        />
      }
    >
      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="rule"
          title="No alert rules"
          description={
            canWrite
              ? "Create rules to automate notification delivery when conditions are met."
              : "No alert rules have been configured yet."
          }
          accent="primary"
          action={createButton}
        />
      ) : viewMode === "card" ? (
        <div className="view-fade grid grid-cols-1 gap-4 pb-8 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((rule, idx) => (
            <div
              key={rule.id}
              className="card-stagger"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <RuleCard
                rule={rule}
                onEdit={() => onEdit(rule)}
                onDelete={() => onDelete(rule)}
                canWrite={canWrite}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="view-fade overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-xl">
          <div className="divide-y divide-slate-100">
            {filtered.map((rule, idx) => (
              <div
                key={rule.id}
                className="card-stagger flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70"
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    rule.isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon name="rule" size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="max-w-full truncate text-sm font-semibold text-slate-800" title={rule.name}>
                      {rule.name}
                    </span>
                    <StatusPill enabled={rule.isEnabled} />
                  </div>
                  <div className="mt-1.5">
                    <ConditionFlow condition={rule.conditionType} action={rule.actionType} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                    <Icon name="history" size={11} />
                    {rule.lastTriggered ? (
                      <span>
                        Last triggered{" "}
                        <time dateTime={rule.lastTriggered} title={formatAbsoluteTime(rule.lastTriggered)}>
                          {formatRelativeTime(rule.lastTriggered)}
                        </time>
                      </span>
                    ) : (
                      "Never triggered"
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <IconAction icon="edit" label={`Edit rule: ${rule.name}`} onClick={() => onEdit(rule)} tone="indigo" />
                  {canWrite && (
                    <IconAction icon="delete" label={`Delete rule: ${rule.name}`} onClick={() => onDelete(rule)} tone="red" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function RuleCard({
  rule,
  onEdit,
  onDelete,
  canWrite,
}: {
  rule: AlertRuleRecord;
  onEdit: () => void;
  onDelete: () => void;
  canWrite: boolean;
}) {
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              rule.isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            <Icon name="rule" size={16} />
          </span>
          <h3
            className="line-clamp-1 text-sm font-bold text-slate-800 transition-colors group-hover:text-indigo-700"
            title={rule.name}
          >
            {rule.name}
          </h3>
        </div>
        <StatusPill enabled={rule.isEnabled} />
      </div>

      <div className="mb-3">
        <ConditionFlow condition={rule.conditionType} action={rule.actionType} />
      </div>

      {rule.conditionExpression && (
        <p className="mb-3 line-clamp-2 rounded-md bg-slate-50 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-500">
          {rule.conditionExpression}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon name="history" size={11} />
          {rule.lastTriggered ? (
            <time dateTime={rule.lastTriggered} title={formatAbsoluteTime(rule.lastTriggered)}>
              Last: {formatRelativeTime(rule.lastTriggered)}
            </time>
          ) : (
            "Never triggered"
          )}
        </span>
        <div className="flex items-center gap-1">
          <IconAction icon="edit" label={`Edit rule: ${rule.name}`} onClick={onEdit} tone="indigo" />
          {canWrite && (
            <IconAction icon="delete" label={`Delete rule: ${rule.name}`} onClick={onDelete} tone="red" />
          )}
        </div>
      </div>
    </div>
  );
}
