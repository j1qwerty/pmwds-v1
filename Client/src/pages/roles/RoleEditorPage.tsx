import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { PermissionRecord, RoleDefaultsRecord, RoleRecord } from "../../types";
import { coversManagedPermission } from "../../permissions";
import {
  EmptyState,
  GlassCard,
  Modal,
  ModalCancelButton,
  ModalPrimaryButton,
  PageSkeleton,
  PERMISSION_GROUPS,
  useNavHeader,
  usePermission,
  useToast,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import {
  buildGroups,
  buildSections,
  cellKey,
  clearGroup,
  countGranted,
  groupMatchesQuery,
  grantGroup,
  indexByCode,
  inheritedSource,
  inheritedTitle,
  isEffective,
  normalizeForSave,
  toggleManage,
  togglePermission,
  toggleSimple,
  type MatrixRow,
  type PermissionGroup,
  type Scope,
} from "./roleMatrix";

const ADMIN_ONLY_MODULES = new Set(["Authorization", "Authentication", "System"]);
const ACTION_COLUMNS = ["VIEW", "CREATE", "EDIT", "DELETE"] as const;

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all";
const labelCls = "text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5";

/**
 * Create / edit a role on its own page (`/roles/new`, `/roles/:roleId/edit`).
 *
 * Permissions are grouped by feature in a left-hand list; the right side shows one
 * group at a time. Showing one group instead of every feature's table is what keeps
 * the page quick to open and scroll: the old side panel rendered all of them at once.
 */
export function RoleEditorPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { auth } = useAuth();
  const perm = usePermission();
  const { addToast } = useToast();
  const { setNavHeader } = useNavHeader();

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isNew = !roleId;
  const canManage = perm.has(PERMISSION_GROUPS.role.manage);

  useEffect(() => {
    setNavHeader({
      title: isNew ? "Create role" : "Edit role",
      description: "Configure permissions by feature and department scope",
      backTo: "/roles",
      backLabel: "Roles",
    });
  }, [setNavHeader, isNew]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    Promise.all([api.getRoles(auth.token), api.getPermissions(auth.token)])
      .then(([roleData, permissionData]) => {
        if (cancelled) return;
        setRoles(roleData);
        setPermissions(permissionData);
      })
      .catch((cause) =>
        addToast(`Error: ${cause instanceof Error ? cause.message : "Failed to load roles"}`, "error"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  // A role may only be given a permission the editor effectively holds. An exact code
  // match is not enough: TASK_ALL_MANAGE also holds TASK_OWN_VIEW (ALL covers OWN, MANAGE
  // covers CRUD), so coverage decides what the matrix offers, the same as perm.has().
  const assignable = useMemo(() => {
    if (!auth) return [];
    if (perm.isSuperAdmin) return permissions;
    return permissions.filter(
      (p) => !ADMIN_ONLY_MODULES.has(p.module) && coversManagedPermission(auth.permissions, p.code),
    );
  }, [permissions, auth, perm.isSuperAdmin]);

  const role = useMemo(() => roles.find((r) => r.id === roleId), [roles, roleId]);

  if (loading || !auth) return <PageSkeleton />;

  if (!canManage) {
    return (
      <GlassCard className="p-5">
        <EmptyState
          icon="lock"
          title="You can't edit roles"
          description="Ask an administrator for role management access."
        />
      </GlassCard>
    );
  }

  if (!isNew && !role) {
    return (
      <GlassCard className="p-5">
        <EmptyState
          icon="shield_person"
          title="Role not found"
          description="It may have been deleted, or its level is above yours."
        />
      </GlassCard>
    );
  }

  return <RoleEditor key={role?.id ?? "new"} role={role} permissions={assignable} token={auth.token} />;
}

interface RoleEditorProps {
  role?: RoleRecord;
  permissions: PermissionRecord[];
  token: string;
}

function RoleEditor({ role, permissions, token }: RoleEditorProps) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [level, setLevel] = useState(String(role?.permissionLevel ?? 10));
  const [nameError, setNameError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(role?.permissions?.map((permission) => permission.id) ?? []),
  );
  const [initialIds] = useState<Set<string>>(() => new Set(selected));
  const [query, setQuery] = useState("");
  const [activeModule, setActiveModule] = useState("");
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<RoleDefaultsRecord | null>(null);
  const [confirm, setConfirm] = useState<"restore" | "discard" | null>(null);

  const groups = useMemo(() => buildGroups(permissions), [permissions]);
  const sections = useMemo(() => buildSections(groups), [groups]);
  const byCode = useMemo(() => indexByCode(permissions), [permissions]);

  // Know up front whether this role has built-in defaults, so the button only appears
  // for roles that do and the restore itself is instant.
  const roleId = role?.id;
  useEffect(() => {
    if (!roleId) return;
    let cancelled = false;
    api
      .getRoleDefaults(token, roleId)
      .then((result) => {
        if (!cancelled) setDefaults(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, roleId]);

  const needle = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          groups: section.groups.filter((group) => groupMatchesQuery(group, needle)),
        }))
        .filter((section) => section.groups.length > 0),
    [sections, needle],
  );
  const visibleGroups = useMemo(() => visibleSections.flatMap((section) => section.groups), [visibleSections]);
  const activeGroup = visibleGroups.find((group) => group.module === activeModule) ?? visibleGroups[0];

  const counts = useMemo(
    () => new Map(groups.map((group) => [group.module, countGranted(group, selected, byCode)])),
    [groups, selected, byCode],
  );

  const changes = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const id of selected) if (!initialIds.has(id)) added += 1;
    for (const id of initialIds) if (!selected.has(id)) removed += 1;
    return { added, removed };
  }, [selected, initialIds]);

  const detailsChanged =
    name.trim() !== (role?.name ?? "") ||
    description !== (role?.description ?? "") ||
    Number(level) !== (role?.permissionLevel ?? 10);
  const dirty = changes.added + changes.removed > 0 || detailsChanged || (!role && name.trim() !== "");

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const leave = () => navigate("/roles");
  const handleCancel = () => (dirty ? setConfirm("discard") : leave());

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError("Role name is required");
      return;
    }
    setNameError(null);
    setSaving(true);
    const payload = {
      name: name.trim(),
      description,
      permissionLevel: Number(level),
      permissionIds: normalizeForSave(groups, selected, permissions, byCode),
    };
    try {
      if (role) {
        await api.updateRole(token, role.id, payload);
        addToast("Role updated successfully.");
      } else {
        await api.createRole(token, payload);
        addToast("Role created successfully.");
      }
      navigate("/roles");
    } catch (cause) {
      addToast(`Error: ${cause instanceof Error ? cause.message : "Save failed"}`, "error");
      setSaving(false);
    }
  };

  const handleRestore = () => {
    if (!defaults?.hasDefaults) return;
    const assignableIds = new Set(permissions.map((permission) => permission.id));
    // Grants this person cannot see or assign are left exactly as they are.
    const untouched = Array.from(selected).filter((id) => !assignableIds.has(id));
    const restored = defaults.permissionIds.filter((id) => assignableIds.has(id));
    setSelected(new Set([...untouched, ...restored]));
    setConfirm(null);
    addToast("Default permissions loaded. Review them, then save.");
  };

  const update = (fn: (current: ReadonlySet<string>) => Set<string>) => setSelected((current) => fn(current));

  return (
    <div className="relative z-10 flex flex-col gap-4 mb-4">
      <GlassCard className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <div>
            <label className={labelCls} htmlFor="role-name">
              Role name <span className="text-red-500">*</span>
            </label>
            <input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Department Reviewer"
              aria-invalid={nameError ? true : undefined}
              className={`${inputCls} ${nameError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="role-level">Level</label>
            <input
              id="role-level"
              type="number"
              min={0}
              max={100}
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="role-description">Description</label>
            <input
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this role is responsible for"
              className={inputCls}
            />
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-[clamp(13rem,22vw,17.5rem)_minmax(0,1fr)] gap-4 items-start">
        <GlassCard className="p-3 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto">
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Icon name="search" size={15} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search permissions"
              aria-label="Search permissions"
              className={`${inputCls} pl-9`}
            />
          </div>

          {/* Small screens: one compact picker instead of a tall list. */}
          <select
            aria-label="Permission group"
            value={activeGroup?.module ?? ""}
            onChange={(event) => setActiveModule(event.target.value)}
            className={`${inputCls} lg:hidden`}
          >
            {visibleSections.map((section) => (
              <optgroup key={section.title} label={section.title}>
                {section.groups.map((group) => (
                  <option key={group.module} value={group.module}>
                    {group.module} ({counts.get(group.module) ?? 0}/{group.total})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <nav aria-label="Permission groups" className="hidden lg:block">
            {visibleSections.map((section) => (
              <div key={section.title} className="mb-3 last:mb-0">
                <div className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
                {section.groups.map((group) => (
                  <GroupNavItem
                    key={group.module}
                    module={group.module}
                    granted={counts.get(group.module) ?? 0}
                    total={group.total}
                    active={group.module === activeGroup?.module}
                    onSelect={setActiveModule}
                  />
                ))}
              </div>
            ))}
          </nav>

          {visibleGroups.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-400">No permissions match this search.</p>
          )}
        </GlassCard>

        <div className="min-w-0">
          {activeGroup ? (
            <GroupPanel
              key={activeGroup.module}
              group={activeGroup}
              selected={selected}
              byCode={byCode}
              needle={needle}
              granted={counts.get(activeGroup.module) ?? 0}
              onToggleRow={(row) => update((current) => togglePermission(activeGroup, current, byCode, row))}
              onToggleManage={(scope) => update((current) => toggleManage(activeGroup, current, scope))}
              onToggleSimple={(id) => update((current) => toggleSimple(current, id))}
              onGrantAll={() => update((current) => grantGroup(activeGroup, current))}
              onClear={() => update((current) => clearGroup(activeGroup, current, byCode))}
            />
          ) : (
            <GlassCard className="p-5">
              <EmptyState compact title="Nothing to show" description="Clear the search to see every group." />
            </GlassCard>
          )}
        </div>
      </div>

      <div className="sticky bottom-3 z-30">
        <GlassCard className="p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
            {dirty ? (
              <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 font-semibold">
                Unsaved: +{changes.added} / -{changes.removed} permissions{detailsChanged ? ", details edited" : ""}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-1 font-semibold">No changes</span>
            )}
            <span className="hidden md:inline">Manage ticks View, Create, Edit and Delete for its scope.</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {defaults?.hasDefaults && (
              <button
                type="button"
                onClick={() => setConfirm("restore")}
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <Icon name="restart_alt" size={15} />
                Restore defaults
              </button>
            )}
            <ModalCancelButton onClick={handleCancel} />
            <ModalPrimaryButton
              onClick={handleSave}
              loading={saving}
              label={role ? "Save changes" : "Create role"}
              icon="check-circle"
            />
          </div>
        </GlassCard>
      </div>

      <Modal
        open={confirm === "restore"}
        onClose={() => setConfirm(null)}
        title="Restore default permissions?"
        description={`Replaces the permissions below with the built-in defaults for ${role?.name ?? "this role"}.`}
        icon="restart_alt"
        accent="warning"
        size="sm"
        footer={
          <>
            <ModalCancelButton onClick={() => setConfirm(null)} />
            <ModalPrimaryButton onClick={handleRestore} label="Restore defaults" icon="restart_alt" />
          </>
        }
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <Icon name="info" size={14} className="shrink-0 mt-0.5" />
          <span>Nothing is saved yet. You can review the result and press Save changes, or cancel to keep the current permissions.</span>
        </div>
      </Modal>

      <Modal
        open={confirm === "discard"}
        onClose={() => setConfirm(null)}
        title="Discard changes?"
        description="You have unsaved changes to this role."
        icon="warning"
        accent="warning"
        size="sm"
        footer={
          <>
            <ModalCancelButton onClick={() => setConfirm(null)} />
            <ModalPrimaryButton onClick={leave} label="Discard changes" icon="close" />
          </>
        }
      >
        <p className="text-xs text-slate-500">Leaving now loses everything you changed on this page.</p>
      </Modal>
    </div>
  );
}

const GroupNavItem = memo(function GroupNavItem({
  module,
  granted,
  total,
  active,
  onSelect,
}: {
  module: string;
  granted: number;
  total: number;
  active: boolean;
  onSelect: (module: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(module)}
      aria-current={active ? "true" : undefined}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
        active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="truncate">{module}</span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
          granted > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
        }`}
      >
        {granted}/{total}
      </span>
    </button>
  );
});

interface GroupPanelProps {
  group: PermissionGroup;
  selected: ReadonlySet<string>;
  byCode: Map<string, PermissionRecord>;
  needle: string;
  granted: number;
  onToggleRow: (row: MatrixRow) => void;
  onToggleManage: (scope: Scope) => void;
  onToggleSimple: (id: string) => void;
  onGrantAll: () => void;
  onClear: () => void;
}

function GroupPanel({
  group,
  selected,
  byCode,
  needle,
  granted,
  onToggleRow,
  onToggleManage,
  onToggleSimple,
  onGrantAll,
  onClear,
}: GroupPanelProps) {
  const moduleMatches = !needle || group.module.toLowerCase().includes(needle);
  const matches = (permission: PermissionRecord) =>
    moduleMatches ||
    permission.name.toLowerCase().includes(needle) ||
    permission.code.toLowerCase().includes(needle) ||
    permission.description.toLowerCase().includes(needle);

  const scopes = (["OWN", "ALL"] as Scope[]).filter((scope) => group.rows.some((row) => row.scope === scope));
  const globals = group.globals.filter(matches);

  return (
    <GlassCard className="overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{group.module}</h3>
          <p className="text-[11px] text-slate-400">
            {granted} of {group.total} granted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGrantAll}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Grant all
          </button>
          <button
            type="button"
            onClick={onClear}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {group.primaryDepartment && matches(group.primaryDepartment) && (
        <label className="flex items-start gap-2 cursor-pointer border-b border-slate-100 bg-amber-50/50 px-4 py-3">
          <input
            type="checkbox"
            checked={selected.has(group.primaryDepartment.id)}
            onChange={() => onToggleSimple(group.primaryDepartment!.id)}
            className="mt-0.5 size-4 accent-indigo-600"
            title={group.primaryDepartment.description}
          />
          <span>
            <span className="block text-xs font-semibold text-slate-700">Primary Department Control</span>
            <span className="block text-[11px] text-slate-500">
              Full project-detail visibility for the project&apos;s primary department. Other departments stay limited
              to their assigned milestones and tasks.
            </span>
          </span>
        </label>
      )}

      {scopes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-xs">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Scope
                </th>
                {ACTION_COLUMNS.map((action) => (
                  <th
                    key={action}
                    className="text-center px-2 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"
                  >
                    {action}
                  </th>
                ))}
                <th className="text-center px-2 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Manage
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopes.map((scope) => {
                const manage = group.cell.get(cellKey(scope, "MANAGE"));
                const manageInherited =
                  scope === "OWN" && !!manage && !selected.has(manage.permission.id) && isEffective(group, selected, byCode, manage.permission);
                return (
                  <tr key={scope} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-700">
                        {scope === "OWN" ? "Own Department" : "All Departments"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {scope === "OWN" ? "The user's own departments" : "Includes the user's own departments"}
                      </div>
                    </td>
                    {ACTION_COLUMNS.map((action) => {
                      const row = group.cell.get(cellKey(scope, action));
                      if (!row) {
                        return (
                          <td key={action} className="px-2 py-3 text-center text-slate-300">
                            &mdash;
                          </td>
                        );
                      }
                      const checked = isEffective(group, selected, byCode, row.permission);
                      const inherited = scope === "OWN" && checked && !selected.has(row.permission.id);
                      const source = scope === "OWN" ? inheritedSource(group, selected, row) : null;
                      return (
                        <td key={action} className="px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={inherited}
                            onChange={() => onToggleRow(row)}
                            aria-label={row.permission.name}
                            title={inherited ? inheritedTitle(source, row.permission.description) : row.permission.description}
                            className="size-4 accent-indigo-600"
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-3 text-center">
                      {manage ? (
                        <input
                          type="checkbox"
                          checked={isEffective(group, selected, byCode, manage.permission)}
                          disabled={manageInherited}
                          onChange={() => onToggleManage(scope)}
                          aria-label={manage.permission.name}
                          title={manageInherited ? "Granted by All Departments" : manage.permission.description}
                          className="size-4 accent-emerald-600"
                        />
                      ) : (
                        <span className="text-slate-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(["OWN", "ALL"] as Scope[]).map((scope) => {
        const extras = group.extras[scope].filter((row) => matches(row.permission));
        if (extras.length === 0) return null;
        return (
          <div key={scope} className="border-t border-slate-100 px-4 py-3 bg-slate-50/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Additional permissions &middot; {scope === "OWN" ? "Own Department" : "All Departments"}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {extras.map((row) => {
                const checked = isEffective(group, selected, byCode, row.permission);
                const inherited = scope === "OWN" && checked && !selected.has(row.permission.id);
                const source = scope === "OWN" ? inheritedSource(group, selected, row) : null;
                return (
                  <label
                    key={row.permission.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={inherited}
                      onChange={() => onToggleRow(row)}
                      title={inherited ? inheritedTitle(source, row.permission.description) : row.permission.description}
                      className="mt-0.5 size-4 accent-indigo-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-700">{row.permission.name}</span>
                      <span className="block text-[10px] text-slate-400">{row.permission.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {globals.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {scopes.length > 0 ? "Other permissions" : "Permissions"}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {globals.map((permission) => (
              <label
                key={permission.id}
                className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(permission.id)}
                  onChange={() => onToggleSimple(permission.id)}
                  className="mt-0.5 size-4 accent-indigo-600"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-700">{permission.name}</span>
                  <span className="block text-[10px] text-slate-400">{permission.description}</span>
                  <span className="block text-[10px] text-slate-300 font-mono">{permission.code}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
