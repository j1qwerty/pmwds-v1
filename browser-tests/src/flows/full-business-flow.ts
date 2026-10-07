import { expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { StepRunner } from "../lib/step-runner.js";
import { newContext } from "../lib/browser.js";
import { USERS } from "../config.js";
import { newFlowState } from "./types.js";
import { loginAs, createProject, verifyProjectForUser } from "./project-lifecycle.js";
import {
  adminMilestonesAndTasks,
  roleWork,
  teamMemberWork,
  verifyViewer,
} from "./work-lifecycle.js";

export async function runFullBusinessFlow(
  browser: Browser,
  runDir: string,
  interactive = false,
): Promise<void> {
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const projectName = `Browser E2E ${Date.now()}`;
  const state = newFlowState(projectName);

  const resources = await newContext(browser, runDir);
  const { page, context, flushNetwork } = resources;
  const runner = new StepRunner(page, runDir, interactive, USERS.superAdmin.label);
  await runner.init();

  try {
    await loginAs(page, runner, "projectManager");
    await createProject(page, runner, state, rootDir);

    await loginAs(page, runner, "superAdmin");
    await verifyProjectForUser(page, runner, state, "SuperAdmin");

    await loginAs(page, runner, "director");
    await verifyProjectForUser(page, runner, state, "Director");
    await adminMilestonesAndTasks(page, runner, state);

    for (const role of ["departmentHeadA", "departmentHeadB", "departmentHeadC"] as const) {
      await loginAs(page, runner, role);
      await roleWork(page, runner, state, role);
    }

    for (const role of ["teamMemberA", "teamMemberB"] as const) {
      await loginAs(page, runner, role);
      await teamMemberWork(page, runner, state, role);
    }

    await loginAs(page, runner, "chiefEngineer");
    await verifyProjectForUser(page, runner, state, "Chief Engineer");

    await loginAs(page, runner, "viewer");
    await verifyViewer(page, runner, state);

    await loginAs(page, runner, "director");
    await runner.step("Director edits the project", async () => {
      await page.goto(`/projects/${state.projectId}`, { waitUntil: "domcontentloaded" });
      await page.locator('button[title="Edit project"]').click();
      await fillProjectEdit(page, state);
    });

    await runner.step("Director verifies the edited project", async () => {
      await expect(page.getByText("Browser E2E Updated", { exact: false })).toBeVisible();
    });

    await loginAs(page, runner, "superAdmin");
    await runner.step("SuperAdmin deletes the project as final cleanup", async () => {
      await page.goto(`/projects/${state.projectId}`, { waitUntil: "domcontentloaded" });
      await page.locator('button[title="Delete project"]').click();
      await page.getByRole("button", { name: /delete/i }).last().click();
      await expect(page).toHaveURL(/\/projects(\/)?$/);
    });

    await runner.step("SuperAdmin verifies the project is gone", async () => {
      await page.goto("/projects", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(state.projectName, { exact: true })).toHaveCount(0);
    });
  } finally {
    await flushNetwork().catch(() => {});
    await context.close();
  }
}

async function fillProjectEdit(page: Page, state: ReturnType<typeof newFlowState>) {
  await page.getByLabel(/^Name$/).fill("Browser E2E Updated");
  await page.getByLabel(/^Description$/).fill("Updated through the real project edit modal.");
  await page.getByRole("button", { name: /^Save$/ }).click();
}
