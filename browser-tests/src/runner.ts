import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { launchBrowser, newContext, type BrowserMode } from "./lib/browser.js";
import { runFullBusinessFlow } from "./flows/full-business-flow.js";
import { createProject, loginAs } from "./flows/project-lifecycle.js";
import { newFlowState } from "./flows/types.js";
import { StepRunner } from "./lib/step-runner.js";
import { discoverPage, writeInventory } from "./lib/discovery.js";
import { ROUTES, USERS, type TestUserId } from "./config.js";

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function chooseBrowserMode(): Promise<BrowserMode> {
  console.log("");
  console.log("Browser mode");
  console.log("  1. Headless Chromium (default)");
  console.log("  2. Visible Chromium");
  const choice = await prompt("Choice [1]: ");
  return choice === "2" ? "headed" : "headless";
}

async function chooseFlow(): Promise<string> {
  console.log("");
  console.log("Flows");
  console.log("  1. Full seeded-role business lifecycle");
  console.log("  2. Manual user-assisted browser session");
  console.log("  3. Exit");
  return prompt("Select flow [1]: ");
}

function userEntries(): Array<[TestUserId, (typeof USERS)[TestUserId]]> {
  return Object.entries(USERS) as Array<[TestUserId, (typeof USERS)[TestUserId]]>;
}

async function chooseUser(): Promise<TestUserId> {
  console.log("");
  console.log("Login user");
  const entries = userEntries();
  entries.forEach(([id, user], index) => {
    console.log(
      `  ${index + 1}. ${user.label} | ${user.email} | ${user.role}`,
    );
  });

  const answer = await prompt("User [3 = Project Manager]: ");
  const index = answer ? Number(answer) - 1 : 2;
  return entries[index]?.[0] ?? "projectManager";
}

async function chooseRoute(): Promise<string> {
  const entries = Object.entries(ROUTES);
  console.log("");
  console.log("Open route");
  entries.forEach(([name, route], index) => {
    console.log(`  ${index + 1}. ${name} -> ${route}`);
  });

  const answer = await prompt("Route [3 = projects]: ");
  const index = answer ? Number(answer) - 1 : 2;
  return entries[index]?.[1] ?? ROUTES.projects;
}

async function createManualSession(
  mode: BrowserMode,
  runDir: string,
  runner: StepRunner | null,
  user: TestUserId,
): Promise<{
  context: BrowserContext;
  page: Page;
  runner: StepRunner;
  flushNetwork: () => Promise<string>;
}> {
  const resources = await newContext(
    await launchBrowser(mode),
    path.join(runDir, "manual", user),
  );
  const nextRunner =
    runner ??
    new StepRunner(resources.page, runDir, true, USERS[user].label);
  nextRunner.setPage(resources.page);
  nextRunner.setUserLabel(USERS[user].label);
  await loginAs(resources.page, nextRunner, user);

  return {
    context: resources.context,
    page: resources.page,
    runner: nextRunner,
    flushNetwork: resources.flushNetwork,
  };
}

async function runManualSession(
  browserMode: BrowserMode,
  runDir: string,
): Promise<void> {
  console.log("");
  console.log("Manual user-assisted session");
  console.log("Choose the user first. Every selected action is a logical step.");
  console.log("Each step waits for Enter before the next action.");

  let currentUser = await chooseUser();
  let resources = await newContext(
    await launchBrowser(browserMode),
    path.join(runDir, "manual", currentUser),
  );
  const runner = new StepRunner(resources.page, runDir, true, USERS[currentUser].label);
  await runner.init();
  runner.setUserLabel(USERS[currentUser].label);
  await loginAs(resources.page, runner, currentUser);

  const state = newFlowState(`Interactive E2E ${Date.now()}`);

  try {
    while (true) {
      console.log("");
      console.log(`Current user: ${USERS[currentUser].label}`);
      console.log(`Current URL:  ${resources.page.url()}`);
      console.log("");
      console.log("Next action");
      console.log("  1. Create project wizard");
      console.log("  2. Open a common route");
      console.log("  3. Discover current page UI");
      console.log("  4. Switch user");
      console.log("  5. Run full business lifecycle");
      console.log("  6. Exit");

      const action = await prompt("Action [1]: ");

      if (action === "1" || action === "") {
        if (currentUser !== "projectManager") {
          console.log("Project creation is configured for the seeded Project Manager flow.");
          continue;
        }
        await createProject(resources.page, runner, state, process.cwd());
        console.log(`Created project: ${state.projectName} (${state.projectId})`);
        continue;
      }

      if (action === "2") {
        const route = await chooseRoute();
        await runner.step(`Open route ${route}`, async () => {
          await resources.page.goto(route, { waitUntil: "domcontentloaded" });
          await resources.page.waitForLoadState("networkidle").catch(() => {});
        });
        continue;
      }

      if (action === "3") {
        await runner.step("Discover controls on the current page", async () => {
          const inventory = await discoverPage(resources.page);
          const destination = await writeInventory(
            path.join(runDir, "manual", "ui"),
            `page-${runnerStepId(runner)}.txt`,
            inventory,
          );
          console.log(`        UI inventory: ${destination}`);
        });
        continue;
      }

      if (action === "4") {
        const nextUser = await chooseUser();
        await resources.flushNetwork().catch(() => {});
        await resources.context.close();

        resources = await newContext(
          await launchBrowser(browserMode),
          path.join(runDir, "manual", nextUser),
        );
        currentUser = nextUser;
        runner.setPage(resources.page);
        runner.setUserLabel(USERS[currentUser].label);
        await loginAs(resources.page, runner, currentUser);
        continue;
      }

      if (action === "5") {
        await resources.flushNetwork().catch(() => {});
        await resources.context.close();
        await runFullBusinessFlow(
          await launchBrowser(browserMode),
          path.join(runDir, "full-business"),
          true,
        );
        return;
      }

      if (action === "6") return;
    }
  } finally {
    await resources.flushNetwork().catch(() => {});
    await resources.context.close();
  }
}

function runnerStepId(runner: StepRunner): string {
  return `step-${Date.now()}`;
}

async function runFullFlow(
  mode: BrowserMode,
  interactive: boolean,
): Promise<void> {
  const runDir = path.resolve(
    process.cwd(),
    "runs",
    `${timestamp()}-full-business`,
  );

  console.log("");
  console.log(`Run directory: ${runDir}`);
  console.log(
    `Browser: ${mode === "headed" ? "VISIBLE Chromium" : "headless Chromium"}`,
  );
  console.log(
    `Runner: ${interactive ? "interactive, pause after every logical step" : "automatic"}`,
  );
  console.log("");

  const browser = await launchBrowser(mode);
  try {
    await runFullBusinessFlow(browser, runDir, interactive);
    console.log("");
    console.log("FULL BUSINESS FLOW PASSED");
    console.log(`Artifacts: ${runDir}`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log("PMWDS browser test runner");
  console.log("=========================");

  const cliMode = process.argv[2] === "automatic" ? "automatic" : "interactive";
  const browserMode = await chooseBrowserMode();

  console.log("");
  console.log("Run mode");
  console.log("  1. Interactive / user-assisted");
  console.log("  2. Automatic");
  const defaultChoice = cliMode === "automatic" ? "2" : "1";
  const runChoice = await prompt(`Choice [${defaultChoice}]: `) || defaultChoice;
  const interactive = runChoice !== "2";

  if (interactive) {
    const flow = await chooseFlow();
    if (flow === "1") await runFullFlow(browserMode, true);
    if (flow === "2") {
      const runDir = path.resolve(
        process.cwd(),
        "runs",
        `${timestamp()}-manual`,
      );
      console.log(`Run directory: ${runDir}`);
      await runManualSession(browserMode, runDir);
    }
    return;
  }

  const selection = await prompt("Flows to run, comma separated [1]: ");
  const selections = selection
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const shouldRunFull =
    selections.length === 0 || selections.includes("1");

  if (shouldRunFull) await runFullFlow(browserMode, false);
}

void main().catch((error) => {
  console.error("");
  console.error("BROWSER TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
