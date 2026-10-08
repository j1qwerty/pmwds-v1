import type { Driver } from "../lib/driver.js";
import type { RunContext, Reporter } from "../lib/context.js";
import type { SessionHub } from "../lib/session.js";

/** One user-facing step inside a flow. */
export interface Step {
  /** Short id, shown in the menu so it can be picked by name. */
  id: string;
  title: string;
  /** Which user performs it. */
  as: string;
  /** Runs the step. Returns false to stop the flow early. */
  run: (api: FlowApi) => Promise<boolean | void>;
}

export interface Flow {
  id: string;
  title: string;
  description: string;
  /** Users this flow signs in, in order. */
  users: string[];
  steps: Step[];
}

export interface FlowApi {
  hub: SessionHub;
  ctx: RunContext;
  report: Reporter;
  /** Driver for a user, signing them in if needed. */
  as: (userId: string) => Promise<Driver>;
  /** Screenshot the current page of a user. */
  shot: (userId: string, label: string) => Promise<string>;
  /** Ask before the step runs; false means skip it. */
  gate: () => Promise<boolean>;
  /** Prompt for free text in interactive mode. */
  ask: (q: string) => Promise<string>;
}