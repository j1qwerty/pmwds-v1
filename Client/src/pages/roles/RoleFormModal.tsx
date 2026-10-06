import { useMemo, useState, type FormEvent } from "react";
import type { PermissionRecord, RoleRecord } from "../../types";

interface RoleFormModalProps {
  initialData?: RoleRecord;
  permissions: PermissionRecord[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

type Scope = "OWN" | "ALL";
type CrudAction = "VIEW" | "CREATE" | "EDIT" | "DELETE";
type MatrixPermission = {
  module: string;
  scope: Scope;
  action: CrudAction | "MANAGE";
  permission: PermissionRecord;
};

const SCOPED_CODE = /^(.+?)_(OWN|ALL)_(VIEW|CREATE|EDIT|DELETE|MANAGE)$/;
const LEGACY_CODE = /^(DEPARTMENT|PROJECT|MILESTONE|TASK|SUBTASK|USER|NOTIFICATION|REPORT|ACTIVITY_LOG|DOCUMENT|UTILIZATION_CERTIFICATE)_(VIEW|CREATE|EDIT|DELETE|MANAGE)$/;

function parseScoped(permission: PermissionRecord): MatrixPermission | null {
  const match = permission.code.match(SCOPED_CODE);
  if (!match) return null;
  return {
    module: permission.module,
    scope: match[2] as Scope,
    action: match[3] as MatrixPermission["action"],
    permission,
  };
}

function crudRows(rows: MatrixPermission[], scope: Scope) {
  return rows.filter((row) => row.scope === scope && row.action !== "MANAGE");
}

function manageRow(rows: MatrixPermission[], scope: Scope) {
  return rows.find((row) => row.scope === scope && row.action === "MANAGE");
}

export function RoleFormModal({ initialData, permissions, onSubmit, onCancel }: RoleFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialData?.permissions?.map((permission) => permission.id) ?? []),
  );

  const matrix = useMemo(() => {
    const groups = new Map<string, MatrixPermission[]>();
    for (const permission of permissions) {
      const parsed = parseScoped(permission);
      if (!parsed || LEGACY_CODE.test(permission.code)) continue;
      const list = groups.get(permission.module) ?? [];
      list.push(parsed);
      groups.set(permission.module, list);
    }
    return Array.from(groups.entries())
      .map(([module, rows]) => [module, rows] as const)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const globalPermissions = useMemo(
    () => permissions
      .filter((permission) => !SCOPED_CODE.test(permission.code) && !LEGACY_CODE.test(permission.code))
      .sort((a, b) => (a.module + a.name).localeCompare(b.module + b.name)),
    [permissions],
  );

  const filteredMatrix = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matrix;
    return matrix.filter(([module, rows]) =>
      module.toLowerCase().includes(query) ||
      rows.some(({ permission }) =>
        permission.name.toLowerCase().includes(query) ||
        permission.code.toLowerCase().includes(query),
      ),
    );
  }, [matrix, searchQuery]);

  const isEffective = (permission: PermissionRecord) => {
    if (selected.has(permission.id)) return true;
    const row = parseScoped(permission);
    if (!row) return false;

    const rows = matrix
      .flatMap(([, moduleRows]) => moduleRows)
      .filter((item) => item.module === row.module);
    const manage = manageRow(rows, row.scope);
    if (manage && selected.has(manage.permission.id)) return true;

    if (row.scope === "OWN") {
      const allAction = rows.find((item) => item.scope === "ALL" && item.action === row.action);
      const allManage = manageRow(rows, "ALL");
      return Boolean(
        (allAction && selected.has(allAction.permission.id)) ||
        (allManage && selected.has(allManage.permission.id)),
      );
    }

    return false;
  };

  const toggleCrud = (row: MatrixPermission, rows: MatrixPermission[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const manage = manageRow(rows, row.scope);

      const inheritedFromAll =
        row.scope === "OWN" &&
        !next.has(row.permission.id) &&
        (
          Boolean(rows.find((item) => item.scope === "ALL" && item.action === row.action && next.has(item.permission.id))) ||
          Boolean(manageRow(rows, "ALL") && next.has(manageRow(rows, "ALL")!.permission.id))
        );

      if (inheritedFromAll) return next;

      if (manage && next.has(manage.permission.id)) {
        next.delete(manage.permission.id);
        for (const sibling of crudRows(rows, row.scope)) {
          if (sibling.action !== row.action) next.add(sibling.permission.id);
        }
        return next;
      }

      if (next.has(row.permission.id)) next.delete(row.permission.id);
      else next.add(row.permission.id);

      const allCrudSelected = crudRows(rows, row.scope).every(
        (item) => item.permission.id === row.permission.id
          ? next.has(item.permission.id)
          : isEffective(item.permission),
      );

      if (manage && allCrudSelected) {
        for (const item of crudRows(rows, row.scope)) next.delete(item.permission.id);
        next.add(manage.permission.id);
      }

      return next;
    });
  };

  const toggleManage = (scope: Scope, rows: MatrixPermission[]) => {
    const manage = manageRow(rows, scope);
    if (!manage) return;

    setSelected((current) => {
      const next = new Set(current);
      if (next.has(manage.permission.id)) {
        next.delete(manage.permission.id);
        return next;
      }
      next.add(manage.permission.id);
      for (const item of crudRows(rows, scope)) next.delete(item.permission.id);
      return next;
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const normalized = new Set(selected);
    for (const [, rows] of matrix) {
      for (const scope of ["OWN", "ALL"] as Scope[]) {
        const manage = manageRow(rows, scope);
        const crud = crudRows(rows, scope);
        if (manage && crud.every((item) => isEffective(item.permission))) {
          for (const item of crud) normalized.delete(item.permission.id);
          normalized.add(manage.permission.id);
        }
      }
    }

    const form = event.currentTarget;
    const name = new FormData(form).get("name")?.toString().trim() ?? "";
    const description = new FormData(form).get("description")?.toString() ?? "";
    onSubmit({ name, description, permissionLevel: Number(new FormData(form).get("permissionLevel") ?? 10), permissionIds: Array.from(normalized) });
  };

  return (
    <div className="w-[min(1180px,96vw)] max-w-[96vw] max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{initialData ? "Edit Role" : "Create Role"}</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure permissions by feature and department scope. All Departments includes the user's own departments.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="size-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_160px_1fr] gap-4 p-6 border-b border-slate-100">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role name *</label>
            <input
              required
              defaultValue={initialData?.name ?? ""}
              name="name"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="e.g. Department Reviewer"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Level</label>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={initialData?.permissionLevel ?? 10}
              name="permissionLevel"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
            <input
              defaultValue={initialData?.description ?? ""}
              name="description"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="What this role is responsible for"
            />
          </div>
        </div>

        <div className="px-6 pt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-indigo-50 px-2 py-1 font-medium text-indigo-600">{selected.size} grants stored</span>
            <span>Manage checks View, Create, Edit and Delete.</span>
          </div>
          <div className="relative w-[min(360px,55vw)]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search features or permissions"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          {filteredMatrix.map(([module, rows]) => (
            <section key={module} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{module}</h3>
                  <p className="text-[11px] text-slate-400">Department-scoped feature permissions</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Scope</th>
                      {(["VIEW", "CREATE", "EDIT", "DELETE", "MANAGE"] as const).map((action) => (
                        <th key={action} className="text-center px-3 py-2.5 font-semibold text-slate-500">{action}</th>
                      ))}
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Scope meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(["OWN", "ALL"] as Scope[]).map((scope) => {
                      const scopeRows = rows.filter((row) => row.scope === scope);
                      const manage = manageRow(rows, scope);
                      return (
                        <tr key={scope} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                            {scope === "OWN" ? "Own Department" : "All Departments"}
                          </td>
                          {(["VIEW", "CREATE", "EDIT", "DELETE"] as CrudAction[]).map((action) => {
                            const row = scopeRows.find((item) => item.action === action);
                            if (!row) return <td key={action} className="px-3 py-3 text-center text-slate-300">—</td>;
                            const checked = isEffective(row.permission);
                            const inherited = scope === "OWN" && checked && !selected.has(row.permission.id);
                            return (
                              <td key={action} className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={inherited}
                                  onChange={() => toggleCrud(row, rows)}
                                  title={inherited ? "Granted by All Departments" : row.permission.description}
                                  className="size-4 accent-indigo-600"
                                />
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            {manage ? (
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected.has(manage.permission.id)}
                                  onChange={() => toggleManage(scope, rows)}
                                  title={manage.permission.description}
                                  className="size-4 accent-emerald-600"
                                />
                                <span className="font-semibold text-emerald-700">Manage</span>
                              </label>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {globalPermissions.length > 0 && (
            <section className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800">Global permissions</h3>
                <p className="text-[11px] text-slate-400">Organization, authorization and other non-department capabilities.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4">
                {globalPermissions.map((permission) => (
                  <label key={permission.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selected.has(permission.id)}
                      onChange={() => setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(permission.id)) next.delete(permission.id);
                        else next.add(permission.id);
                        return next;
                      })}
                      className="mt-0.5 size-4 accent-indigo-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-700">{permission.name}</span>
                      <span className="block text-[10px] text-slate-400">{permission.code}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {filteredMatrix.length === 0 && globalPermissions.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">No assignable permissions match this search.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/80">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {submitting ? "Saving..." : initialData ? "Save Changes" : "Create Role"}
          </button>
        </div>
      </form>
    </div>
  );
}
