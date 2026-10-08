import { useMemo, useState, Fragment } from "react";
import type { PermissionRecord } from "../../types";
import {
  FilterBar,
  FilterDropdown,
  ViewToggle,
  EmptyState,
  GlassCard,
  PageAction,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface PermissionsTableProps {
  permissions: PermissionRecord[];
  onEdit: (permission: PermissionRecord) => void;
  onDelete: (permission: PermissionRecord) => void;
  onCreate: () => void;
  isAdmin: boolean;
}

export function PermissionsTable({ permissions, onEdit, onDelete, onCreate, isAdmin }: PermissionsTableProps) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const moduleOptions = useMemo(() => {
    const set = new Set(permissions.map((p) => p.module).filter(Boolean));
    return Array.from(set).sort().map((m) => ({ value: m, label: m }));
  }, [permissions]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return permissions.filter((p) => {
      const matchesQuery =
        !term ||
        [p.code, p.name, p.module, p.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesModule = !moduleFilter || p.module === moduleFilter;
      const matchesScope =
        !scopeFilter ||
        (scopeFilter === "global" ? p.isGlobal : !p.isGlobal);
      return matchesQuery && matchesModule && matchesScope;
    });
  }, [permissions, query, moduleFilter, scopeFilter]);

  // Group filtered permissions by module (preserving original grouping logic)
  const groupedPermissions = useMemo(() => {
    const acc: Record<string, PermissionRecord[]> = {};
    for (const perm of filtered) {
      const module = perm.module || "Other";
      if (!acc[module]) acc[module] = [];
      acc[module].push(perm);
    }
    return acc;
  }, [filtered]);

  const scopeBadge = (permission: PermissionRecord) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        permission.isGlobal
          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
          : "bg-sky-50 text-sky-600 border-sky-100"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          permission.isGlobal ? "bg-emerald-500" : "bg-sky-500"
        }`}
      />
      {permission.isGlobal ? "Global" : "Scoped"}
    </span>
  );

  const rowActions = (permission: PermissionRecord) =>
    isAdmin ? (
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(permission)}
          aria-label={`Edit permission: ${permission.code}`}
          title="Edit permission"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Icon name="edit" size={11} />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(permission)}
          aria-label={`Delete permission: ${permission.code}`}
          title="Delete permission"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
        >
          <Icon name="delete" size={11} />
          Delete
        </button>
      </div>
    ) : (
      <span className="text-xs text-slate-300">—</span>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search permissions by code, name, module..."
        leftExtras={
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
            {permissions.length} permissions
          </span>
        }
        actions={
          <>
            <FilterDropdown
              value={moduleFilter}
              onChange={setModuleFilter}
              label="Module"
              icon="hi-folder"
              options={moduleOptions}
              width="min-w-[160px]"
            />
            <FilterDropdown
              value={scopeFilter}
              onChange={setScopeFilter}
              label="Scope"
              icon="hi-shield-check"
              options={[
                { value: "global", label: "Global", dot: "bg-emerald-500" },
                { value: "scoped", label: "Scoped", dot: "bg-sky-500" },
              ]}
              width="min-w-[140px]"
            />
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              available={["card", "list"]}
            />
            {isAdmin && (
              <PageAction label="New permission" icon="add" onClick={onCreate} />
            )}
          </>
        }
      />

      {/* Content */}
      {filtered.length === 0 ? (
        <GlassCard className="view-fade">
          <EmptyState
            icon="lock"
            title="No permissions defined"
            description="No permissions match your filters. Try adjusting your search."
            accent="primary"
          />
        </GlassCard>
      ) : viewMode === "card" ? (
        <div className="space-y-4 pb-6 view-fade">
          {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
            <div key={module}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {module}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({modulePermissions.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {modulePermissions.map((permission, idx) => (
                  <div
                    key={permission.id}
                    className="card-stagger"
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  >
                    <PermissionCard
                      permission={permission}
                      onEdit={() => onEdit(permission)}
                      onDelete={() => onDelete(permission)}
                      isAdmin={isAdmin}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden pb-6 view-fade min-w-0">
          {/* min-w-0 + overflow-x-auto: the table may scroll horizontally INSIDE
              the card on narrow screens — the page itself never clips it. */}
          <div className="overflow-x-auto min-w-0">
            {/* table-fixed + colgroup gives every column a real, deterministic
                width: the code column always renders fully, and the description
                column owns the remaining space (wraps, never "M." truncated). */}
            <table className="w-full min-w-[780px] table-fixed text-sm">
              <colgroup>
                <col className="w-[250px]" />
                <col className="w-[110px]" />
                <col className="w-[100px]" />
                <col />
                <col className="w-[170px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Permission
                  </th>
                  <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Module
                  </th>
                  <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Scope
                  </th>
                  <th className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Description
                  </th>
                  <th className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                  <Fragment key={module}>
                    {modulePermissions.length > 1 && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                              {module}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({modulePermissions.length})
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {modulePermissions.map((permission) => (
                      <tr
                        key={permission.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                              <Icon name="lock" size={14} className="text-violet-600" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-mono text-xs font-semibold text-slate-800 break-all"
                                title={permission.code}
                              >
                                {permission.code}
                              </div>
                              <div className="text-xs text-slate-500 break-words">{permission.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block max-w-full align-middle truncate px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                            {permission.module}
                          </span>
                        </td>
                        <td className="px-4 py-3">{scopeBadge(permission)}</td>
                        <td className="px-4 py-3 align-middle">
                          <p className="text-xs text-slate-500 leading-relaxed break-words">
                            {permission.description || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">{rowActions(permission)}</td>
                      </tr>
                    ))}
                  </Fragment>
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

function PermissionCard({
  permission,
  onEdit,
  onDelete,
  isAdmin,
}: {
  permission: PermissionRecord;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="group flex flex-col h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-violet-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <Icon name="lock" size={14} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm font-bold text-slate-800 line-clamp-1 font-mono group-hover:text-violet-700 transition-colors"
              title={permission.code}
            >
              {permission.code}
            </h3>
            <span className="text-[10px] text-slate-400">{permission.name}</span>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
            permission.isGlobal
              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : "bg-blue-50 text-blue-600 border-blue-100"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              permission.isGlobal ? "bg-emerald-500" : "bg-blue-500"
            }`}
          />
          {permission.isGlobal ? "Global" : "Scoped"}
        </span>
      </div>

      {permission.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
          {permission.description}
        </p>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
          {permission.module}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit permission: ${permission.code}`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Icon name="edit" size={11} />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete permission: ${permission.code}`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-red-500 bg-white border border-red-200 hover:bg-red-50 transition-colors"
            >
              <Icon name="delete" size={11} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
