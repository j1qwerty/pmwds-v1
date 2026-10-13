/**
 * Client for the e2e control server that backs the bottom dev panel.
 *
 * The panel never drives the browser itself - the Playwright runner does. This
 * module only starts/stops runs, answers the runner's gate questions, and
 * streams progress. Every call is best-effort: if the control server is not
 * running the panel degrades to "offline" rather than breaking the app.
 */

export type StepState = "pending" | "running" | "ok" | "failed" | "skipped";

export type FlowCatalogueEntry = {
  id: string;
  index: number;
  title: string;
  description: string;
  users: string[];
  steps: { id: string; index: number; title: string; as: string }[];
};

export type PanelState = {
  runId: string;
  status: "idle" | "running" | "paused" | "done";
  mode: string;
  stepGates: boolean;
  currentFlowId: string | null;
  currentStepId: string | null;
  currentAs: string | null;
  steps: Record<string, Record<string, StepState>>;
  flows: Record<string, "ok" | "failed">;
  pendingQuestion: string | null;
  runOk: boolean | null;
};

/** Where the control server lives. Override with VITE_E2E_CONTROL_URL. */
const BASE = (import.meta.env?.VITE_E2E_CONTROL_URL as string | undefined) ?? "http://localhost:5180";

async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const e2eControl = {
  base: BASE,

  catalogue: () => get<{ flows: FlowCatalogueEntry[] }>("/api/flows"),

  state: () => get<PanelState>("/api/state"),

  start: (opts: { flows?: string[]; stepGates?: boolean; mode?: string }) =>
    post<{ started: boolean; reason?: string; runId?: string }>("/api/run", opts),

  /** The runner's own gate language, so the panel needs no second protocol. */
  answer: (value: "y" | "n" | "s" | "q") => post<{ ok: boolean }>("/api/answer", { answer: value }),

  pause: () => post<{ ok: boolean; status?: string }>("/api/pause"),

  resume: () => post<{ ok: boolean; status?: string }>("/api/resume"),

  stop: () => post<{ ok: boolean }>("/api/stop"),

  /**
   * Subscribes to state + log pushes. Returns an unsubscribe function.
   *
   * EventSource reconnects on its own, so a server restart re-syncs the panel
   * from the snapshot each new connection sends.
   */
  subscribe(
    onState: (state: PanelState) => void,
    onLog: (line: string) => void,
    onOpen: () => void,
    onError: () => void,
  ): () => void {
    const source = new EventSource(`${BASE}/api/events`);
    source.addEventListener("state", (e) => {
      onOpen();
      try {
        onState(JSON.parse((e as MessageEvent).data));
      } catch {
        /* malformed frame - wait for the next one */
      }
    });
    source.addEventListener("log", (e) => {
      try {
        onLog(String(JSON.parse((e as MessageEvent).data)));
      } catch {
        onLog(String((e as MessageEvent).data));
      }
    });
    source.onerror = () => onError();
    return () => source.close();
  },
};

/** Counts for the progress readout. */
export function flowProgress(
  state: PanelState,
  flow: FlowCatalogueEntry,
): { done: number; total: number; current: StepState | undefined } {
  const stepStates = state.steps[flow.id] ?? {};
  const total = flow.steps.length;
  const done = flow.steps.filter((s) => {
    const v = stepStates[s.id];
    return v === "ok" || v === "skipped";
  }).length;
  const current = state.currentFlowId === flow.id && state.currentStepId
    ? stepStates[state.currentStepId]
    : undefined;
  return { done, total, current };
}
