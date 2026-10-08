/**
 * Parser for the page map text files in tests/e2e/maps.
 *
 * A map file is plain text so it can be read, diffed and hand-edited without
 * running any code. The format is line based:
 *
 *   # comment
 *   @page projects route=/projects desc="Projects list" requires=auth
 *   @group wizard-create type=wizard page=projects desc="Project creation wizard"
 *   field  projectName type=text placeholder="Enter project name" required=1
 *   button next text="Next" action=next
 *   nav    milestones text="Milestones" route=/projects/:id/milestones
 *   assert created text="Project created successfully!"
 *   api    createProject method=POST path=/projects
 *   @end
 *
 * Attribute values may be quoted (`key="two words"`). Anything after the
 * first token is treated as attributes.
 */

export type EntryKind = "field" | "button" | "nav" | "assert" | "api";

export interface Attributes {
  [key: string]: string;
}

export interface Entry {
  kind: EntryKind;
  key: string;
  attrs: Attributes;
  /** Group this entry belongs to. */
  group: string;
  /** Page id this entry belongs to (from the page it was declared under). */
  page: string;
  line: number;
}

export interface Group {
  id: string;
  type: "form" | "modal" | "wizard" | "nav" | "list" | "page" | string;
  desc: string;
  page: string;
  /** Optional: the button that opens this modal/wizard. */
  openedBy?: string;
  entries: Entry[];
}

export interface PageDef {
  id: string;
  route: string;
  desc: string;
  requires: "auth" | "anon";
}

export interface MapFile {
  file: string;
  pages: PageDef[];
  groups: Group[];
  entries: Entry[];
}

/** Splits `key=value key2="a b"` into an attributes object. */
export function parseAttrs(rest: string): Attributes {
  const attrs: Attributes = {};
  // Either key=value, key="quoted value", or a bare key (treated as a flag).
  const re = /([\w.-]+)(?:=(\"([^\"]*)\"|'([^']*)'|([^\s\]]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    const name = m[1];
    const value = m[3] ?? m[4] ?? m[5] ?? "1";
    attrs[name] = value;
  }
  return attrs;
}

function stripComment(line: string): string {
  // Only strip comments that are not inside a quoted value. Map files use `#`
  // for comments and never rely on `#` inside values except in colours, which
  // we do not put in maps.
  const hash = line.indexOf("#");
  return hash === -1 ? line : line.slice(0, hash);
}

/** Parses map text into its structured form. Never throws on bad lines. */
export function parseMap(text: string, file = "<memory>"): MapFile {
  const map: MapFile = { file, pages: [], groups: [], entries: [] };

  let currentPage = "";
  let currentGroup: Group | null = null;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = stripComment(lines[i]).trim();
    if (!line) continue;

    if (line.startsWith("@page")) {
      const body = line.slice(5).trim();
      const sp = body.indexOf(" ");
      const id = sp === -1 ? body : body.slice(0, sp);
      const attrs = parseAttrs(sp === -1 ? "" : body.slice(sp + 1));
      const page: PageDef = {
        id,
        route: attrs.route ?? "",
        desc: attrs.desc ?? "",
        requires: (attrs.requires as "auth" | "anon") ?? "auth",
      };
      map.pages.push(page);
      currentPage = id;
      currentGroup = null;
      continue;
    }

    if (line.startsWith("@group")) {
      const body = line.slice(6).trim();
      const sp = body.indexOf(" ");
      const id = sp === -1 ? body : body.slice(0, sp);
      const attrs = parseAttrs(sp === -1 ? "" : body.slice(sp + 1));
      const group: Group = {
        id,
        type: attrs.type ?? "form",
        desc: attrs.desc ?? "",
        page: attrs.page ?? currentPage,
        openedBy: attrs.openedBy,
        entries: [],
      };
      map.groups.push(group);
      currentGroup = group;
      continue;
    }

    if (line === "@end") {
      currentGroup = null;
      continue;
    }

    const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/);
    if (!match) continue;
    const kind = match[1] as EntryKind;
    const key = match[2];
    const attrs = parseAttrs(match[3] ?? "");

    const valid: EntryKind[] = ["field", "button", "nav", "assert", "api"];
    if (!valid.includes(kind)) continue;

    const entry: Entry = {
      kind,
      key,
      attrs,
      group: currentGroup?.id ?? currentPage ?? "root",
      page: currentPage,
      line: lineNo,
    };
    map.entries.push(entry);
    currentGroup?.entries.push(entry);
  }

  return map;
}

/** Finds one entry by kind and key across a set of maps. */
export function findEntry(
  maps: MapFile[],
  kind: EntryKind,
  key: string,
  groupId?: string,
): Entry | undefined {
  for (const map of maps) {
    const hit = map.entries.find(
      (e) => e.kind === kind && e.key === key && (!groupId || e.group === groupId),
    );
    if (hit) return hit;
  }
  return undefined;
}

/** All entries of a kind, optionally filtered by group. */
export function listEntries(maps: MapFile[], kind: EntryKind, groupId?: string): Entry[] {
  const out: Entry[] = [];
  for (const map of maps) {
    for (const e of map.entries) {
      if (e.kind === kind && (!groupId || e.group === groupId)) out.push(e);
    }
  }
  return out;
}
