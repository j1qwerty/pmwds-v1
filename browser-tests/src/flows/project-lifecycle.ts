import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { USERS, ROUTES } from "../config.js";
import type { FlowState } from "./types.js";
import { StepRunner } from "../lib/step-runner.js";
import {
  clickDepartmentRow,
  clickFinishWizard,
  clickNextWizard,
  fillLabel,
  fillPlaceholder,
  openProjectByName,
  selectLabel,
  waitForToast,
} from "../lib/ui-actions.js";
import { login } from "../lib/auth.js";

export async function loginAs(
  page: Page,
  runner: StepRunner,
  user: keyof typeof USERS,
): Promise<void> {
  runner.setUserLabel(USERS[user].label);
  await runner.step(`Login as ${USERS[user].label}`, async () => {
    await login(page, USERS[user]);
    await expect(page).not.toHaveURL(/\/login$/);
  });
}

export async function createProject(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  rootDir: string,
): Promise<void> {
  const file = path.join(rootDir, "fixtures", "dummy-project.txt");

  await runner.step("Open Projects and start New Project", async () => {
    await page.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByRole("heading", { name: /project details/i }).waitFor();
  });

  await runner.step("Fill project details", async () => {
    await fillPlaceholder(page, /enter project name/i, state.projectName);
    await fillPlaceholder(page, /brief description/i, "Browser E2E lifecycle project.");
    await selectLabel(page, /^Priority$/, "High");
    await page.getByLabel(/budget/i).first().fill("12.5");
    await page.getByLabel(/^Start Date/i).fill("2026-11-01");
    await page.getByLabel(/^End Date/i).fill("2027-06-30");
    const fileInputs = page.locator('input[type="file"]');
    if (await fileInputs.count()) await fileInputs.first().setInputFiles(file);
  });

  await runner.step("Select PWD and PWD Civil departments", async () => {
    await clickNextWizard(page);
    await clickDepartmentRow(page, "Public Works Department");
    await clickDepartmentRow(page, "PWD Civil Division");
  });

  await runner.step("Review project users", async () => {
    await clickNextWizard(page);
    await expect(page.getByText(/Public Works Department/i).first()).toBeVisible();
    await expect(page.getByText(/PWD Civil Division/i).first()).toBeVisible();
    await clickNextWizard(page);
  });

  await runner.step("Review empty milestone plan", async () => {
    await expect(page.getByRole("heading", { name: /milestones/i })).toBeVisible();
    await clickNextWizard(page);
  });

  await runner.step("Review empty dependencies", async () => {
    await expect(page.getByRole("heading", { name: /dependencies/i })).toBeVisible();
    await clickNextWizard(page);
  });

  await runner.step("Review empty initial tasks", async () => {
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
  });

  await runner.step("Finish project creation", async () => {
    await clickFinishWizard(page);
    state.projectId = page.url().match(/\/projects\/([0-9a-f-]+)/i)?.[1] ?? "";
    if (!state.projectId) throw new Error(`Project id missing after creation: ${page.url()}`);
    await waitForToast(page, /created|project/i).catch(() => {});
    await expect(page.getByText(state.projectName, { exact: true }).first()).toBeVisible();
  });

  await runner.step("Verify the new project is visible to the project manager", async () => {
    await page.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
    await openProjectByName(page, state.projectName);
    await expect(page).toHaveURL(new RegExp(`/projects/${state.projectId}`));
  });
}

export async function verifyProjectForUser(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  label: string,
): Promise<void> {
  await runner.step(`${label}: verify project visibility`, async () => {
    await page.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(state.projectName, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
}
