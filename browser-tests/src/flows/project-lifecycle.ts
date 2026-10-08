import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { USERS, ROUTES } from "../config.js";
import type { FlowState } from "./types.js";
import { StepRunner } from "../lib/step-runner.js";
import {
  clickButton,
  clickCreateProjectWizard,
  clickNextWizard,
  fillLabel,
  fillPlaceholder,
  openProjectByName,
  projectCard,
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
    await fillLabel(page, /budget/i, "12.5");
    await fillLabel(page, /^Start Date/i, "2026-11-01");
    await fillLabel(page, /^End Date/i, "2027-06-30");
    const fileInputs = page.locator('input[type="file"]');
    if (await fileInputs.count()) await fileInputs.first().setInputFiles(file);
  });

  // client2's wizard runs details -> milestones -> assign departments ->
  // dependencies and finishes with "Create project". It requires at least one
  // milestone with a department, so the PWD milestone is created inline here;
  // the Director adds the PWDC and PROC milestones afterwards on the
  // milestones page.
  await runner.step("Add the PWD milestone in the wizard", async () => {
    await clickNextWizard(page);
    await expect(
      page.getByText(/at least one milestone is required/i).first(),
    ).toBeVisible();
    await addWizardMilestone(
      page,
      "PWD Coordination Milestone",
      "Milestone for Public Works Department.",
      "2027-03-31",
    );
    state.milestoneByDepartment.PWD = "PWD Coordination Milestone";
  });

  await runner.step("Assign the PWD milestone to Public Works Department", async () => {
    await clickNextWizard(page);
    await expect(
      page.getByText(/every milestone must be assigned/i).first(),
    ).toBeVisible();
    await selectLabel(page, /department/, "Public Works Department");
  });

  await runner.step("Finish project creation", async () => {
    await clickNextWizard(page);
    await expect(
      page.getByText(/dependencies are optional/i).first(),
    ).toBeVisible();
    await clickCreateProjectWizard(page);
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

/**
 * Add one milestone through the client2 wizard's Milestones step.
 *
 * The step shows a dashed "Add milestone" trigger which swaps for the inline
 * form (Milestone name / Due date / "What marks this milestone?"); saving
 * swaps back to the trigger, so the same button name is clicked twice.
 */
async function addWizardMilestone(
  page: Page,
  name: string,
  description: string,
  dueDate: string,
): Promise<void> {
  await clickButton(page, /^Add milestone$/);
  await fillPlaceholder(page, /milestone name/i, name);
  await fillLabel(page, /due date/i, dueDate);
  await fillPlaceholder(page, /what marks this milestone/i, description);
  await clickButton(page, /^Add milestone$/);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

export async function verifyProjectForUser(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  label: string,
): Promise<void> {
  await runner.step(`${label}: verify project visibility`, async () => {
    await page.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
    const card = await projectCard(page, state.projectName);
    await expect(card).toBeVisible({ timeout: 30_000 });
  });
}
