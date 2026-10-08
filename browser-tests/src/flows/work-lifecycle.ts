import { expect, type Page } from "@playwright/test";
import path from "node:path";
import type { FlowState } from "./types.js";
import { StepRunner } from "../lib/step-runner.js";
import {
  clickButton,
  escapeRegExp,
  expectButtonHidden,
  fillLabel,
  selectLabel,
  selectOptionByPrefix,
  uploadFirstFile,
  waitForToast,
} from "../lib/ui-actions.js";
import { ROUTES, USERS } from "../config.js";

async function openMilestones(page: Page, state: FlowState): Promise<void> {
  await page.goto(`${ROUTES.projects}/${state.projectId}/milestones`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function createMilestone(
  page: Page,
  name: string,
  departmentName: string,
): Promise<void> {
  await clickButton(page, /new milestone/i);
  await fillLabel(page, /name/, name);
  await fillLabel(page, /description/, `Milestone for ${departmentName}.`);
  await fillLabel(page, /due date/, "2027-03-31");
  await selectLabel(page, /department/, departmentName);
  await clickButton(page, /^Create milestone$/);
  await waitForToast(page, /milestone created/i).catch(() => {});
}

async function editMilestone(
  page: Page,
  oldName: string,
  newName: string,
): Promise<void> {
  const row = page
    .getByText(oldName, { exact: true })
    .first()
    // Nearest ancestor that actually contains the edit control.
    //
    // "Nearest div ancestor" is not good enough here: the milestone name sits in a
    // title row inside the card, so the closest div is that title row, which has no
    // buttons in it and never matches. Anchoring on the ancestor that owns an
    // "Edit milestone" button selects the card itself, whatever the markup nesting is.
    .locator('xpath=ancestor::*[.//button[@title="Edit milestone"]][1]');

  await row.getByTitle("Edit milestone").click();
  await fillLabel(page, /name/, newName);
  await clickButton(page, /^Save changes$/);
  await waitForToast(page, /milestone updated/i).catch(() => {});
}

async function createTask(
  page: Page,
  milestoneName: string,
  taskName: string,
): Promise<void> {
  await page.getByText(milestoneName, { exact: true }).first().click();
  await clickButton(page, /new task|create first task|add task to this milestone/i);
  await fillLabel(page, /title/, taskName);
  await fillLabel(page, /description/, `Task for ${milestoneName}.`);
  await fillLabel(page, /start date/, "2026-11-05");
  await fillLabel(page, /due date/, "2027-02-28");
  await selectLabel(page, /priority/, "High");
  await clickButton(page, /^Create task$/);
  await waitForToast(page, /task created/i).catch(() => {});
}

async function openTask(page: Page, taskName: string, milestoneName?: string): Promise<void> {
  // Tasks render under the selected milestone only, so select it first.
  if (milestoneName) {
    await page.getByText(milestoneName, { exact: true }).first().click();
  }
  await page.getByText(taskName, { exact: true }).first().click();
  await page
    .getByRole("heading", { name: new RegExp(escapeRegExp(taskName)) })
    .waitFor()
    .catch(() => {});
}

/**
 * Expand the modal's Subtasks section if it is collapsed.
 *
 * The section starts collapsed, and reopening the task modal resets it, so
 * every subtask step must ensure it is open before touching subtask controls.
 */
async function ensureSubtasksSectionOpen(page: Page): Promise<void> {
  const addToggle = page.getByRole("button", { name: /^Add subtask$/ });
  if (await addToggle.isVisible().catch(() => false)) return;
  await clickButton(page, /^Subtasks/);
  await expect(addToggle).toBeVisible();
}

/**
 * client2 creates subtasks through an inline form inside the task details
 * modal (title + due date only, no Description/Priority), submitted with an
 * "Add" button - not a "New subtask" sheet.
 */
async function addSubtask(
  page: Page,
  taskName: string,
  milestoneName: string,
  subtaskName: string,
): Promise<void> {
  await openTask(page, taskName, milestoneName);
  await ensureSubtasksSectionOpen(page);
  await clickButton(page, /^Add subtask$/);
  const titleField = page.getByPlaceholder(/subtask title/i);
  await titleField.fill(subtaskName);
  const formScope = titleField.locator(
    'xpath=ancestor::div[.//button[normalize-space(.)="Add"]][1]',
  );
  await formScope.locator('input[type="date"]').fill("2027-02-15");
  await formScope.getByRole("button", { name: /^Add$/ }).click();
  await waitForToast(page, /subtask created/i).catch(() => {});
  await expect(page.getByText(subtaskName, { exact: true }).first()).toBeVisible();
}

async function editTask(page: Page, taskName: string, milestoneName: string): Promise<void> {
  await openTask(page, taskName, milestoneName);
  await page.locator('button[title="Edit task"]').last().click();
  await fillLabel(page, /description/, "Edited by Department Head in browser E2E.");
  await clickButton(page, /^Save changes$/);
  await waitForToast(page, /task updated/i).catch(() => {});
}

async function updateSubtask(page: Page, subtaskName: string): Promise<void> {
  await ensureSubtasksSectionOpen(page);
  const title = page.getByText(subtaskName, { exact: true }).first();
  const item = title.locator(
    "xpath=ancestor::div[contains(@class, 'border-slate-100')][1]",
  );

  await title.click();

  const slider = item.locator('input[type="range"]').first();
  await slider.waitFor({ state: "visible" });
  await slider.fill("65");

  const comment = item.locator('input[placeholder*="comment" i]').first();
  await comment.fill("Browser E2E progress update.");
  await comment.press("Enter");

  await expect(item).toContainText("65");
}

export async function adminMilestonesAndTasks(
  page: Page,
  runner: StepRunner,
  state: FlowState,
): Promise<void> {
  await runner.step("Director opens project milestones", async () => {
    await openMilestones(page, state);
    // Readiness is checked on the milestone filter field, not on a heading. This page
    // renders its title as a tab button rather than a heading element, so a
    // getByRole("heading", /milestones/) assertion never matched anything. The
    // filter field is present for every role that can reach the route, which makes
    // it a role-independent "the panel actually rendered" signal.
    await expect(page.getByPlaceholder(/filter milestones/i)).toBeVisible();
  });

  // The PWD milestone already exists - the project wizard requires at least
  // one milestone with a department, so it was created inline there. The
  // Director adds the remaining two here through the milestone sheet.
  const departments = [
    ["PWDC", "PWD Civil Division", "Civil Works Milestone"],
    ["PROC", "Procurement & Finance", "Procurement Milestone"],
  ] as const;

  for (const [code, name, milestoneName] of departments) {
    await runner.step(`Director creates ${code} milestone`, async () => {
      await createMilestone(page, milestoneName, name);
      state.milestoneByDepartment[code] = milestoneName;
    });
  }

  await runner.step("Director edits the wizard-created PWD milestone", async () => {
    const oldName = state.milestoneByDepartment.PWD;
    const newName = "PWD Coordination Milestone Updated";
    await editMilestone(page, oldName, newName);
    state.milestoneByDepartment.PWD = newName;
  });

  const tasks = [
    ["PWDC", "Civil Site Review Task"],
    ["PWDC", "Civil Quality Review Task"],
    ["PWD", "Coordination Review Task"],
    ["PROC", "Procurement Review Task"],
  ] as const;

  for (const [code, taskName] of tasks) {
    await runner.step(`Director creates task: ${taskName}`, async () => {
      await createTask(page, state.milestoneByDepartment[code], taskName);
      state.taskByRole[taskName] = code;
    });
  }

  await runner.step("Director verifies task and milestone counts", async () => {
    // Assert on the Tasks tab. The milestone cards show a task count, not task
    // names, so a task name is only ever rendered on the task list.
    await page.goto(`${ROUTES.projects}/${state.projectId}/tasks`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(/Civil Site Review Task/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Procurement Review Task/i).first()).toBeVisible({ timeout: 30_000 });
  });
}


export async function createMilestoneDependency(
  page: Page,
  runner: StepRunner,
  state: FlowState,
): Promise<void> {
  const prerequisite = state.milestoneByDepartment.PWD;
  const dependent = state.milestoneByDepartment.PWDC;

  await runner.step("Create a milestone dependency", async () => {
    await page.goto(`${ROUTES.projects}/${state.projectId}/dependencies`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await clickButton(page, /^New$/);
    await selectLabel(page, /prerequisite/, prerequisite);
    await selectLabel(page, /dependent/, dependent);
    await clickButton(page, /^Add dependency$/);
    await waitForToast(page, /dependency created/i).catch(() => {});
    await expect(page.getByText(prerequisite, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(dependent, { exact: true }).last()).toBeVisible();
  });
}

export async function roleWork(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  role: "departmentHeadA" | "departmentHeadB" | "departmentHeadC",
): Promise<void> {
  const mapping = {
    departmentHeadA: ["PWDC", "Civil Site Review Task"],
    departmentHeadB: ["PWD", "Coordination Review Task"],
    departmentHeadC: ["PROC", "Procurement Review Task"],
  } as const;

  const [code, taskName] = mapping[role];
  const milestoneName = state.milestoneByDepartment[code];

  await runner.step(`${USERS[role].label} verifies scoped access`, async () => {
    await openMilestones(page, state);
    // Tasks render under the selected milestone only - the page defaults to
    // the first milestone, so select ours before asserting.
    await page.getByText(milestoneName, { exact: true }).first().click();
    await expect(page.getByText(milestoneName, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(taskName, { exact: true })).toBeVisible();

    if (role === "departmentHeadA") {
      await expectButtonHidden(page, /new milestone/i);
    }
  });

  await runner.step(`${USERS[role].label} creates a subtask`, async () => {
    const subtaskName = `${taskName} Subtask`;
    await addSubtask(page, taskName, milestoneName, subtaskName);
    state.subtaskByRole[taskName] = subtaskName;

    if (role === "departmentHeadA") {
      const secondTask = "Civil Quality Review Task";
      const secondSubtask = `${secondTask} Subtask`;
      await addSubtask(page, secondTask, milestoneName, secondSubtask);
      state.subtaskByRole[secondTask] = secondSubtask;
    }
  });

  await runner.step(`${USERS[role].label} edits its task`, async () => {
    await openMilestones(page, state);
    await editTask(page, taskName, milestoneName);
  });

}

export async function teamMemberWork(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  role: "teamMemberA" | "teamMemberB" | "teamMemberC",
): Promise<void> {
  const taskName =
    role === "teamMemberA"
      ? "Civil Site Review Task"
      : role === "teamMemberB"
        ? "Civil Quality Review Task"
        : "Procurement Review Task";

  const subtaskName = state.subtaskByRole[taskName];
  const milestoneName = state.milestoneByDepartment[state.taskByRole[taskName]];

  await runner.step(`${USERS[role].label} opens assigned/scoped task`, async () => {
    await openMilestones(page, state);
    await page.getByText(milestoneName, { exact: true }).first().click();
    await expect(page.getByText(taskName, { exact: true })).toBeVisible({ timeout: 30_000 });
    await openTask(page, taskName, milestoneName);
  });

  await runner.step(`${USERS[role].label} updates subtask progress`, async () => {
    await updateSubtask(page, subtaskName);
  });

  await runner.step(`${USERS[role].label} uploads a task document`, async () => {
    await page.goto(`${ROUTES.projects}/${state.projectId}/documents`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: /upload document/i }).click();
    const file = path.join(process.cwd(), "fixtures", "dummy-task.txt");
    await uploadFirstFile(page, file);
    await selectLabel(page, /document level/i, "task");
    // Task options render as "Title · Milestone · Project", so select by prefix.
    await selectOptionByPrefix(page, taskName);
    await clickButton(page, /^Upload$/);
    await waitForToast(page, /uploaded|document/i).catch(() => {});
  });
}

export async function verifyViewer(
  page: Page,
  runner: StepRunner,
  state: FlowState,
): Promise<void> {
  await runner.step("Viewer verifies the project without write controls", async () => {
    await openMilestones(page, state);
    await expect(page.getByText(state.projectName, { exact: true }).first()).toBeVisible();
    await expectButtonHidden(page, /new task/i);
    await expectButtonHidden(page, /new milestone/i);
  });
}
