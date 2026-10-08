/**
 * Offline smoke test - no browser, no server. Verifies that every map file
 * parses, that the referenced keys resolve, and that flows reference keys that
 * actually exist. Run with: npx tsx smoke.ts
 */
import { loadMaps } from "./lib/maps.js";
import { FLOWS } from "./flows/index.js";
import { listEntries, type EntryKind } from "./lib/mapfile.js";
import { ACCOUNTS } from "./lib/session.js";

let problems = 0;
const fail = (msg: string) => {
  console.log(`  FAIL ${msg}`);
  problems++;
};

const maps = loadMaps();
console.log(`Loaded ${maps.length} map file(s): ${maps.map((m) => m.file).join(", ")}`);

// 1. Structural sanity.
for (const m of maps) {
  if (!m.entries.length) fail(`${m.file} parsed but has no entries`);
  const ids = new Set<string>();
  for (const g of m.groups) {
    if (ids.has(g.id)) fail(`${m.file}: duplicate group id "${g.id}"`);
    ids.add(g.id);
  }
}
console.log(`Groups: ${maps.reduce((n, m) => n + m.groups.length, 0)}, entries: ${maps.reduce((n, m) => n + m.entries.length, 0)}`);

// 2. Every group id referenced by a driver call exists.
const groupIds = new Set(maps.flatMap((m) => m.groups.map((g) => g.id)));
const keysByKind = new Map<EntryKind, Set<string>>();
for (const kind of ["field", "button", "nav", "assert", "api"] as EntryKind[]) {
  keysByKind.set(kind, new Set(listEntries(maps, kind).map((e) => e.key)));
}

// 3. Flows must only reference known users.
const userIds = new Set(ACCOUNTS.map((a) => a.id));
for (const flow of FLOWS) {
  for (const u of flow.users) if (!userIds.has(u)) fail(`${flow.id}: unknown user "${u}"`);
  for (const s of flow.steps) if (!userIds.has(s.as)) fail(`${flow.id}/${s.id}: unknown user "${s.as}"`);
}

// 4. Static check: scan flow sources for d.<verb>("<key>"...) and confirm the
//    key and group exist. Catches typos without launching a browser.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const flowDir = join(process.cwd(), "flows");
const verbs = ["fill", "select", "toggle", "upload", "click", "expectText", "waitApi", "nav"];

// Arity differs per verb: fill/select/toggle/upload take (key, value, group),
// while click/nav/expectText/waitApi take (key, group). Read the leading string
// arguments and pick the group from the right position.
const GROUP_INDEX: Record<string, number> = { fill: 2, select: 2, toggle: 2, upload: 2, click: 1, nav: 1, expectText: 1, waitApi: 1 };
const KIND_OF: Record<string, EntryKind> = {
  fill: "field",
  select: "field",
  toggle: "field",
  upload: "field",
  click: "button",
  nav: "nav",
  expectText: "assert",
  waitApi: "api",
};

for (const file of readdirSync(flowDir).filter((f) => f.endsWith(".ts"))) {
  const src = readFileSync(join(flowDir, file), "utf8");
  for (const verb of verbs) {
    // Capture the key plus any further string-literal arguments.
    const re = new RegExp(`\\bd\\.${verb}\\(\\s*"([^"]+)"((?:\\s*,\\s*"[^"]*")*)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const key = m[1];
      const extraArgs = [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
      const group = extraArgs[GROUP_INDEX[verb] - 1];

      const kind = KIND_OF[verb];
      const keys = keysByKind.get(kind)!;
      if (!keys.has(key)) {
        fail(`${file}: ${verb}("${key}") - no ${kind} with that key`);
        continue;
      }
      if (group && !groupIds.has(group)) {
        fail(`${file}: ${verb}("${key}", ..., "${group}") - no group "${group}"`);
      }
    }
  }
}

console.log(`\nFlows: ${FLOWS.length}, steps: ${FLOWS.reduce((n, f) => n + f.steps.length, 0)}`);
if (problems) {
  console.log(`\n${problems} problem(s) found.`);
  process.exit(1);
}
console.log("\nAll map files parse and every referenced key resolves.");
