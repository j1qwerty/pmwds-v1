/**
 * Fails if any module under Client/src cannot be reached from the app entry points.
 *
 * There is no code splitting in this client, so a static module graph is an exact reachability
 * model: anything not reachable from main.tsx / App.tsx is dead weight that still gets compiled,
 * type-checked and linted. This is what let roughly 4k lines of duplicated and orphaned
 * components accumulate unnoticed.
 *
 * Run from the repo root:  node scripts/check-client-reachability.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(repo, "Client", "src");

if (!fs.existsSync(src)) {
  console.error("Client/src not found.");
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
})(src);

/**
 * Static import/export edges. Deliberately conservative: if a specifier fails to resolve the
 * edge is skipped rather than guessed, and TypeScript would report the bad import anyway.
 */
const IMPORT_RE =
  /(?:^|\n)\s*import\s+(?:type\s+)?(?:[\s\S]*?)\s*from\s+["']([^"']+)["']|(?:^|\n)\s*export\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;

function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base + ".ts",
    base + ".tsx",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const graph = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const deps = new Set();
  for (const match of text.matchAll(IMPORT_RE)) {
    const target = resolveSpecifier(file, match[1] ?? match[2] ?? match[3]);
    if (target) deps.add(target);
  }
  graph.set(file, deps);
}

// Entry points: the modules Vite actually loads first.
const entries = files.filter((file) => /[\\/](main|App)\.tsx?$/.test(file));
if (entries.length === 0) {
  console.error("No entry points found. This check would pass vacuously.");
  process.exit(1);
}

const reachable = new Set();
const queue = [...entries];
while (queue.length > 0) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  for (const dep of graph.get(file) ?? []) {
    if (!reachable.has(dep)) queue.push(dep);
  }
}

const rel = (file) => path.relative(src, file).split(path.sep).join("/");
const unreachable = files.filter((file) => !reachable.has(file)).map(rel).sort();

console.log(`Modules: ${files.length}, reachable: ${reachable.size}, unreachable: ${unreachable.length}`);

if (unreachable.length > 0) {
  console.log("\nUnreachable modules (delete them or import them):");
  for (const file of unreachable) console.log("  " + file);
  process.exit(1);
}

console.log("OK: every client module is reachable from the entry points.");
