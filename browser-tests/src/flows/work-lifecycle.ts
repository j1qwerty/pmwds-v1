import { expect, type Page } from "@playwright/test";
import type { FlowState } from "./types.js";
import { StepRunner } from "../lib/step-runner.js";
import {
  clickButton,
  clickTitle,
  fillLabel,
  selectLabel,
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
  await fillLabel(page, /^Name$/, name);
  await fillLabel(page, /^Description$/, `Milestone for ${departmentName}.`);
  await fillLabel(page, /^Due Date$/, "2027-03-31");
  await selectLabel(page, /^Department$/, departmentName);
  await clickButton(page, /^Create$/);
  await waitForToast(page, /milestone created/i).catch(() => {});
}

async function editMilestone(page: Page, oldName: string, newName: string): Promise<void> {
  const card = page.getByText(oldName, { exact: true }).first().locator("xpath=ancestor::*[self::div or self::article][1]");
  await card.getByTitle("Edit milestone").click();
  await fillLabel(page, /^Name$/, newName);
  await clickButton(page, /^Update$/);
  await waitForToast(page, /milestone updated/i).catch(() => {});
}

async function createTask(
  page: Page,
  milestoneName: string,
  taskName: string,
  assignee: string,
): Promise<void> {
  const milestone = page.getByText(milestoneName, { exact: true }).first();
  await milestone.click();
  await clickButton(page, /new task|create first task|add task to this milestone/i);
  await fillLabel(page, /^Title$/, taskName);
  await fillLabel(page, /^Description$/, `Task for ${milestoneName}.`);
  await fillLabel(page, /^Start$/, "2026-11-05");
  await fillLabel(page, /^Due$/, "2027-02-28");
  await fillLabel(page, /^Est\. hours$/i, "24");
  await selectLabel(page, /^Priority$/, "High");
  const assigneeButton = page.getByText(assignee, { exact: true }).last();
  if (await assigneeButton.isVisible().catch(() => false)) await assigneeButton.click();
  await clickButton(page, /create task/i);
  await waitForToast(page, /task created/i).catch(() => {});
}

async function openTask(page: Page, taskName: string): Promise<void> {
  await page.getByText(taskName, { exact: true }).first().click();
  await page.getByRole("heading", { name: new RegExp(taskName) }).waitFor().catch(() => {});
}

async function addSubtask(
  page: Page,
  taskName: string,
  subtaskName: string,
  assignee: string,
): Promise<void> {
  await openTask(page, taskName);
  const add = page.getByRole("button", { name: /add subtask/i }).last();
  await add.click();
  await fillLabel(page, /^Title$/, subtaskName);
  await fillLabel(page, /^Description$/, `Subtask for ${taskName}.`);
  await selectLabel(page, /^Priority$/, "Medium");
  const assigneeButton = page.getByText(assignee, { exact: true }).last();
  if (await assigneeButton.isVisible().catch(() => false)) await assigneeButton.click();
  await clickButton(page, /create subtask/i);
  await waitForToast(page, /subtask created/i).catch(() => {});
}

async function updateSubtask(
  page: Page,
  subtaskName: string,
): Promise<void> {
  await page.getByText(subtaskName, { exact: true }).first().waitFor();
  const row = page.getByText(subtaskName, { exact: true }).first().locator("xpath=ancestor::*[self::div or self::li][1]");
  const slider = row.locator('input[type="range"]').first();
  if (await slider.count()) {
    await slider.fill("65");
  }

  const comment = row.locator('input[placeholder*="comment" i]').first();
  if (await comment.count()) {
    await comment.fill("Browser E2E progress update.");
    await comment.press("Enter");
  }

  const complete = row.getByRole("button").filter({ hasText: "" }).first();
  if (await complete.count()) {
    await complete.click().catch(() => {});
  }
}

export async function adminMilestonesAndTasks(
  page: Page,
  runner: StepRunner,
  state: FlowState,
): Promise<void> {
  await runner.step("Director opens project milestones", async () => {
    await openMilestones(page, state);
    await expect(page.getByRole("heading", { name: /milestones/i })).toBeVisible();
  });

  const departments = [
    ["PWD", "Public Works Department", "PWD Coordination Milestone"],
    ["PWDC", "PWD Civil Division", "Civil Works Milestone"],
    ["PROC", "Procurement & Finance", "Procurement Milestone"],
  ] as const;

  for (const [code, name, milestoneName] of departments) {
    await runner.step(`Director creates ${code} milestone`, async () => {
      await createMilestone(page, milestoneName, name);
      state.milestoneByDepartment[code] = milestoneName;
    });
  }

  await runner.step("Director edits the PWD milestone", async () => {
    const oldName = state.milestoneByDepartment.PWD;
    const newName = "PWD Coordination Milestone Updated";
    await editMilestone(page, oldName, newName);
    state.milestoneByDepartment.PWD = newName;
  });

  const taskSpecs = [
    ["departmentHeadA", "PWDC", "Civil Site Review Task", "Team Member A"],
    ["departmentHeadB", "PWD", "Coordination Review Task", "Team Member B"],
    ["departmentHeadC", "PROC", "Procurement Review Task", "Team Member A"],
  ] as const;

  for (const [, code, taskName, assigneeLabel] of taskSpecs) {
    await runner.step(`Create task: ${taskName}`, async () => {
      await createTask(page, state.milestoneByDepartment[code], taskName, assigneeLabel);
      state.taskByRole[code] = taskName;
    });
  }
}

export async function roleWork(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  role: "departmentHeadA" | "departmentHeadB" | "departmentHeadC",
): Promise<void> {
  const mapping = {
    departmentHeadA: ["PWDC", "Civil Site Review Task", "Team Member A"],
    departmentHeadB: ["PWD", "Coordination Review Task", "Team Member B"],
    departmentHeadC: ["PROC", "Procurement Review Task", "Team Member A"],
  } as const;

  const [code, taskName, member] = mapping[role];

  await runner.step(`${USERS[role].label} verifies scoped task access`, async () => {
    await openMilestones(page, state);
    await expect(page.getByText(state.milestoneByDepartment[code], { exact: true })).toBeVisible();
    await expect(page.getByText(taskName, { exact: true })).toBeVisible();
  });

  await runner.step(`${USERS[role].label} adds a subtask`, async () => {
    const subtaskName = `${taskName} Subtask`;
    await addSubtask(page, taskName, subtaskName, member);
    state.subtaskByRole[role] = subtaskName;
  });

  await runner.step(`${USERS[role].label} edits the task`, async () => {
    await openMilestones(page, state);
    const card = page.getByText(taskName, { exact: true }).first().locator("xpath=ancestor::*[self::div or self::article][1]");
    await card.getByTitle("Edit task").click();
    await fillLabel(page, /^Description$/, "Edited by Department Head in browser E2E.");
    await clickButton(page, /^Update Task$/);
    await waitForToast(page, /task updated/i).catch(() => {});
  });

  if (role === "departmentHeadC") {
    await runner.step("Department Head C deletes its task", async () => {
      await openMilestones(page, state);
      const card = page.getByText(taskName, { exact: true }).first().locator("xpath=ancestor::*[self::div or self::article][1]");
      await card.getByTitle("Delete task").click();
      await clickButton(page, /delete/i);
      await waitForToast(page, /task deleted/i).catch(() => {});
    });
  }
}

export async function teamMemberWork(
  page: Page,
  runner: StepRunner,
  state: FlowState,
  role: "teamMemberA" | "teamMemberB",
): Promise<void> {
  const targetCode = role === "teamMemberA" ? "PWDC" : "PWD";
  const taskName = state.taskByRole[targetCode];
  const subtaskName = state.subtaskByRole[role === "teamMemberA" ? "departmentHeadA" : "departmentHeadB"];

  await runner.step(`${USERS[role].label} opens assigned task`, async () => {
    await openMilestones(page, state);
    await expect(page.getByText(taskName, { exact: true })).toBeVisible();
    await page.getByText(taskName, { exact: true }).first().click();
  });

  await runner.step(`${USERS[role].label} updates subtask progress`, async () => {
    await updateSubtask(page, subtaskName);
  });

  await runner.step(`${USERS[role].label} uploads a task document`, async () => {
    await page.goto(`${ROUTES.projects}/${state.projectId}/documents`, {
      waitUntil: "domcontentloaded",
    });
    await clickButton(page, /upload document/i);
    const file = path.join(process.cwd(), "fixtures", "dummy-task.txt");
    await uploadFirstFile(page, file);
    const level = page.getByLabel(/upload level/i).first();
    if (await level.count()) await level.selectOption("task");
    const selects = page.locator("select");
    const target = selects.filter({ hasText: /Select task/i }).first();
    if (await target.count()) await target.selectOption({ label: taskName });
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
    await expect(page.getByRole("button", { name: /new task|new milestone/i }).first()).toBeHidden();
  });
}
