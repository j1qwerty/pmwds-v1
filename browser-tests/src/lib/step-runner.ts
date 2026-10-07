import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";

export type StepContext = {
  runDir: string;
  stepNo: number;
  userLabel: string;
  interactive: boolean;
};

export type StepAction<T> = (context: StepContext) => Promise<T>;

export class StepRunner {
  private stepNo = 0;
  private page: Page;

  constructor(
    page: Page,
    private readonly runDir: string,
    private readonly interactive: boolean,
    private userLabel = "anonymous",
  ) {
    this.page = page;
  }

  setPage(page: Page): void {
    this.page = page;
  }

  setUserLabel(label: string): void {
    this.userLabel = label;
  }

  async init(): Promise<void> {
    await mkdir(this.runDir, { recursive: true });
    await mkdir(path.join(this.runDir, "screenshots"), { recursive: true });
    await mkdir(path.join(this.runDir, "network"), { recursive: true });
    await writeFile(
      path.join(this.runDir, "run.txt"),
      [
        "PMWDS browser run",
        `Started: ${new Date().toISOString()}`,
        `Interactive: ${this.interactive}`,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  async step<T>(label: string, action: StepAction<T>): Promise<T> {
    this.stepNo += 1;
    const id = String(this.stepNo).padStart(3, "0");
    const safe = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80);

    const before = path.join(
      this.runDir,
      "screenshots",
      `${id}-${safe}-before.png`,
    );
    const after = path.join(
      this.runDir,
      "screenshots",
      `${id}-${safe}-after.png`,
    );

    const started = Date.now();
    this.log(`[STEP ${id}] ${label}`);
    this.log(`        User: ${this.userLabel}`);
    this.log(`        URL before: ${this.page.url()}`);

    await this.waitForPageReady();
    await this.page.screenshot({ path: before, fullPage: true });

    try {
      const result = await action({
        runDir: this.runDir,
        stepNo: this.stepNo,
        userLabel: this.userLabel,
        interactive: this.interactive,
      });

      await this.waitForPageReady();
      await this.page.screenshot({ path: after, fullPage: true });

      const elapsed = Date.now() - started;
      this.log(`        OK in ${elapsed}ms`);
      this.log(`        URL after:  ${this.page.url()}`);
      this.log(`        Before: ${before}`);
      this.log(`        After:  ${after}`);

      if (this.interactive) await this.pause();
      return result;
    } catch (error) {
      const failure = path.join(
        this.runDir,
        "screenshots",
        `${id}-${safe}-failure.png`,
      );
      await this.page.screenshot({ path: failure, fullPage: true }).catch(() => {});
      this.log(
        `        FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.log(`        Failure screenshot: ${failure}`);
      throw error;
    }
  }

  async pause(message = "Press Enter to continue"): Promise<void> {
    process.stdout.write(`\n        ${message}... `);
    await new Promise<void>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", () => resolve());
    });
    process.stdout.write("\n");
  }

  log(message: string): void {
    console.log(message);
  }

  private async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    await this.page
      .waitForFunction(() => document.readyState === "complete")
      .catch(() => {});
    await this.page.waitForTimeout(150);
  }
}
