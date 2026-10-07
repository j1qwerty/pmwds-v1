import { test } from "@playwright/test";
import path from "node:path";
import { runFullBusinessFlow } from "../flows/full-business-flow.js";

test(
  "complete seeded-role business lifecycle",
  async ({ browser }, testInfo) => {
    test.setTimeout(30 * 60 * 1000);

    const runDir = path.resolve(
      process.cwd(),
      "runs",
      `playwright-${testInfo.workerIndex}-${Date.now()}`,
    );

    await runFullBusinessFlow(browser, runDir, false);
  },
);
