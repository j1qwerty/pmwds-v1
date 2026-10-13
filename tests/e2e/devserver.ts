/**
 * Control server for the in-app e2e dev panel.
 *
 * The runner already funnels all of its interactivity through one function
 * (`Reporter`'s readLine), so this server never re-implements the gate: it
 * spawns `run.ts --remote`, relays lifecycle events and log lines to the panel
 * over SSE, and parks the runner on a gate question until the panel answers.
 *
 * The panel is a convenience, never a dependency: if this process dies mid-run,
 * the runner's remote channel returns "y" and the run continues unattended.
 *
 *   npx tsx devserver.ts            # :5180
 *   npx tsx devserver.ts --port 5181
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FLOWS } from "./flows/index.js";
import type { RemoteEvent } from "./lib/remoteControl.js";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[process.argv.indexOf("--port") + 1]) || 5180;

/* ------------------------------------------------------------------ state */

type StepState = "pending" | "running" | "ok" | "failed" | "skipped";

type PanelState = {
  runId: string;
  /** idle | running | paused | done */
  status: "idle" | "running" | "paused" | "done";
  mode: string;
  stepGates: boolean;
  currentFlowId: string | null;
  currentStepId: string | null;
  currentStepTitle: string | null;
  currentAs: string | null;
  /** flowId -> stepId -> state */
  steps: Record<string, Record<string, StepState>>;
  /** flowId -> ok | failed */
  flows: Record<string, "ok" | "failed">;
  log: string[];
  /** Set while the runner is parked on a gate question. */
  pendingQuestion: string | null;
  runOk: boolean | null;
};

let runSeq = 0;
let state: PanelState = blankState();
let child: ChildProcess | null = null;
let resolvePrompt: ((answer: string) => void) | null = null;

function blankState(): PanelState {
  return {
    runId: "",
    status: "idle",
    mode: "visible",
    stepGates: true,
    currentFlowId: null,
    currentStepId: null,
    currentStepTitle: null,
    currentAs: null,
    steps: {},
    flows: {},
    log: [],
    pendingQuestion: null,
    runOk: null,
  };
}

/* --------------------------------------------------------------- broadcast */

const clients = new Set<ServerResponse>();

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function pushState() {
  broadcast("state", state);
}

/* ------------------------------------------------------------------ runner */

function catalogue() {
  return FLOWS.map((f, i) => ({
    id: f.id,
    index: i + 1,
    title: f.title,
    description: f.description,
    users: f.users,
    steps: f.steps.map((s, j) => ({ id: s.id, index: j + 1, title: s.title, as: s.as })),
  }));
}

function startRun(opts: { flows?: string[]; stepGates?: boolean; mode?: string }) {
  if (child) return { started: false, reason: "a run is already in progress" };

  const selected = opts.flows?.length ? opts.flows : FLOWS.map((f) => f.id);
  const unknown = selected.filter((id) => !FLOWS.some((f) => f.id === id));
  if (unknown.length) return { started: false, reason: `unknown flow(s): ${unknown.join(", ")}` };

  const mode = opts.mode === "headless" ? "headless" : "visible";
  const stepGates = opts.stepGates !== false;

  state = blankState();
  state.runId = `run-${++runSeq}`;
  state.status = "running";
  state.mode = mode;
  state.stepGates = stepGates;
  for (const id of selected) {
    const flow = FLOWS.find((f) => f.id === id)!;
    state.steps[id] = Object.fromEntries(flow.steps.map((s) => [s.id, "pending" as StepState]));
  }

  const args = ["run.ts", "--remote", `http://127.0.0.1:${PORT}`, "--mode", mode];
  if (!stepGates) args.push("--auto");
  if (selected.length !== FLOWS.length) args.push("--flows", selected.join(","));

  pushState();
  // Resolve tsx from this package, not from a parent directory: the repo uses
  // pnpm, so `node_modules` is only guaranteed next to this file.
  const tsxCli = join(here, "node_modules", "tsx", "dist", "cli.mjs");

  child = spawn(process.execPath, [tsxCli, ...args], {
    cwd: here,
    env: { ...process.env, E2E_CONTROL_URL: `http://127.0.0.1:${PORT}`, E2E_RUN_ID: state.runId },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const relay = (chunk: Buffer) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      state.log.push(line);
      broadcast("log", line);
    }
    if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
  };
  child.stdout?.on("data", relay);
  child.stderr?.on("data", relay);

  child.on("exit", (code) => {
    state.status = "done";
    state.runOk = code === 0;
    state.currentStepId = null;
    state.currentStepTitle = null;
    state.pendingQuestion = null;
    child = null;
    pushState();
  });

  return { started: true, runId: state.runId };
}

function answer(answerValue: string) {
  const resolve = resolvePrompt;
  resolvePrompt = null;
  state.pendingQuestion = null;
  resolve?.(answerValue);
  pushState();
}

function setPaused(paused: boolean) {
  if (!child) return { ok: false, reason: "no run in progress" };
  if (state.status === "done") return { ok: false, reason: "run already finished" };
  state.status = paused ? "paused" : "running";
  pushState();
  return { ok: true, status: state.status };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Holds until resumed. Pause takes effect at step boundaries: a gate prompt
 *  that arrives while paused waits here first, and an answer given while
 *  paused waits here before it is delivered. A step already executing is never
 *  suspended mid-click. */
async function waitWhilePaused() {
  while (state.status === "paused" && child) await sleep(250);
}

/* -------------------------------------------------------------- event sink */

function applyEvent(ev: RemoteEvent) {
  switch (ev.type) {
    case "run-start":
      state.mode = ev.mode;
      break;
    case "flow-start":
      state.currentFlowId = ev.flowId;
      state.currentStepId = null;
      state.currentStepTitle = null;
      break;
    case "flow-end":
      state.flows[ev.flowId] = state.flows[ev.flowId] ?? "ok";
      break;
    case "step-start": {
      state.currentFlowId = ev.flowId;
      state.currentStepId = ev.stepId;
      state.currentStepTitle = null; // filled by the run-start step event below
      state.currentAs = ev.as;
      state.steps[ev.flowId] ??= {};
      state.steps[ev.flowId][ev.stepId] = "running";
      break;
    }
    case "step-end":
      state.steps[ev.flowId] ??= {};
      state.steps[ev.flowId][ev.stepId] =
        ev.status === "ok" ? "ok" : ev.status === "failed" ? "failed" : "skipped";
      if (ev.status === "failed") state.flows[ev.flowId] = "failed";
      break;
    case "run-end":
      state.runOk = ev.ok;
      state.status = "done";
      state.currentStepId = null;
      state.currentStepTitle = null;
      break;
  }
  pushState();
}

/* -------------------------------------------------------------------- http */

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(res: ServerResponse, body: unknown, code = 200) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(text);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") return json(res, {}, 204);

  // Panel -> server
  if (path === "/api/flows") return json(res, { flows: catalogue() });

  if (path === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
    });
    res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (path === "/api/run") {
    const body = await readBody(req);
    return json(res, startRun(body));
  }

  if (path === "/api/answer") {
    const { answer: value } = await readBody(req);
    if (!resolvePrompt) return json(res, { ok: false, reason: "nothing is waiting on an answer" });
    // A Run answered while paused holds until Resume, so Pause-at-a-gate works.
    await waitWhilePaused();
    if (!resolvePrompt) return json(res, { ok: false, reason: "nothing is waiting on an answer" });
    // The runner's gate language: y run, n skip, s screenshot, q quit.
    answer(typeof value === "string" ? value : "y");
    return json(res, { ok: true });
  }

  if (path === "/api/pause" || path === "/api/resume") {
    return json(res, setPaused(path === "/api/pause"));
  }

  if (path === "/api/stop") {
    if (!child) return json(res, { ok: false, reason: "no run in progress" });
    child.kill();
    return json(res, { ok: true });
  }

  // Runner -> server
  if (path === "/api/prompt") {
    const { question, runId } = await readBody(req);
    if (runId !== state.runId) return json(res, { answer: "y" });
    // Pause holds the next gate: the prompt is not even shown until Resume.
    await waitWhilePaused();
    if (!child) return json(res, { answer: "q" });
    state.pendingQuestion = String(question ?? "Run this step?");
    pushState();
    // A queued prompt (the previous one was never answered) must not deadlock.
    resolvePrompt?.("y");
    const answerValue = await new Promise<string>((resolve) => {
      resolvePrompt = resolve;
    });
    return json(res, { answer: answerValue });
  }

  if (path === "/api/event") {
    const ev = (await readBody(req)) as RemoteEvent & { runId: string };
    if (ev.runId === state.runId) applyEvent(ev);
    return json(res, { ok: true });
  }

  if (path === "/api/log") {
    return json(res, { ok: true });
  }

  if (path === "/api/state") return json(res, state);

  res.writeHead(404, { "access-control-allow-origin": "*" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`[e2e-control] listening on http://localhost:${PORT}`);
  console.log(`[e2e-control] ${FLOWS.length} flows, ${FLOWS.reduce((n, f) => n + f.steps.length, 0)} steps`);
});
