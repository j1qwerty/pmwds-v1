#!/usr/bin/env node
/**
 * Runs the Playwright browser tests in browser-tests/ from the repository root.
 *
 * The point of this script is that `pnpm btest` is the only command needed:
 * it finds the seeded password, installs what is missing, and runs the suite.
 *
 * The password is read from the repository's own .env (Seed__DefaultPassword),
 * which is the same value the database seeder assigns to every seeded account.
 * It is never printed and never written anywhere, and .env is gitignored.
 * Set E2E_PASSWORD in the shell to override the file value.
 *
 * Usage:
 *   pnpm btest              run the suite headless
 *   pnpm btest --headed     run it with a visible browser
 *   pnpm btest --list       list tests without running them
 *   pnpm btest discover     read-only UI discovery pass (no writes)
 *   pnpm btest setup        install deps and the browser only
 *   pnpm btest report       open the last HTML report
 *
 * Any extra argument is forwarded to Playwright, e.g.
 *   pnpm btest -- --grep "login"
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSER_TESTS = join(ROOT, "browser-tests");

// Kept in step with the pinned dev server port in Client/vite.config.ts.
// "localhost" rather than 127.0.0.1: Vite binds to localhost, which resolves to
// IPv6 ::1 on Windows, so a literal 127.0.0.1 is refused with ECONNREFUSED.
const DEFAULT_BASE_URL = "http://localhost:5175";

/**
 * Minimal .env reader.
 *
 * Deliberately hand-rolled rather than pulling in dotenv: the browser tests are
 * the only consumer of the one value we need, and adding a dependency here would
 * mean a second lockfile at the repository root purely to read a single key.
 */
function readEnvFile(path) {
  if (!existsSync(path)) return {};

  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const rootEnv = {
  ...readEnvFile(join(ROOT, ".env")),
  ...readEnvFile(join(ROOT, ".env.local")),
};

function resolveEnvironment() {
  const password =
    process.env.E2E_PASSWORD ||
    rootEnv.E2E_PASSWORD ||
    rootEnv.Seed__DefaultPassword ||
    "";

  const baseUrl =
    process.env.E2E_BASE_URL || rootEnv.E2E_BASE_URL || DEFAULT_BASE_URL;

  return {
    ...process.env,
    E2E_PASSWORD: password,
    E2E_BASE_URL: baseUrl,
  };
}

function pnpmCommand() {
  // pnpm is a .cmd shim on Windows, which spawnSync cannot execute directly
  // unless the shell is allowed to resolve it.
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? BROWSER_TESTS,
    env: options.env ?? process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw new Error(`Failed to start ${command}: ${result.error.message}`);
  }
  return result.status ?? 1;
}

function fail(message) {
  console.error(`\n[browser-tests] ${message}\n`);
  process.exit(1);
}

function ensureInstalled(env) {
  // Only install when the dependencies are actually absent. Re-running install on
  // every invocation would add several seconds to a command that is meant to be
  // quick to repeat while iterating.
  if (!existsSync(join(BROWSER_TESTS, "node_modules"))) {
    console.log("[browser-tests] Installing dependencies...");
    const status = run(pnpmCommand(), ["install"], { env });
    if (status !== 0) fail("pnpm install failed.");
  }

  // Idempotent and quick once the browser is present: Playwright reports the
  // already-installed revision and exits.
  console.log("[browser-tests] Ensuring Chromium is installed...");
  const browserStatus = run(pnpmCommand(), ["exec", "playwright", "install", "chromium"], { env });
  if (browserStatus !== 0) fail("Could not install Chromium for Playwright.");
}

/**
 * Warn when the client is not answering, because the resulting failure inside
 * Playwright is a confusing navigation timeout rather than a clear message.
 */
async function warnIfClientUnreachable(baseUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      console.warn(`[browser-tests] Warning: ${baseUrl} responded ${response.status}.`);
    }
  } catch {
    console.warn(
      `[browser-tests] Warning: ${baseUrl} is not reachable.\n` +
        "              Start the client (cd Client; npm run dev) and the API before running.\n" +
        "              Set E2E_BASE_URL to point somewhere else if it is not on port 5175.",
    );
  }
}

function parseMode(argv) {
  const flags = new Set();
  const passthrough = [];

  for (const arg of argv) {
    if (arg === "discover" || arg === "setup" || arg === "report") {
      flags.add(arg);
    } else if (arg === "--dry-run") {
      // Prints the plan without installing or launching anything. Exists so the
      // resolution of the password and target URL can be verified without
      // starting a browser.
      flags.add("dry-run");
    } else if (arg.startsWith("--")) {
      flags.add(arg);
    } else {
      passthrough.push(arg);
    }
  }

  const mode = flags.has("discover")
    ? "discover"
    : flags.has("setup")
      ? "setup"
      : flags.has("report")
        ? "report"
        : "test";

  return {
    mode,
    headed: flags.has("--headed"),
    list: flags.has("--list"),
    ui: flags.has("--ui"),
    dryRun: flags.has("dry-run"),
    passthrough,
  };
}

async function main() {
  const { mode, headed, list, ui, dryRun, passthrough } = parseMode(process.argv.slice(2));
  const env = resolveEnvironment();

  if (mode !== "report" && mode !== "setup") {
    if (!env.E2E_PASSWORD) {
      fail(
        "No seeded password found.\n" +
          "  Set Seed__DefaultPassword in the repository .env (the seeder requires it too),\n" +
          "  or set E2E_PASSWORD for this shell.",
      );
    }
    // State where the value came from without revealing it.
    const source = process.env.E2E_PASSWORD
      ? "E2E_PASSWORD in the environment"
      : rootEnv.E2E_PASSWORD
        ? "E2E_PASSWORD in .env"
        : "Seed__DefaultPassword in .env";
    console.log(`[browser-tests] Seeded password loaded from ${source}.`);
    console.log(`[browser-tests] Target: ${env.E2E_BASE_URL}`);
  }

  if (dryRun) {
    console.log(
      "[browser-tests] Dry run: dependencies and the browser were not installed and no test was launched.",
    );
    return;
  }

  ensureInstalled(env);

  if (mode === "setup") {
    console.log("[browser-tests] Setup complete.");
    return;
  }

  if (mode === "report") {
    run(pnpmCommand(), ["exec", "playwright", "show-report", "reports/playwright"], { env });
    return;
  }

  if (mode === "discover") {
    // Discovery only logs in and reads pages, so it is safe against a real
    // database. It is the run to do first when the full flow fails.
    await warnIfClientUnreachable(env.E2E_BASE_URL);
    console.log("[browser-tests] Running UI discovery (read-only)...\n");
    const status = run(pnpmCommand(), ["run", "e2e:discover"], { env });
    process.exit(status);
  }

  await warnIfClientUnreachable(env.E2E_BASE_URL);

  if (mode === "test" && !list && !ui) {
    console.log(
      "[browser-tests] Running the full business lifecycle.\n" +
        "              This creates and then deletes test data. Use a disposable database.",
    );
  }

  const args = ["exec", "playwright", "test"];
  if (list) args.push("--list");
  if (headed) args.push("--headed");
  if (ui) args.push("--ui");
  args.push(...passthrough);

  process.exit(run(pnpmCommand(), args, { env }));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});