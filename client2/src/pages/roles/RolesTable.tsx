import { useMemo, useState } from "react";
import type { RoleRecord } from "../../types";
import { roleDisplayName } from "../../permissions";
import {
  FilterBar,
  SortDropdown,
  ViewToggle,
  EmptyState,
  type ViewMode,
} from "../shared";
import { Icon } from "../../components/ui/Icon";

interface RolesTableProps {
  roles: RoleRecord[];
  onEdit: (role: RoleRecord) => void;
  onDelete: (role: RoleRecord) => void;
  onCreate: () => void;
  isAdmin: boolean;
}

type SortKey = "nameAsc" | "nameDesc" | "levelDesc" | "levelAsc";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "levelDesc", label: "Level (high → low)" },
  { value: "levelAsc", label: "Level (low → high)" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
];

export function RolesTable({ roles, onEdit, onDelete, onCreate, isAdmin }: RolesTableProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("levelDesc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = roles;
    if (term) {
      list = list.filter((role) =>
        [roleDisplayName(role.name), role.description, ...role.permissions.map((p) => p.code)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term)
      );
    }
    const sorted = [...list];
    if (sortKey === "nameAsc") {
      sorted.sort((a, b) => roleDisplayName(a.name).localeCompare(roleDisplayName(b.name)));
    } else if (sortKey === "nameDesc") {
      sorted.sort((a, b) => roleDisplayName(b.name).localeCompare(roleDisplayName(a.name)));
    } else if (sortKey === "levelDesc") {
      sorted.sort((a, b) => b.permissionLevel - a.permissionLevel);
    } else if (sortKey === "levelAsc") {
      sorted.sort((a, b) => a.permissionLevel - b.permissionLevel);
    }
    return sorted;
  }, [roles, query, sortKey]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search roles by name, description, permission..."
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
            {isAdmin && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
              >
                <Icon name="add" size={14} />
                Create Role
              </button>
            )}
          </>
        }
      />

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          {roles.length} roles
        </span>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="verified_user"
          title="No roles defined"
          description={
            isAdmin
              ? "Create roles to manage permission levels and access control."
              : "No roles are available to view."
          }
          accent="primary"
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
              >
                <Icon name="add" size={14} />
                Create Role
              </button>
            ) : undefined
          }
        />
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
          {filtered.map((role, idx) => (
            <div
              key={role.id}
              className="card-stagger"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <RoleCard
                role={role}
                onEdit={() => onEdit(role)}
                onDelete={() => onDelete(role)}
                isAdmin={isAdmin}
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
                    Level
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Permissions
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <Icon name="verified_user" size={16} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {roleDisplayName(role.name)}
                          </div>
                          {role.description && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        Level {role.permissionLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {role.permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {role.permissions.slice(0, 3).map((perm) => (
                            <span
                              key={perm.id}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100"
                            >
                              {perm.code}
                            </span>
                          ))}
                          {role.permissions.length > 3 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200">
                              +{role.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No permissions</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(role)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(role)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
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

function RoleCard({
  role,
  onEdit,
  onDelete,
  isAdmin,
}: {
  role: RoleRecord;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  return (
    <div className="group flex flex-col h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon name="verified_user" size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3
              className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition-colors"
              title={roleDisplayName(role.name)}
            >
              {roleDisplayName(role.name)}
            </h3>
            <span className="text-[10px] text-slate-400">Level {role.permissionLevel}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 shrink-0">
          {role.permissions.length} perms
        </span>
      </div>

      {role.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
          {role.description}
        </p>
      )}

      {role.permissions.length > 0 ? (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Permissions
          </p>
          <div className="flex flex-wrap gap-1">
            {role.permissions.slice(0, 5).map((perm) => (
              <span
                key={perm.id}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono"
              >
                {perm.code}
              </span>
            ))}
            {role.permissions.length > 5 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200">
                +{role.permissions.length - 5} more
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic mb-3">No permissions assigned</p>
      )}

      {isAdmin && (
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
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
  );
}
