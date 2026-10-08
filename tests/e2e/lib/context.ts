import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Driver } from "./driver.js";
import type { SessionHub } from "./session.js";

/** Everything a test run accumulates, shared across steps and flows. */
export class RunContext {
  /** projectId -> the project's name, so later steps can find it by name. */
  projects: Array<{ id: string; name: string }> = [];
  /** milestone name -> id, per project. */
  milestones: Record<string, Array<{ id: string; name: string; departmentId?: string }>> = {};
  tasks: Record<string, Array<{ id: string; title: string; milestone: string }>> = {};
  subtasks: Record<string, Array<{ id: string; title: string; task: string }>> = {};
  documents: Array<{ name: string; level: string }> = [];
  /** Free-form notes that flows can use to hand values to each other. */
  notes: Record<string, string> = {};

  /** Finds a project created earlier in this run. */
  project(nameOrIndex: string | number = 0): { id: string; name: string } {
    if (typeof nameOrIndex === "number") {
      const p = this.projects[nameOrIndex];
      if (!p) throw new Error(`No project at index ${nameOrIndex}. Created: ${this.projects.map((x) => x.name).join(", ") || "none"}`);
      return p;
    }
    const exact = this.projects.find((p) => p.name === nameOrIndex);
    if (exact) return exact;
    const loose = this.projects.find((p) => p.name.includes(nameOrIndex));
    if (loose) return loose;
    throw new Error(`No project matching "${nameOrIndex}". Created: ${this.projects.map((x) => x.name).join(", ") || "none"}`);
  }

  /** The most recently created project, which is what flows usually mean. */
  latestProject(): { id: string; name: string } {
    return this.project(this.projects.length - 1);
  }

  /** Reads the project id out of the browser URL. */
  projectIdFromUrl(driver: Driver): string {
    const m = driver.page.url().match(/\/projects\/([0-9a-fA-F-]{8,})/);
    if (!m) throw new Error(`Not on a project URL: ${driver.page.url()}`);
    return m[1];
  }
}

/**
 * Handles the "ask the user before continuing" behaviour. In interactive mode
 * it prompts on every step boundary; in auto mode it prints and continues.
 */
export class Reporter {
  constructor(
    private interactive: boolean,
    private readLine: (q: string) => Promise<string>,
    private write: (s: string) => void = console.log,
  ) {}

  /** Prints a step banner. */
  step(title: string) {
    this.write(`\n${"=".repeat(70)}`);
    this.write(`  ${title}`);
    this.write(`${"=".repeat(70)}`);
  }

  info(msg: string) {
    this.write(`  ${msg}`);
  }

  ok(msg: string) {
    this.write(`  [ok] ${msg}`);
  }

  warn(msg: string) {
    this.write(`  [warn] ${msg}`);
  }

  fail(msg: string) {
    this.write(`  [FAIL] ${msg}`);
  }

  /**
   * Asks the user to continue. Returns the answer; in auto mode there is no
   * prompt and it returns immediately with "y".
   */
  async confirm(question: string): Promise<string> {
    if (!this.interactive) return "y";
    return this.readLine(`\n  >> ${question} [Y/n/s(screenshot)/q(uit)] `);
  }

  /**
   * Gate between steps. Handles the extra commands (screenshot, quit) and
   * returns false when the run should stop.
   */
  async gate(question: string, shot: () => Promise<string>): Promise<boolean> {
    const answer = (await this.confirm(question)).trim().toLowerCase();
    if (answer === "q" || answer === "quit") return false;
    if (answer === "s" || answer === "shot") {
      const path = await shot();
      this.info(`screenshot: ${path}`);
      return this.gate(question, shot);
    }
    return answer !== "n" && answer !== "no";
  }

  /** Free-text question used by the interactive flow pickers. */
  async ask(question: string): Promise<string> {
    if (!this.interactive) return "";
    return this.readLine(`  ${question} `);
  }
}

/** Writes a JSON dump of the run context so a later run can reference IDs. */
export function dumpContext(ctx: RunContext, dir: string, name = "run-context.json") {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(ctx, null, 2));
}

export type { SessionHub, Driver };