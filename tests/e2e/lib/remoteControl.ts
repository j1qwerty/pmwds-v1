/**
 * Remote control channel for the dev panel.
 *
 * The runner's interactivity already funnels through one function: `Reporter`
 * takes a `readLine(question) => Promise<string>`. In a terminal that reads
 * stdin. When the client dev panel drives the run instead, this class fills the
 * same slot — it POSTs the prompt to the control server and blocks until the
 * panel answers.
 *
 * That means the panel speaks the runner's own gate language (y / n / s / q)
 * rather than a second, parallel protocol that could drift.
 */

export interface RemoteOptions {
  /** Control server base, e.g. http://localhost:5180 */
  baseUrl: string;
  /** Id assigned by the server for this run; echoed back on every message. */
  runId: string;
}

/** One line of runner output, forwarded to the panel's log pane. */
export type RemoteLog = { runId: string; line: string; seq: number };

export class RemoteControl {
  private logSeq = 0;

  constructor(private opts: RemoteOptions) {}

  private async getState(): Promise<{ status?: string } | null> {
    try {
      const res = await fetch(`${this.opts.baseUrl}/api/state`);
      if (!res.ok) return null;
      return (await res.json()) as { status?: string };
    } catch {
      return null;
    }
  }

  /**
   * Asks one gate question and waits for the panel's answer.
   *
   * Pause is honoured server-side: a prompt that arrives while paused waits
   * before it is shown, and an answer given while paused waits before it is
   * delivered. A step already executing is never suspended mid-click.
   */
  async ask(question: string): Promise<string> {
    const res = await fetch(`${this.opts.baseUrl}/api/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: this.opts.runId, question }),
    });
    if (!res.ok) {
      // Control server gone - do not wedge the run on a panel that disappeared.
      return "y";
    }
    const body = (await res.json()) as { answer?: string };
    return body.answer ?? "y";
  }

  /** Mirrors a line of console output into the panel's log pane. */
  push(line: string): void {
    const payload: RemoteLog = { runId: this.opts.runId, line, seq: this.logSeq++ };
    // Fire and forget: the panel is a convenience, never a dependency.
    void fetch(`${this.opts.baseUrl}/api/log`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }

  /** Announces lifecycle transitions so the panel can drive its auto-hide. */
  async emit(event: RemoteEvent): Promise<void> {
    await fetch(`${this.opts.baseUrl}/api/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: this.opts.runId, ...event }),
    }).catch(() => undefined);
  }

  /**
   * Paces the run between steps: honours Pause (holds here until resumed) and
   * then waits a beat so a visible demo is watchable instead of a blur.
   *
   * Called after every step, including auto mode where there are no gates.
   * Delay comes from E2E_STEP_DELAY_MS (default 1200ms); control server gone
   * means no pacing rather than a wedged run.
   */
  async pace(): Promise<void> {
    const delayMs = Number(process.env.E2E_STEP_DELAY_MS ?? 1200);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 240; i++) {
      const st = await this.getState();
      if (!st) return;
      if (st.status !== "paused") break;
      await sleep(500);
    }
    if (Number.isFinite(delayMs) && delayMs > 0) await sleep(delayMs);
  }
}

export type RemoteEvent =
  | { type: "run-start"; mode: string; flows: string[] }
  | { type: "flow-start"; flowId: string; index: number; total: number }
  | { type: "flow-end"; flowId: string }
  | { type: "step-start"; flowId: string; stepId: string; index: number; total: number; as: string }
  | { type: "step-end"; flowId: string; stepId: string; status: "ok" | "failed" | "skipped" }
  | { type: "run-end"; ok: boolean };
