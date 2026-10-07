import path from "node:path";
import { fileURLToPath } from "node:url";
import { USERS, ROUTES } from "./config.js";
import { launchBrowser, newContext } from "./lib/browser.js";
import { login } from "./lib/auth.js";
import { discoverPage, writeInventory, type PageInventory } from "./lib/discovery.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outputDir = path.join(root, "ui-map");
const runDir = path.join(root, "runs", `discover-${Date.now()}`);

const routeEntries = [
  ["common-login", ROUTES.login],
  ["dashboard", ROUTES.dashboard],
  ["projects", ROUTES.projects],
  ["notifications", ROUTES.notifications],
  ["organization-structure", ROUTES.organizationStructure],
  ["departments", ROUTES.departments],
  ["users", ROUTES.users],
  ["profiles", ROUTES.profiles],
  ["ai", ROUTES.ai],
  ["reports", ROUTES.reports],
  ["reports-view", ROUTES.reportsView],
  ["roles", ROUTES.roles],
  ["activity-logs", ROUTES.activityLogs],
  ["settings", ROUTES.settings],
] as const;

function controlSignature(inventory: PageInventory): Set<string> {
  const signatures = new Set<string>();
  for (const elements of Object.values(inventory.groups)) {
    for (const element of elements) {
      signatures.add(
        [
          element.tag,
          element.role ?? "",
          element.type ?? "",
          element.label ?? "",
          element.placeholder ?? "",
          element.text,
        ].join("|").replace(/\s+/g, " ").trim(),
      );
    }
  }
  return signatures;
}

async function main(): Promise<void> {
  console.log("PMWDS browser UI discovery");
  console.log(`Base URL: ${process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175"}`);
  console.log(`Output:   ${outputDir}`);

  const browser = await launchBrowser(
    process.env.E2E_BROWSER === "headed" ? "headed" : "headless",
  );
  const { context, page, flushNetwork } = await newContext(browser, runDir);
  const inventories = new Map<string, PageInventory>();

  try {
    await page.goto(ROUTES.login, { waitUntil: "domcontentloaded" });
    const loginInventory = await discoverPage(page);
    inventories.set("common-login", loginInventory);
    await writeInventory(outputDir, "common.txt", loginInventory);

    await login(page, USERS.superAdmin);

    for (const [name, route] of routeEntries.slice(1)) {
      console.log(`Discovering ${route}`);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const inventory = await discoverPage(page);
      inventories.set(name, inventory);
      await writeInventory(outputDir, `${name}.txt`, inventory);
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
        const inventory = await discoverPage(projectPage);
        const name = `projects-new-project-step-${step}`;
        inventories.set(name, inventory);
        await writeInventory(outputDir, `${name}.txt`, inventory);

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

    const counts = new Map<string, number>();
    for (const inventory of inventories.values()) {
      for (const signature of controlSignature(inventory)) {
        counts.set(signature, (counts.get(signature) ?? 0) + 1);
      }
    }

    const sharedControls = [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([signature, count]) => `- seen on ${count} discovered pages: ${signature}`);

    await writeInventory(
      outputDir,
      "common-elements.txt",
      {
        title: "Shared PMWDS browser controls",
        url: "multiple discovered routes",
        forms: [],
        groups: {
          "Shared controls": sharedControls.map((text) => ({
            tag: "shared",
            role: null,
            text,
            label: null,
            placeholder: null,
            name: null,
            id: null,
            type: null,
            ariaLabel: null,
            href: null,
            disabled: false,
            group: "Shared controls",
          })),
        },
      },
    );

    console.log(`Discovered ${inventories.size} page/wizard states.`);
    console.log(`Common controls: ${path.join(outputDir, "common-elements.txt")}`);
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
