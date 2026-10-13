/**
 * PMWDS end-to-end test runner.
 *
 * On startup it asks which display mode to use, in BOTH modes:
 *   1. Headless (default) - no browser window is shown, fastest, screenshots
 *      are still written on failure.
 *   2. Visible            - a real browser window you can watch, actions are
 *      slowed down, and a screenshot is captured before and after every step.
 *
 * Two run modes:
 *   Interactive (default) - runs one step at a time and asks before each step.
 *   Auto (--auto)         - runs the selected flows end to end with no step
 *     prompts. The display-mode question is still asked at startup.
 *
 * Typed answers at a step gate: Y/n continue, s screenshot, q quit.
 *
 * Usage:
 *   npm run e2e                       interactive, asks for display mode + flows
 *   npm run e2e -- --auto             run every flow unattended
 *   npm run e2e -- --auto --flows 1,3 pick specific flows
 *   npm run e2e -- --mode visible     skip the display question, watch it run
 *   npm run e2e -- --mode headless    skip the display question, no window
 *   npm run e2e -- --user pm          pre-pick the first user
 *   npm run e2e -- --url http://localhost:5175
 *   npm run e2e -- --slowmo 500       slow each action (visible mode default 250)
 *   npm run e2e -- --no-shots         visible mode without per-step screenshots
 */
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadMaps } from "./lib/maps.js";
import { SessionHub, ACCOUNTS, BASE_URL, setBaseUrl } from "./lib/session.js";
import { RunContext, Reporter } from "./lib/context.js";
import { FLOWS } from "./flows/index.js";
import { RemoteControl } from "./lib/remoteControl.js";
import type { Flow, FlowApi } from "./flows/types.js";

type DisplayMode = "headless" | "visible";

interface Args {
  auto: boolean;
  mode: DisplayMode | null;
  shots: boolean;
  slowMo: number | null;
  url: string;
  flows: string[] | null;
  user: string | null;
  /** Control server base; when set, gates are driven by the dev panel. */
  remote: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    auto: false,
    mode: null,
    shots: true,
    slowMo: null,
    url: BASE_URL,
    flows: null,
    user: null,
    remote: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const eq = a.indexOf("=");
      if (eq !== -1) return a.slice(eq + 1);
      return argv[++i];
    };
    if (a === "--auto") args.auto = true;
    else if (a === "--mode") args.mode = normalizeMode(val());
    else if (a.startsWith("--mode=")) args.mode = normalizeMode(a.slice(7));
    else if (a === "--visible") args.mode = "visible";
    else if (a === "--headless") args.mode = "headless";
    else if (a === "--no-shots") args.shots = false;
    else if (a === "--shots") args.shots = true;
    else if (a === "--slowmo") args.slowMo = Number(val());
    else if (a.startsWith("--slowmo=")) args.slowMo = Number(a.slice(9));
    else if (a === "--url") args.url = val();
    else if (a.startsWith("--url=")) args.url = a.slice(6);
    else if (a === "--flows") args.flows = String(val()).split(",").map((s) => s.trim());
    else if (a.startsWith("--flows=")) args.flows = a.slice(8).split(",").map((s) => s.trim());
    else if (a === "--user") args.user = val();
    else if (a.startsWith("--user=")) args.user = a.slice(7);
    else if (a === "--remote") args.remote = val();
    else if (a.startsWith("--remote=")) args.remote = a.slice(9);
  }
  return args;
}

function normalizeMode(v: string | undefined): DisplayMode | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "visible" || s === "headed" || s === "2" || s === "show") return "visible";
  if (s === "headless" || s === "hidden" || s === "1") return "headless";
  return null;
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

/** Asks for the display mode. Returned value is never null. */
async function chooseMode(args: Args): Promise<DisplayMode> {
  if (args.mode) {
    console.log(`Display mode: ${args.mode} (from --mode)`);
    return args.mode;
  }
  console.log("\nHow should the browser run?");
  console.log("  1) Headless  - no browser window is shown. Fastest. Default.");
  console.log("  2) Visible   - browser window you can watch, slowed down,");
  console.log("                  screenshot saved before and after every step.");
  const answer = await ask("Choose [1]: ");
  const mode = normalizeMode(answer) ?? "headless";
  console.log(`Display mode: ${mode}${mode === "headless" ? " (default)" : ""}`);
  return mode;
}

function usage() {
  console.log(`
PMWDS end-to-end runner

  npm run e2e                       Interactive: asks display mode + flows, step by step
  npm run e2e -- --auto             Auto: run every flow, no step prompts
  npm run e2e -- --auto --flows 1,3 Auto: only flows 1 and 3
  npm run e2e -- --mode visible     Watch the browser, per-step screenshots
  npm run e2e -- --mode headless    No browser window (default)
  npm run e2e -- --no-shots         Visible mode without per-step screenshots
  npm run e2e -- --user pm          Pre-pick the first user
  npm run e2e -- --url http://localhost:5175

Users:
${ACCOUNTS.map((a) => `  ${a.id.padEnd(16)} ${a.label} (${a.email})`).join("\n")}

Flows:
${FLOWS.map((f, i) => `  ${i + 1}. ${f.id.padEnd(20)} ${f.title}`).join("\n")}
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const shotDir = join(process.cwd(), "e2e-artifacts", "screenshots");
  const uploadDir = join(process.cwd(), "e2e-artifacts", "uploads");
  mkdirSync(shotDir, { recursive: true });
  mkdirSync(uploadDir, { recursive: true });

  // Apply a --url override before any context is created.
  setBaseUrl(args.url);

  const mode = await chooseMode(args);
  const visible = mode === "visible";
  const slowMo = args.slowMo ?? (visible ? 250 : 0);
  const shots = visible && args.shots;

  console.log(`\nBase URL:   ${args.url}`);
  console.log(`Run mode:   ${args.auto ? "AUTOMATIC" : "INTERACTIVE (asked before each step)"}`);
  console.log(`Browser:    ${visible ? "VISIBLE - watch the window" : "HEADLESS - no window shown"}`);
  console.log(`Action pace: slowMo=${slowMo}ms`);
  console.log(`Screenshots: ${shots ? `every step -> ${shotDir}` : visible ? "disabled (--no-shots)" : "only on failure"}`);
  console.log(`Uploads:     ${uploadDir}`);

  // Interactive flow selection.
  let selectedFlows: Flow[] = FLOWS;
  if (args.flows && args.flows.length) {
    selectedFlows = args.flows
      .map((sel) => FLOWS[Number(sel) - 1] ?? FLOWS.find((f) => f.id === sel || f.id.startsWith(sel)))
      .filter((f): f is Flow => !!f);
    if (!selectedFlows.length) {
      console.log("No matching flows. Use --flows 1,3 or flow ids.");
      return;
    }
  } else if (!args.auto) {
    console.log("\nSelect the flows to run (numbers separated by commas, 'all' for everything):");
    FLOWS.forEach((f, i) => console.log(`  ${i + 1}. ${f.title}`));
    const answer = await ask("Flows [all]: ");
    if (answer && answer.toLowerCase() !== "all") {
      const picked = answer.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      selectedFlows = picked.map((n) => FLOWS[n - 1]).filter((f): f is Flow => !!f);
    }
  }

  // Remote mode: the in-app dev panel drives the gates instead of stdin.
  const remoteUrl = args.remote ?? process.env.E2E_CONTROL_URL ?? null;
  const remote = remoteUrl
    ? new RemoteControl({ baseUrl: remoteUrl, runId: process.env.E2E_RUN_ID ?? "run-1" })
    : null;

  const report = new Reporter(
    !args.auto,
    remote ? (q) => remote.ask(q) : ask,
    remote
      ? (s) => {
          console.log(s);
          remote.push(s);
        }
      : console.log,
  );
  const ctx = new RunContext();
  ctx.notes.artifactDir = uploadDir;

  void remote?.emit({
    type: "run-start",
    mode: visible ? "visible" : "headless",
    flows: selectedFlows.map((f) => f.id),
  });

  const hub = new SessionHub(loadMaps(), { headless: !visible, slowMo });
  const failures: string[] = [];
  const firstUser = args.user ?? selectedFlows[0]?.users[0] ?? "pm";

  try {
    await hub.start();

    report.info(`Pre-flight: signing in as ${firstUser} to verify connectivity...`);
    await hub.as(firstUser);
    report.ok(`Connected. ${ACCOUNTS.find((a) => a.id === firstUser)?.label} signed in.`);
  } catch (err) {
    report.fail(`Could not sign in as ${firstUser}: ${err instanceof Error ? err.message : String(err)}`);
    report.info("Is the API running on :5179 and client2 on :5175? See tests/e2e/README.md.");
    await hub.close();
    process.exitCode = 1;
    return;
  }

  let stepCounter = 0;
  const totalSteps = selectedFlows.reduce((n, f) => n + f.steps.length, 0);

  const snapshot = async (userId: string, label: string) => {
    const path = join(shotDir, `${String(stepCounter).padStart(2, "0")}-${label}.png`);
    await hub.driver(userId).page.screenshot({ path, fullPage: true });
    return path;
  };

  const runFlow = async (flow: Flow, flowIndex: number): Promise<boolean> => {
    report.step(`FLOW: ${flow.title}`);
    report.info(flow.description);
    report.info(`Users: ${flow.users.join(", ")}`);
    void remote?.emit({
      type: "flow-start",
      flowId: flow.id,
      index: flowIndex,
      total: selectedFlows.length,
    });

    for (const step of flow.steps) {
      stepCounter += 1;
      const label = `${step.title}  [as ${step.as}]  [${stepCounter}/${totalSteps}]`;

      const api: FlowApi = {
        hub,
        ctx,
        report,
        as: (userId) => hub.as(userId),
        shot: (userId, shotLabel) => snapshot(userId, shotLabel),
        gate: () => report.gate(`Run ${label}? [Y/n/s/q]`, () => snapshot(step.as, step.id)),
        ask: (q) => report.ask(q),
      };

      if (!args.auto) {
        try {
          await hub.as(step.as);
        } catch (err) {
          report.warn(`sign-in as ${step.as} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (shots) {
        const before = await snapshot(step.as, `${step.id}-before`).catch(() => undefined);
        if (before) report.info(`  before: ${before}`);
      }

      void remote?.emit({
        type: "step-start",
        flowId: flow.id,
        stepId: step.id,
        index: stepCounter,
        total: totalSteps,
        as: step.as,
      });

      if (!(await api.gate())) {
        report.info("Skipped (or quit). Stopping this flow.");
        void remote?.emit({ type: "step-end", flowId: flow.id, stepId: step.id, status: "skipped" });
        return false;
      }

      report.info(`as ${step.as}: ${step.title}`);
      try {
        const keepGoing = await step.run(api);
        void remote?.emit({ type: "step-end", flowId: flow.id, stepId: step.id, status: "ok" });
        if (keepGoing === false) {
          report.info("Step returned false - stopping this flow.");
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        report.fail(message);
        failures.push(`${flow.id}/${step.id}: ${message.split("\n")[0]}`);
        void remote?.emit({ type: "step-end", flowId: flow.id, stepId: step.id, status: "failed" });
        const shot = await snapshot(step.as, `${step.id}-FAILED`).catch(() => undefined);
        if (shot) report.info(`  failure shot: ${shot}`);
        if (!args.auto) {
          const again = remote
            ? await remote.ask("  Continue with the next step anyway? [Y/n] ")
            : await ask("  Continue with the next step anyway? [Y/n] ");
          if (again.toLowerCase() === "n") return false;
        } else {
          report.fail("auto mode: aborting the run.");
          return false;
        }
      }

      if (shots) {
        const after = await snapshot(step.as, `${step.id}-after`).catch(() => undefined);
        if (after) report.info(`  after:  ${after}`);
      }

      // Pace between steps (pause-aware + a beat for watchability). Also gives
      // auto mode its only pause point, since it has no gates.
      await remote?.pace();
    }
    return true;
  };

  for (const [flowIndex, flow] of selectedFlows.entries()) {
    const completed = await runFlow(flow, flowIndex);
    if (completed) {
      void remote?.emit({ type: "flow-end", flowId: flow.id });
    } else {
      break;
    }
  }

  void remote?.emit({ type: "run-end", ok: failures.length === 0 });

  report.step("RUN COMPLETE");
  report.info(
    `Projects still present: ${ctx.projects.map((p) => `${p.name} (${p.id})`).join(", ") || "none (deleted as expected)"}`,
  );
  if (failures.length) {
    report.fail(`${failures.length} step failure(s):`);
    failures.forEach((f) => report.info(`  - ${f}`));
    process.exitCode = 1;
  } else {
    report.ok("No step failures.");
  }
  report.info(`Screenshots: ${shotDir}`);
  report.info(`Uploads:     ${uploadDir}`);

  await hub.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});