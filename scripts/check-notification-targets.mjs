/**
 * Contract check for notification click-through.
 *
 * The bug being guarded against: the backend stored an ActionUrl that the client router does
 * not serve (notably a bare "/tasks"), so clicking the notification rendered the "no access"
 * page and looked like navigation was broken.
 *
 * This script re-reads the real route table from App.tsx and the real literals from the
 * notification-producing backend files, so it fails when either side drifts. It is not allowed
 * to pass vacuously: zero extracted literals is itself a failure.
 *
 * Run from the repo root:  node scripts/check-notification-targets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");

const app = read("Client/src/App.tsx");
const seed = read("PMWDS.Persistence/Migrations/Seeders/NotificationsSeeder.cs");
const service = read("PMWDS.Infrastructure/Services/NotificationService.cs");
const resolver = read("Client/src/lib/notificationTarget.ts");

const failures = [];
const checks = [];

// ── 1. Routes the client actually serves ──────────────────────────────────────
const served = new Set();
for (const m of app.matchAll(/<Route\s+path="([^"]+)"/g)) {
  served.add(m[1].replace(/\/\*$/, ""));
}
if (!served.has("*")) {
  failures.push("App.tsx has no catch-all route; this check's assumptions are stale.");
}

/** Does a concrete pathname match one of the served route templates? */
function matchesRoute(pathname) {
  for (const template of served) {
    if (!template || template === "*") continue;
    const pattern = "^" + template.replace(/:[^/]+/g, "[^/]+") + "/?$";
    if (new RegExp(pattern).test(pathname)) return true;
  }
  return false;
}

// ── 2. Every route-shaped literal the backend can hand the client ─────────────
/** First path segments the client routes on. A literal under one of these is an ActionUrl. */
const ROUTE_ROOTS = new Set([
  "projects", "tasks", "notifications", "organizations", "departments",
  "users", "ai", "reports", "roles", "settings", "skills", "profiles", "activity-logs",
]);

const literalRe = /\$?"(\/[A-Za-z0-9_.\-{}$]+(?:\/[A-Za-z0-9_.\-{}$]*)*(?:\?[A-Za-z0-9_.\-={}$&]*)?)"/g;

/** Comments explain the routes by name; only real code literals should be validated. */
function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

const stored = [];
for (const [origin, text] of [["NotificationsSeeder", seed], ["NotificationService", service]]) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i])) continue;
    for (const m of lines[i].matchAll(literalRe)) {
      const root = m[1].split("/")[1] ?? "";
      if (!ROUTE_ROOTS.has(root)) continue;
      stored.push([`${origin}:${i + 1}`, m[1]]);
    }
  }
}

if (stored.length === 0) {
  failures.push(
    "No ActionUrl literals were found. Extraction is broken, so this check would pass vacuously.",
  );
}

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const TASK_ID = "22222222-2222-2222-2222-222222222222";
const concretise = (raw) =>
  raw
    .replace(/\{task\.ProjectId\}/g, PROJECT_ID)
    .replace(/\{sampleTask\.ProjectId\}/g, PROJECT_ID)
    .replace(/\{projectId\.Value\}/g, PROJECT_ID)
    .replace(/\{projectId\}/g, PROJECT_ID)
    .replace(/\{taskId\}/g, TASK_ID)
    .replace(/\{sampleTask\.Id\}/g, TASK_ID);

const seen = new Set();
for (const [origin, raw] of stored) {
  const url = concretise(raw);
  if (seen.has(url)) continue;
  seen.add(url);

  const [pathname] = url.split("?");

  // "/tasks/{id}" is the notification-only shorthand. It must carry an id, and the client
  // resolves the owning project with an API call before navigating.
  if (/^\/tasks\/[^/]+/.test(pathname)) {
    checks.push(`${origin.padEnd(28)} ${url.padEnd(56)} shorthand-ok`);
    continue;
  }
  if (pathname === "/tasks") {
    failures.push(`${origin} stores bare "/tasks", which is not a route: ${url}`);
    continue;
  }
  if (matchesRoute(pathname)) {
    checks.push(`${origin.padEnd(28)} ${url.padEnd(56)} routable`);
  } else {
    failures.push(`${origin} stores an unroutable ActionUrl: ${url}`);
  }
}

// ── 3. The client resolver must agree with the route table ────────────────────
const knownMatch = /const KNOWN_PATHS: RegExp\[\] = \[([\s\S]*?)\n\];/m.exec(resolver);
if (!knownMatch) {
  failures.push("Could not find KNOWN_PATHS in Client/src/lib/notificationTarget.ts");
} else {
  // Parse line by line: the sources contain escaped slashes (`\/`), so a single regex that
  // excludes "/" from the captured body never matches them.
  const patterns = knownMatch[1]
    .split("\n")
    .map((line) => /^\s*\/(.*)\/,\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => m[1]);
  if (patterns.length === 0) {
    failures.push("KNOWN_PATHS parsed as empty; the resolver check would pass vacuously.");
  }
  for (const raw of patterns) {
    // Turn the pattern source into one representative concrete path:
    //   ^\/projects\/[^/]+$   ->   /projects/x
    //   ^\/projects\/[^/]+\/(overview|milestones|...)$  ->  /projects/x/overview
    const sample = raw
      .replace(/\\\//g, "/")      // the source escapes its slashes
      .replace(/^\^/, "")
      .replace(/\$$/, "")
      .replace(/\[\^\/\]\+/g, "x")
      .replace(/\((?:\?:)?[a-zA-Z|]+\)/g, (g) => g.slice(1, -1).split("|")[0]);
    const ok = matchesRoute(sample);
    checks.push(`${"resolver KNOWN_PATHS".padEnd(28)} ${sample.padEnd(40)} ${ok ? "routable" : "NOT A ROUTE"}`);
    if (!ok) failures.push(`Resolver pattern does not match a served route: ${raw} (sample ${sample})`);
  }
}

console.log("Served routes:");
for (const r of [...served].sort()) console.log("  " + r);

console.log("\nChecks:");
for (const c of checks) console.log("  " + c);

if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("\nOK: every stored ActionUrl resolves to a served route.");
