import type { PermissionRecord } from "../../types";

/**
 * Permission-matrix rules for the role editor, kept free of React so they can be
 * reasoned about (and tested) on their own.
 *
 * Granting rules, unchanged from the old side-panel editor:
 *  - A scoped code looks like `TASK_OWN_VIEW` / `TASK_ALL_EDIT`.
 *  - `MANAGE` covers View, Create, Edit and Delete for its scope.
 *  - An All Departments grant also covers the same action for Own Department.
 *  - Legacy unscoped codes (`TASK_VIEW`) read as the All Departments grant and are
 *    rewritten to the scoped code on save.
 */

export type Scope = "OWN" | "ALL";

export const CRUD_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE"] as const;
const CRUD_SET = new Set<string>(CRUD_ACTIONS);

export const SCOPED_CODE = /^(.+?)_(OWN|ALL)_(.+)$/;
export const LEGACY_CODE =
  /^(DEPARTMENT|PROJECT|MILESTONE|TASK|SUBTASK|USER|NOTIFICATION|REPORT|ACTIVITY_LOG|DOCUMENT|UTILIZATION_CERTIFICATE|KNOWLEDGE)_(VIEW|CREATE|EDIT|DELETE|MANAGE|ASSIGN|COMMENT_CREATE|ATTACHMENT_CREATE)$/;
export const PRIMARY_DEPARTMENT_CODE = "PROJECT_PRIMARY_DEPARTMENT_MANAGE";

export interface MatrixRow {
  scope: Scope;
  action: string;
  permission: PermissionRecord;
}

export interface PermissionGroup {
  /** The permission `module` this group is built from, e.g. "Projects". */
  module: string;
  /** Every scoped row, for lookups. */
  rows: MatrixRow[];
  /** `${scope}:${action}` -> row, so a cell lookup is O(1). */
  cell: Map<string, MatrixRow>;
  /** Scoped rows that are not View/Create/Edit/Delete/Manage (uploads, review, assign...). */
  extras: Record<Scope, MatrixRow[]>;
  /** Permissions that are not department-scoped (AI view, role manage...). */
  globals: PermissionRecord[];
  /** Projects only: "primary department control". */
  primaryDepartment: PermissionRecord | null;
  /** Total permissions this group offers, for the "x of y" count. */
  total: number;
}

export interface GroupSection {
  title: string;
  groups: PermissionGroup[];
}

const SECTION_ORDER: { title: string; modules: string[] }[] = [
  { title: "Work", modules: ["Departments", "Projects", "Milestones", "Tasks", "Subtasks"] },
  { title: "Content", modules: ["Documents", "Utilization Certificates", "Knowledge", "Reports"] },
  { title: "People & access", modules: ["Users", "Organization", "Authorization", "Authentication"] },
  { title: "Insights & system", modules: ["AI", "Notifications", "Audit", "Integrations", "System"] },
];

export function parseScoped(code: string): { scope: Scope; action: string } | null {
  const match = code.match(SCOPED_CODE);
  if (!match) return null;
  return { scope: match[2] as Scope, action: match[3] };
}

const isCrud = (action: string) => CRUD_SET.has(action);
export const cellKey = (scope: Scope, action: string) => `${scope}:${action}`;

export function buildGroups(permissions: PermissionRecord[]): PermissionGroup[] {
  const byModule = new Map<string, PermissionGroup>();

  const groupFor = (module: string) => {
    let group = byModule.get(module);
    if (!group) {
      group = {
        module,
        rows: [],
        cell: new Map(),
        extras: { OWN: [], ALL: [] },
        globals: [],
        primaryDepartment: null,
        total: 0,
      };
      byModule.set(module, group);
    }
    return group;
  };

  for (const permission of permissions) {
    // Legacy unscoped codes are never shown; they only matter as "equivalent grants".
    if (LEGACY_CODE.test(permission.code)) continue;

    const group = groupFor(permission.module);
    group.total += 1;

    if (permission.code === PRIMARY_DEPARTMENT_CODE) {
      group.primaryDepartment = permission;
      continue;
    }

    const parsed = parseScoped(permission.code);
    if (!parsed) {
      group.globals.push(permission);
      continue;
    }

    const row: MatrixRow = { ...parsed, permission };
    group.rows.push(row);
    group.cell.set(cellKey(row.scope, row.action), row);
    if (row.action !== "MANAGE" && !isCrud(row.action)) {
      group.extras[row.scope].push(row);
    }
  }

  for (const group of byModule.values()) {
    group.globals.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(byModule.values());
}

/** Groups arranged into the left-hand navigation sections. */
export function buildSections(groups: PermissionGroup[]): GroupSection[] {
  const byModule = new Map(groups.map((group) => [group.module, group]));
  const placed = new Set<string>();
  const sections: GroupSection[] = [];

  for (const { title, modules } of SECTION_ORDER) {
    const members = modules
      .map((module) => byModule.get(module))
      .filter((group): group is PermissionGroup => !!group);
    members.forEach((group) => placed.add(group.module));
    if (members.length > 0) sections.push({ title, groups: members });
  }

  const rest = groups
    .filter((group) => !placed.has(group.module))
    .sort((a, b) => a.module.localeCompare(b.module));
  if (rest.length > 0) sections.push({ title: "Other", groups: rest });

  return sections;
}

export function indexByCode(permissions: PermissionRecord[]): Map<string, PermissionRecord> {
  return new Map(permissions.map((permission) => [permission.code, permission]));
}

function legacyEquivalent(code: string, byCode: Map<string, PermissionRecord>) {
  const match = code.match(SCOPED_CODE);
  if (!match) return undefined;
  return byCode.get(`${match[1]}_${match[3]}`);
}

/** Whether a permission is held, directly or through Manage / All Departments / legacy. */
export function isEffective(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  byCode: Map<string, PermissionRecord>,
  permission: PermissionRecord,
): boolean {
  if (selected.has(permission.id)) return true;

  const legacy = legacyEquivalent(permission.code, byCode);
  if (legacy && selected.has(legacy.id)) return true;

  const parsed = parseScoped(permission.code);
  if (!parsed) return false;
  const { scope, action } = parsed;

  if (!isCrud(action)) {
    if (scope === "OWN") {
      const all = group.cell.get(cellKey("ALL", action));
      return Boolean(all && selected.has(all.permission.id));
    }
    return false;
  }

  const manage = group.cell.get(cellKey(scope, "MANAGE"));
  if (manage && selected.has(manage.permission.id)) return true;

  if (scope === "OWN") {
    const allAction = group.cell.get(cellKey("ALL", action));
    const allManage = group.cell.get(cellKey("ALL", "MANAGE"));
    return Boolean(
      (allAction && selected.has(allAction.permission.id)) ||
        (allManage && selected.has(allManage.permission.id)),
    );
  }

  return false;
}

/** Why an Own Department box reads as ticked without being ticked itself. */
export function inheritedSource(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  row: MatrixRow,
): "ALL" | "OWN_MANAGE" | "OTHER" | null {
  if (row.scope !== "OWN" || selected.has(row.permission.id)) return null;

  const allAction = group.cell.get(cellKey("ALL", row.action));
  if (allAction && selected.has(allAction.permission.id)) return "ALL";

  if (isCrud(row.action)) {
    const allManage = group.cell.get(cellKey("ALL", "MANAGE"));
    if (allManage && selected.has(allManage.permission.id)) return "ALL";
    const ownManage = group.cell.get(cellKey("OWN", "MANAGE"));
    if (ownManage && selected.has(ownManage.permission.id)) return "OWN_MANAGE";
  }

  return "OTHER";
}

export function inheritedTitle(source: "ALL" | "OWN_MANAGE" | "OTHER" | null, fallback: string) {
  if (source === "ALL") return "Granted by All Departments";
  if (source === "OWN_MANAGE") return "Granted by Manage. Untick Manage to change it";
  if (source === "OTHER") return "Granted by another permission on this role";
  return fallback;
}

function crudRows(group: PermissionGroup, scope: Scope): MatrixRow[] {
  return CRUD_ACTIONS.map((action) => group.cell.get(cellKey(scope, action))).filter(
    (row): row is MatrixRow => !!row,
  );
}

export function toggleSimple(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function togglePermission(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  byCode: Map<string, PermissionRecord>,
  row: MatrixRow,
): Set<string> {
  if (!isCrud(row.action)) return toggleSimple(selected, row.permission.id);

  const next = new Set(selected);
  const manage = group.cell.get(cellKey(row.scope, "MANAGE"));

  // Granted by All Departments: the box is locked, change it at the All row.
  if (row.scope === "OWN" && !next.has(row.permission.id)) {
    const allAction = group.cell.get(cellKey("ALL", row.action));
    const allManage = group.cell.get(cellKey("ALL", "MANAGE"));
    if (
      (allAction && next.has(allAction.permission.id)) ||
      (allManage && next.has(allManage.permission.id))
    ) {
      return next;
    }
  }

  // Unticking one action while Manage is on: split Manage into the other three.
  if (manage && next.has(manage.permission.id)) {
    next.delete(manage.permission.id);
    for (const sibling of crudRows(group, row.scope)) {
      if (sibling.action !== row.action) next.add(sibling.permission.id);
    }
    return next;
  }

  if (next.has(row.permission.id)) next.delete(row.permission.id);
  else next.add(row.permission.id);

  // All four ticked: collapse into Manage.
  const crud = crudRows(group, row.scope);
  const allCrudSelected =
    crud.length > 0 &&
    crud.every((item) =>
      item.permission.id === row.permission.id
        ? next.has(item.permission.id)
        : isEffective(group, selected, byCode, item.permission),
    );
  if (manage && allCrudSelected) {
    for (const item of crud) next.delete(item.permission.id);
    next.add(manage.permission.id);
  }

  return next;
}

export function toggleManage(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  scope: Scope,
): Set<string> {
  const manage = group.cell.get(cellKey(scope, "MANAGE"));
  if (!manage) return new Set(selected);

  const next = new Set(selected);
  if (next.has(manage.permission.id)) {
    next.delete(manage.permission.id);
    return next;
  }
  next.add(manage.permission.id);
  for (const item of crudRows(group, scope)) next.delete(item.permission.id);
  return next;
}

/** Every permission id this group can hold, including the legacy twins of its rows. */
export function groupPermissionIds(
  group: PermissionGroup,
  byCode: Map<string, PermissionRecord>,
): string[] {
  const ids: string[] = [];
  for (const row of group.rows) {
    ids.push(row.permission.id);
    const legacy = legacyEquivalent(row.permission.code, byCode);
    if (legacy) ids.push(legacy.id);
  }
  for (const permission of group.globals) ids.push(permission.id);
  if (group.primaryDepartment) ids.push(group.primaryDepartment.id);
  return ids;
}

export function grantGroup(group: PermissionGroup, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  for (const row of group.rows) {
    // An Own row is already covered when its All counterpart exists.
    if (row.scope === "OWN" && group.cell.has(cellKey("ALL", row.action))) continue;
    next.add(row.permission.id);
  }
  for (const permission of group.globals) next.add(permission.id);
  if (group.primaryDepartment) next.add(group.primaryDepartment.id);
  return next;
}

export function clearGroup(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  byCode: Map<string, PermissionRecord>,
): Set<string> {
  const next = new Set(selected);
  for (const id of groupPermissionIds(group, byCode)) next.delete(id);
  return next;
}

/** How many of a group's permissions are held, counting what Manage / All cover. */
export function countGranted(
  group: PermissionGroup,
  selected: ReadonlySet<string>,
  byCode: Map<string, PermissionRecord>,
): number {
  let count = 0;
  for (const row of group.rows) {
    if (isEffective(group, selected, byCode, row.permission)) count += 1;
  }
  for (const permission of group.globals) {
    if (selected.has(permission.id)) count += 1;
  }
  if (group.primaryDepartment && selected.has(group.primaryDepartment.id)) count += 1;
  return count;
}

/**
 * The ids to send on save: legacy codes rewritten to their All Departments twin, and a
 * full set of View/Create/Edit/Delete folded into Manage so the stored role stays compact.
 *
 * The fold only considers permissions the draft *directly* holds. Folding on "effectively
 * held" would rewrite a role the moment it was opened and saved untouched - a role stored
 * as the four CRUD codes would come back as a single Manage code with no edit at all - so
 * an unchanged save has to leave the set exactly as it found it. Ticking the fourth box in
 * the UI still collapses into Manage (see `togglePermission`), so the compaction still
 * happens where the person is actually looking.
 */
export function normalizeForSave(
  groups: PermissionGroup[],
  selected: ReadonlySet<string>,
  permissions: PermissionRecord[],
  byCode: Map<string, PermissionRecord>,
): string[] {
  const normalized = new Set(selected);

  for (const legacy of permissions) {
    if (!LEGACY_CODE.test(legacy.code) || !normalized.has(legacy.id)) continue;
    const parts = legacy.code.split("_");
    const canonical = byCode.get(`${parts.slice(0, -1).join("_")}_ALL_${parts[parts.length - 1]}`);
    if (canonical) {
      normalized.delete(legacy.id);
      normalized.add(canonical.id);
    }
  }

  for (const group of groups) {
    for (const scope of ["OWN", "ALL"] as Scope[]) {
      const manage = group.cell.get(cellKey(scope, "MANAGE"));
      const crud = crudRows(group, scope);
      if (manage && crud.length > 0 && crud.every((item) => normalized.has(item.permission.id))) {
        for (const item of crud) normalized.delete(item.permission.id);
        normalized.add(manage.permission.id);
      }
    }
  }

  return Array.from(normalized);
}

export function groupMatchesQuery(group: PermissionGroup, query: string): boolean {
  if (!query) return true;
  if (group.module.toLowerCase().includes(query)) return true;
  const hit = (permission: PermissionRecord) =>
    permission.name.toLowerCase().includes(query) ||
    permission.code.toLowerCase().includes(query) ||
    permission.description.toLowerCase().includes(query);
  return (
    group.rows.some((row) => hit(row.permission)) ||
    group.globals.some(hit) ||
    (group.primaryDepartment ? hit(group.primaryDepartment) : false)
  );
}
