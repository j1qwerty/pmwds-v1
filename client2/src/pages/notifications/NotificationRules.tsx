import { useMemo, useState } from "react";
import type { AlertRuleRecord } from "../../types";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface NotificationRulesProps {
  rules: AlertRuleRecord[];
  onEdit: (rule: AlertRuleRecord) => void;
  onDelete: (rule: AlertRuleRecord) => void;
  onCreate: () => void;
  canWrite: boolean;
}

type SortKey = "nameAsc" | "nameDesc" | "recent";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
  { value: "recent", label: "Recently triggered" },
];

export function NotificationRules({
  rules,
  onEdit,
  onDelete,
  onCreate,
  canWrite,
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

  const activeCount = rules.filter((r) => r.isEnabled).length;
  const disabledCount = rules.length - activeCount;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search rules by name, condition, action..."
        chipGroups={[
          {
            key: "status",
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
            {canWrite && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                <Icon name="add" size={14} />
                Create Rule
              </button>
            )}
          </>
        }
      />

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          {rules.length} rules
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="rule"
          title="No alert rules"
          description={
            canWrite
              ? "Create rules to automate notification delivery."
              : "No alert rules have been configured yet."
          }
          accent="primary"
          action={
            canWrite ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
              >
                <Icon name="add" size={14} />
                Create Rule
              </button>
            ) : undefined
          }
        />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
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
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden pb-10 view-fade">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Name
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Condition
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Action
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Status
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rule) => (
                  <tr
                    key={rule.id}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-800">
                        {rule.name}
                      </span>
                      {rule.lastTriggered && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {rule.conditionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
                        {rule.actionType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          rule.isEnabled
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            rule.isEnabled ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {rule.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(rule)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => onDelete(rule)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
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
    <div className="group flex flex-col h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              rule.isEnabled
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            <Icon name="rule" size={16} />
          </div>
          <h3
            className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors"
            title={rule.name}
          >
            {rule.name}
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
            rule.isEnabled
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              rule.isEnabled ? "bg-emerald-500" : "bg-slate-400"
            }`}
          />
          {rule.isEnabled ? "Active" : "Disabled"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
          {rule.conditionType}
        </span>
        <Icon name="arrow_forward" size={12} className="text-slate-300" />
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
          {rule.actionType}
        </span>
      </div>

      {rule.conditionExpression && (
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3 font-mono bg-slate-50 px-2 py-1.5 rounded-md">
          {rule.conditionExpression}
        </p>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {rule.lastTriggered
            ? `Last: ${new Date(rule.lastTriggered).toLocaleDateString()}`
            : "Never triggered"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <Icon name="edit" size={11} />
            Edit
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
            >
              <Icon name="delete" size={11} />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
