/**
 * Behavioural test for the client's read coordinator.
 *
 * The reported symptom was that a page fired a burst of parallel queries and exhausted the
 * server's connection pool. runCoordinatedRead is the thing that is supposed to prevent it, so
 * its two guarantees are asserted here directly:
 *
 *   1. never more than MAX_CONCURRENT_READS reads in flight
 *   2. identical concurrent reads are coalesced into a single request
 *
 * Plus the failure modes that would reintroduce the burst:
 *   3. a hanging read must not starve the queue (deadline releases the slot)
 *   4. a rejected read must release its slot
 *
 * Run: node scripts/check-request-coordinator.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(repo, "Client/src/api/requestCoordinator.ts"), "utf8");

// Pull the tunables out of the module so the test asserts against the real values.
const readMax = /MAX_CONCURRENT_READS\s*=\s*(\d+)/.exec(source);
const readTimeout = /READ_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(source);
if (!readMax || !readTimeout) {
  console.error("Could not read MAX_CONCURRENT_READS / READ_TIMEOUT_MS from the module.");
  process.exit(1);
}
const MAX_CONCURRENT_READS = Number(readMax[1]);
const READ_TIMEOUT_MS = Number(readTimeout[1].replace(/_/g, ""));

// Transpile with the project's own TypeScript rather than stripping types by regex.
// Regex stripping is what makes these tests silently stop testing anything.
const typescriptPath = path.join(repo, "Client/node_modules/typescript/lib/typescript.js");
let ts;
try {
  ts = (await import("file://" + typescriptPath.replace(/\\/g, "/"))).default;
} catch (error) {
  console.error("Could not load typescript from Client/node_modules. Run `pnpm install` in Client/ first.");
  process.exit(1);
}

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;

const dir = mkdtempSync(path.join(tmpdir(), "pmwds-coord-"));
const file = path.join(dir, "coordinator.mjs");
writeFileSync(file, transpiled);

let mod;
try {
  mod = await import("file://" + file.replace(/\\/g, "/"));
} catch (error) {
  console.error("Failed to load the coordinator for testing:\n" + error.message);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1 & 2: concurrency cap and coalescing ────────────────────────────────────
{
  mod.resetCoordinatedReads();
  let inFlight = 0;
  let peak = 0;
  let starts = 0;

  const start = () => {
    starts++;
    inFlight++;
    peak = Math.max(peak, inFlight);
    return sleep(20).then(() => {
      inFlight--;
      return "ok";
    });
  };

  // Twelve different URLs, plus four duplicates of the first one.
  const promises = [];
  for (let i = 0; i < 12; i++) promises.push(mod.runCoordinatedRead(`k${i}`, start));
  for (let i = 0; i < 4; i++) promises.push(mod.runCoordinatedRead("k0", start));

  await Promise.all(promises);

  console.log(`peak concurrency: ${peak} (limit ${MAX_CONCURRENT_READS}); requests started: ${starts} of 16 calls`);
  assert(peak <= MAX_CONCURRENT_READS, `peak concurrency ${peak} exceeded limit ${MAX_CONCURRENT_READS}`);
  assert(peak > 1, "the queue never used more than one slot, so it is not actually parallel");
  assert(starts === 12, `expected 12 distinct reads after coalescing 4 duplicates, got ${starts}`);
}

// ── 3: a hanging read must not starve the queue ──────────────────────────────
{
  mod.resetCoordinatedReads();
  let everStarted = false;

  // A read that never settles.
  mod.runCoordinatedRead("hang", () => new Promise(() => {})).catch(() => {});

  // A read queued behind it must still complete once the deadline frees the slot.
  const behind = mod.runCoordinatedRead("behind", () => sleep(5).then(() => "behind-done"));
  const result = await Promise.race([behind, sleep(READ_TIMEOUT_MS + 2000).then(() => "STARVED")]);

  everStarted = result === "behind-done";
  console.log(`queued read behind a hanging one: ${result}`);
  assert(everStarted, "a hanging read starved the queue instead of hitting the deadline");

  // The hung slot must eventually be reclaimed, or every later read starves too.
  await sleep(READ_TIMEOUT_MS + 200);
  const after = await mod.runCoordinatedRead("after", () => Promise.resolve("after-done"));
  console.log(`read after the deadline: ${after}`);
  assert(after === "after-done", "reads stayed starved after the deadline fired");
}

// ── 4: a rejected read must release its slot ─────────────────────────────────
{
  mod.resetCoordinatedReads();
  let peak = 0;
  let inFlight = 0;
  const start = () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    return sleep(10).then(() => { inFlight--; return "ok"; });
  };

  const failing = Array.from({ length: 6 }, () =>
    mod.runCoordinatedRead(`fail${Math.random()}`, () => Promise.reject(new Error("boom"))).catch(() => "rejected"),
  );
  const succeeding = Array.from({ length: 6 }, (_, i) => mod.runCoordinatedRead(`ok${i}`, start));

  const results = await Promise.all([...failing, ...succeeding]);
  console.log(`rejections handled: ${results.filter((r) => r === "rejected").length}/6; peak ${peak}`);

  assert(results.filter((r) => r === "rejected").length === 6, "not every failing read rejected");
  assert(results.filter((r) => r === "ok").length === 6, "a failing read leaked its slot and starved a succeeding one");
}

rmSync(dir, { recursive: true, force: true });

if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log("\nOK: read coordinator caps concurrency, coalesces duplicates, and survives hangs and failures.");