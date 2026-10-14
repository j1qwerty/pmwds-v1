import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  e2eControl,
  flowProgress,
  type FlowCatalogueEntry,
  type PanelState,
} from "./devPanelApi";

/**
 * Bottom dev panel that drives the Playwright e2e runner from inside the app.
 *
 * The panel renders only while the e2e control server is reachable - no
 * server, no panel. Visibility:
 *  - It auto-hides while a step is actually executing and comes back when the
 *    runner parks at a gate or finishes, so it never covers the thing you are
 *    meant to be watching. The pin toggles that off.
 *  - Hidden, it leaves a small pill in the corner: click to pin, hover to peek.
 *  - Pause takes effect at the next step boundary - a Playwright step in flight
 *    cannot be suspended mid-click. Pause/Resume stays visible in both auto and
 *    step-by-step runs, including while a gate is waiting.
 *  - Step-by-step gates speak the runner's own language: Back (skip), Run
 *    (forward), Shot, Quit. There is no rewind: executed steps already changed
 *    the app, so Back stops the flow here rather than undoing anything.
 *
 * No icon set on purpose: the shared <Icon> map does not carry the glyphs this
 * panel wants, and a missing name logs an error on every render.
 */

type Online = "unknown" | "online" | "offline";

/** Stand-in so the progress maths never has to null-check. */
const EMPTY_STATE: PanelState = {
  runId: "",
  status: "idle",
  mode: "visible",
  stepGates: true,
  currentFlowId: null,
  currentStepId: null,
  currentAs: null,
  steps: {},
  flows: {},
  pendingQuestion: null,
  runOk: null,
};

export function DevPanel() {
  const [online, setOnline] = useState<Online>("unknown");
  const [flows, setFlows] = useState<FlowCatalogueEntry[]>([]);
  const [state, setState] = useState<PanelState | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [peek, setPeek] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Hooks must live at component scope, never inside a callback.
  const lastRunId = useRef<string>("");

  useEffect(() => {
    void e2eControl.catalogue().then((res) => {
      if (res?.flows) {
        setFlows(res.flows);
        // Default to everything selected so "Run all" is one click.
        setSelected(new Set(res.flows.map((f) => f.id)));
      }
    });
  }, []);

  useEffect(() => {
    const off = e2eControl.subscribe(
      (next) => {
        setOnline("online");
        setState(next);
        // A fresh run should not inherit the previous run's scrollback.
        if (next.runId && next.runId !== lastRunId.current) {
          lastRunId.current = next.runId;
          setLog([]);
        }
      },
      (line) => setLog((prev) => [...prev, line].slice(-200)),
      () => setOnline("online"),
      () => setOnline("offline"),
    );
    return off;
  }, []);

  const status = state?.status ?? "idle";
  const running = status === "running";
  const paused = status === "paused";
  const waiting = Boolean(state?.pendingQuestion);

  const currentFlow = flows.find((f) => f.id === state?.currentFlowId);
  const currentStep = currentFlow?.steps.find((s) => s.id === state?.currentStepId);

  const totals = useMemo(() => {
    const list = flows.filter((f) => selected.has(f.id));
    let done = 0;
    let total = 0;
    for (const f of list) {
      const p = flowProgress(state ?? EMPTY_STATE, f);
      done += p.done;
      total += p.total;
    }
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [flows, selected, state]);

  // A step is "executing" between answering its gate and asking the next one.
  // That is the only window where the panel gets out of the way.
  const stepExecuting = useMemo(() => {
    if (!state) return false;
    return Object.values(state.steps).some((steps) =>
      Object.values(steps).some((s) => s === "running"),
    );
  }, [state]);

  const hidden = !pinned && !peek && !expanded && (stepExecuting || (running && !waiting));

  const start = useCallback(
    (stepGates: boolean) => {
      const chosen = [...selected];
      if (!chosen.length) return;
      void e2eControl.start({ flows: chosen, stepGates, mode: "visible" });
      setPinned(true);
      setLog([]);
    },
    [selected],
  );

  const answer = useCallback((value: "y" | "n" | "s" | "q") => {
    void e2eControl.answer(value);
  }, []);

  const toggleFlow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // The panel only exists while the control server is reachable. No server, no
  // panel - it never shows an "offline" bar. This sits below every hook call
  // so the hook order never changes between renders.
  if (online !== "online") return null;

  // Online is always "online" here (we return null otherwise), so the dot only
  // reflects run status.
  const dot =
    paused
      ? "bg-amber-400"
      : running
        ? "bg-emerald-500 animate-pulse"
        : status === "done"
          ? state?.runOk === false
            ? "bg-red-500"
            : "bg-emerald-500"
          : "bg-slate-400";

  const body = (
    <div className="border-t border-slate-200 px-2 py-2 grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-3">
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <button
            type="button"
            onClick={() => start(true)}
            disabled={!selected.size || running}
            className="rounded-md px-2 h-6 text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            Run step-by-step
          </button>
          <button
            type="button"
            onClick={() => start(false)}
            disabled={!selected.size || running}
            className="rounded-md px-2 h-6 text-[10px] font-semibold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Run auto
          </button>
          {running && (
            <button
              type="button"
              onClick={() => void e2eControl.stop()}
              className="rounded-md px-2 h-6 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            >
              Stop
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {flows.map((f) => {
            const p = flowProgress(state ?? EMPTY_STATE, f);
            const active = state?.currentFlowId === f.id;
            const done = p.total > 0 && p.done === p.total;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFlow(f.id)}
                className={`w-full flex items-center gap-2 rounded-md px-1.5 h-6 text-[10px] text-left transition-colors ${
                  active ? "bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`size-3 shrink-0 rounded-[3px] border grid place-items-center text-[8px] leading-none ${
                    selected.has(f.id)
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {selected.has(f.id) ? "✓" : ""}
                </span>
                <span className="font-mono text-slate-400 w-3 shrink-0">{f.index}</span>
                <span className="truncate flex-1 text-slate-600">{f.id}</span>
                <span className="font-mono text-slate-400 shrink-0">
                  {p.done}/{p.total}
                </span>
                <span
                  className={`size-1.5 rounded-full shrink-0 ${
                    done
                      ? "bg-emerald-500"
                      : p.current === "running"
                        ? "bg-indigo-500"
                        : "bg-slate-200"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <pre className="m-0 max-h-40 overflow-auto rounded-md bg-slate-900 text-slate-200 p-2 text-[10px] leading-relaxed whitespace-pre-wrap">
        {log.length ? log.slice(-80).join("\n") : "runner output appears here"}
      </pre>
    </div>
  );

  const head = (
    <div className="flex items-center gap-2 px-2 h-8 text-[11px] font-medium text-slate-600 select-none">
      <span className={`size-2 rounded-full shrink-0 ${dot}`} />
      <span className="font-mono text-slate-500 shrink-0">e2e</span>

      <span className="truncate min-w-0 flex-1">
        {status === "idle" ? (
          <span className="text-slate-400">idle - pick flows and run</span>
        ) : (
          <>
            <span className="text-slate-500">
              {currentFlow ? `${currentFlow.index}/${flows.length} ${currentFlow.id}` : "..."}
            </span>
            {currentStep && (
              <span className="text-slate-700">
                {" · "}
                {currentStep.index}. {currentStep.title}
              </span>
            )}
            {state?.currentAs && <span className="text-slate-400"> @{state.currentAs}</span>}
            {paused && <span className="text-amber-600"> · paused</span>}
          </>
        )}
      </span>

      <span className="hidden sm:flex items-center gap-1.5 shrink-0">
        <span className="h-1 w-24 rounded-full bg-slate-200 overflow-hidden">
          <span
            className="block h-full bg-emerald-500 transition-all"
            style={{ width: `${totals.pct}%` }}
          />
        </span>
        <span className="font-mono text-slate-400">
          {totals.done}/{totals.total}
        </span>
      </span>

      {waiting && (
        <span className="flex items-center gap-1 shrink-0">
          <GateBtn onClick={() => answer("n")} title="Back: skip this step (executed steps cannot be rewound, so this stops the flow here)">
            ◀ Back
          </GateBtn>
          <GateBtn tone="go" onClick={() => answer("y")} title="Forward: run this step and advance (y)">
            Run ▶
          </GateBtn>
          <GateBtn onClick={() => answer("s")} title="Screenshot then ask again (s)">
            Shot
          </GateBtn>
          <GateBtn tone="stop" onClick={() => answer("q")} title="Quit the run (q)">
            Quit
          </GateBtn>
        </span>
      )}

      {(running || paused) && (
        <button
          type="button"
          onClick={() => void (paused ? e2eControl.resume() : e2eControl.pause())}
          className="shrink-0 rounded-md px-2 h-6 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
          title={paused ? "Resume: let the run continue" : "Pause: the run holds at the next step boundary"}
        >
          {paused ? "Resume" : "Pause"}
        </button>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="shrink-0 size-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 grid place-items-center text-[11px] leading-none"
        title={expanded ? "Collapse" : "Expand"}
      >
        {expanded ? "▾" : "▴"}
      </button>
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        className={`shrink-0 size-6 rounded-md grid place-items-center text-[10px] leading-none font-bold ${
          pinned ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100"
        }`}
        title={pinned ? "Unpin (auto-hide resumes)" : "Always show"}
      >
        •
      </button>
    </div>
  );

  if (hidden) {
    return (
      <div className="fixed bottom-3 right-3 z-[80]">
        <button
          type="button"
          onMouseEnter={() => setPeek(true)}
          onMouseLeave={() => setPeek(false)}
          onClick={() => setPinned(true)}
          title="e2e dev panel - click to pin open"
          className="flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full bg-slate-900/90 text-white text-[10px] font-semibold shadow-lg hover:bg-slate-900"
        >
          <span className={`size-1.5 rounded-full ${dot}`} />
          e2e
          {currentStep && <span className="text-slate-400 truncate max-w-40">{currentStep.title}</span>}
          <span className="font-mono text-slate-400">
            {totals.done}/{totals.total}
          </span>
        </button>
        {peek && (
          <div className="absolute bottom-9 right-0 w-[26rem] rounded-lg bg-white border border-slate-200 shadow-xl p-0 overflow-hidden">
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[80] bg-white/97 backdrop-blur border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      {head}
      {expanded && body}
    </div>
  );
}

function GateBtn({
  children,
  onClick,
  title,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "go" | "stop";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-md px-2 h-6 text-[10px] font-semibold border ${
        tone === "go"
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : tone === "stop"
            ? "bg-white text-red-600 border-red-200 hover:bg-red-50"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
