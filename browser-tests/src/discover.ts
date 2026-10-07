import path from "node:path";
import { fileURLToPath } from "node:url";
import { USERS, ROUTES } from "./config.js";
import { launchBrowser, newContext } from "./lib/browser.js";
import { login } from "./lib/auth.js";
import { discoverPage, writeInventory } from "./lib/discovery.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outputDir = path.join(root, "ui-map");
const runDir = path.join(root, "runs", `discover-${Date.now()}`);

const routeEntries = [
  ["common-login", ROUTES.login],
  ["dashboard", ROUTES.dashboard],
  ["projects", ROUTES.projects],
  ["departments", ROUTES.departments],
  ["users", ROUTES.users],
  ["roles", ROUTES.roles],
  ["reports", ROUTES.reports],
  ["activity-logs", ROUTES.activityLogs],
  ["settings", ROUTES.settings],
] as const;

async function main(): Promise<void> {
  console.log("PMWDS browser UI discovery");
  console.log(`Base URL: ${process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175"}`);
  console.log(`Output:   ${outputDir}`);

  const browser = await launchBrowser(
    process.env.E2E_BROWSER === "headed" ? "headed" : "headless",
  );
  const { context, page, flushNetwork } = await newContext(browser, runDir);

  try {
    await page.goto(ROUTES.login, { waitUntil: "domcontentloaded" });
    await writeInventory(
      outputDir,
      "common.txt",
      await discoverPage(page),
    );

    await login(page, USERS.superAdmin);

    for (const [name, route] of routeEntries.slice(1)) {
      console.log(`Discovering ${route}`);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await writeInventory(
        outputDir,
        `${name}.txt`,
        await discoverPage(page),
      );
    }

    const projectPage = page;
    await projectPage.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
    await projectPage.waitForLoadState("networkidle").catch(() => {});

    const newProject = projectPage.getByRole("button", { name: /new project/i });
    if (await newProject.isVisible().catch(() => false)) {
      console.log("Opening New Project wizard for non-destructive discovery");
      await newProject.click();
      await projectPage
        .locator('[role="dialog"], dialog')
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .catch(() => {});

      for (let step = 1; step <= 8; step += 1) {
        await writeInventory(
          outputDir,
          `projects-new-project-step-${step}.txt`,
          await discoverPage(projectPage),
        );

        const next = projectPage
          .getByRole("button", { name: /^(next|continue)$/i })
          .last();

        if (!(await next.isVisible().catch(() => false))) break;
        if (!(await next.isEnabled().catch(() => false))) break;

        await next.click();
        await projectPage.waitForTimeout(150);
      }

      const cancel = projectPage.getByRole("button", { name: /cancel|close/i }).last();
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => {});
      }
    }
  } finally {
    await flushNetwork().catch(() => {});
    await context.close();
    await browser.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
