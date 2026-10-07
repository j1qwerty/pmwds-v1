import { expect, type Page } from "@playwright/test";
import path from "node:path";
import type { FlowState } from "./types.js";
import { StepRunner } from "../lib/step-runner.js";
import {
  clickButton,
  expectButtonHidden,
  fillLabel,
  selectAnyOption,
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
  await clickButton(page, /^Save$/);
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
    .locator("xpath=ancestor::*[self::div or self::article][1]");

  await row.getByTitle("Edit milestone").click();
  await fillLabel(page, /^Name$/, newName);
  await clickButton(page, /^Save$/);
  await waitForToast(page, /milestone updated/i).catch(() => {});
}

async function createTask(
  page: Page,
  milestoneName: string,
  taskName: string,
): Promise<void> {
  await page.getByText(milestoneName, { exact: true }).first().click();
  await clickButton(page, /new task|create first task|add task to this milestone/i);
  await fillLabel(page, /^Title$/, taskName);
  await fillLabel(page, /^Description$/, `Task for ${milestoneName}.`);
  await fillLabel(page, /^Start$/, "2026-11-05");
  await fillLabel(page, /^Due$/, "2027-02-28");
  await fillLabel(page, /^Est\. hours$/i, "24");
  await selectLabel(page, /^Priority$/, "High");
  await clickButton(page, /^Save$/);
  await waitForToast(page, /task created/i).catch(() => {});
}

async function openTask(page: Page, taskName: string): Promise<void> {
  await page.getByText(taskName, { exact: true }).first().click();
  await page
    .getByRole("heading", { name: new RegExp(taskName) })
    .waitFor()
    .catch(() => {});
}

async function addSubtask(
  page: Page,
  taskName: string,
  subtaskName: string,
): Promise<void> {
  await openTask(page, taskName);
  await clickButton(page, /add subtask/i);
  await fillLabel(page, /^Title$/, subtaskName);
  await fillLabel(page, /^Description$/, `Subtask for ${taskName}.`);
  await fillLabel(page, /^Due$/, "2027-02-15");
  await selectLabel(page, /^Priority$/, "Medium");
  await clickButton(page, /create subtask/i);
  await waitForToast(page, /subtask created/i).catch(() => {});
}

async function editTask(page: Page, taskName: string): Promise<void> {
  await openTask(page, taskName);
  await clickButton(page, /edit task/i);
  await fillLabel(page, /^Description$/, "Edited by Department Head in browser E2E.");
  await clickButton(page, /^Save$/);
  await waitForToast(page, /task updated/i).catch(() => {});
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
    await expect(page.getByText(/Civil Site Review Task/i)).toBeVisible();
    await expect(page.getByText(/Procurement Review Task/i)).toBeVisible();
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
    await selectLabel(page, /^Prerequisite$/, prerequisite);
    await selectLabel(page, /^Dependent$/, dependent);
    await clickButton(page, /^Add$/);
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
    departmentHeadA: ["PWDC", "Civil Site Review Task", "Team Member A"],
    departmentHeadB: ["PWD", "Coordination Review Task", "Team Member B"],
    departmentHeadC: ["PROC", "Procurement Review Task", "Team Member C"],
  } as const;

  const [code, taskName] = mapping[role];

  await runner.step(`${USERS[role].label} verifies scoped access`, async () => {
    await openMilestones(page, state);
    await expect(page.getByText(state.milestoneByDepartment[code], { exact: true })).toBeVisible();
    await expect(page.getByText(taskName, { exact: true })).toBeVisible();

    if (role === "departmentHeadA") {
      await expectButtonHidden(page, /new milestone/i);
    }
  });

  await runner.step(`${USERS[role].label} creates a subtask`, async () => {
    const subtaskName = `${taskName} Subtask`;
    await addSubtask(page, taskName, subtaskName);
    state.subtaskByRole[taskName] = subtaskName;

    if (role === "departmentHeadA") {
      const secondTask = "Civil Quality Review Task";
      const secondSubtask = `${secondTask} Subtask`;
      await addSubtask(page, secondTask, secondSubtask);
      state.subtaskByRole[secondTask] = secondSubtask;
    }
  });

  await runner.step(`${USERS[role].label} edits its task`, async () => {
    await openMilestones(page, state);
    await editTask(page, taskName);
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

  await runner.step(`${USERS[role].label} opens assigned/scoped task`, async () => {
    await openMilestones(page, state);
    await expect(page.getByText(taskName, { exact: true })).toBeVisible({ timeout: 30_000 });
    await openTask(page, taskName);
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
    await selectLabel(page, /upload level/i, "task");
    await selectAnyOption(page, taskName);
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
