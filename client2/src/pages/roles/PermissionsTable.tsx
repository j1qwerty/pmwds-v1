import { useMemo, useState } from "react";
import type { PermissionRecord } from "../../types";
import {
  FilterBar,
  FilterDropdown,
  ViewToggle,
  EmptyState,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import React from "react";

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

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search permissions by code, name, module..."
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
                { value: "scoped", label: "Scoped", dot: "bg-blue-500" },
              ]}
              width="min-w-[140px]"
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
          {permissions.length} permissions
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="lock"
          title="No permissions defined"
          description="No permissions match your filters. Try adjusting your search."
          accent="primary"
        />
      ) : viewMode === "card" ? (
        <div className="space-y-4 pb-10 view-fade">
          {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
            <div key={module}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden pb-10 view-fade">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Code
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Module
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Scope
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                  <React.Fragment key={module}>
                    {modulePermissions.length > 1 && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
                        className="hover:bg-indigo-50/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                              <Icon name="lock" size={14} className="text-violet-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-mono text-xs font-semibold text-slate-800">
                                {permission.code}
                              </div>
                              <div className="text-xs text-slate-500">{permission.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                            {permission.module}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              permission.isGlobal
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                permission.isGlobal ? "bg-emerald-500" : "bg-blue-500"
                              }`}
                            />
                            {permission.isGlobal ? "Global" : "Scoped"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-500 truncate max-w-md">
                            {permission.description || "—"}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
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
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
            permission.isGlobal
              ? "bg-emerald-50 text-emerald-600"
              : "bg-blue-50 text-blue-600"
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
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Icon name="edit" size={11} />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
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
