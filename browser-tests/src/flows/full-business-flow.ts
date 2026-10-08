import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { newContext } from "../lib/browser.js";
import { StepRunner } from "../lib/step-runner.js";
import { USERS, ROUTES, type TestUserId } from "../config.js";
import { createProject, loginAs, verifyProjectForUser } from "./project-lifecycle.js";
import type { FlowState } from "./types.js";
import {
  adminMilestonesAndTasks,
  createMilestoneDependency,
  roleWork,
  teamMemberWork,
  verifyViewer,
} from "./work-lifecycle.js";
import { fillLabel } from "../lib/ui-actions.js";

type ActiveSession = {
  context: BrowserContext;
  page: Page;
  flushNetwork: () => Promise<string>;
};

async function openUserSession(
  browser: Browser,
  runDir: string,
  runner: StepRunner,
  user: TestUserId,
): Promise<ActiveSession> {
  const userDir = path.join(
    runDir,
    "users",
    user,
  );
  const resources = await newContext(browser, userDir);
  runner.setPage(resources.page);
  await loginAs(resources.page, runner, user);
  return {
    context: resources.context,
    page: resources.page,
    flushNetwork: resources.flushNetwork,
  };
}

async function closeUserSession(session: ActiveSession): Promise<void> {
  await session.flushNetwork().catch(() => {});
  await session.context.close();
}

export async function runFullBusinessFlow(
  browser: Browser,
  runDir: string,
  interactive = false,
): Promise<FlowState> {
  const projectName = `Browser E2E ${Date.now()}`;
  const state = {
    projectName,
    projectId: "",
    milestoneByDepartment: {},
    taskByRole: {},
    subtaskByRole: {},
  } satisfies FlowState;

  const bootstrap = await newContext(browser, path.join(runDir, "users", "bootstrap"));
  const runner = new StepRunner(
    bootstrap.page,
    runDir,
    interactive,
    USERS.projectManager.label,
  );
  await runner.init();
  await closeUserSession(bootstrap);

  let session: ActiveSession | null = null;
  const use = async (user: TestUserId): Promise<Page> => {
    if (session) await closeUserSession(session);
    session = await openUserSession(browser, runDir, runner, user);
    return session.page;
  };

  try {
    const projectManager = await use("projectManager");
    await createProject(projectManager, runner, state, process.cwd());

    const superAdmin = await use("superAdmin");
    await verifyProjectForUser(superAdmin, runner, state, "SuperAdmin");

    const director = await use("director");
    await verifyProjectForUser(director, runner, state, "Director");
    await adminMilestonesAndTasks(director, runner, state);
    await createMilestoneDependency(director, runner, state);

    for (const role of [
      "departmentHeadA",
      "departmentHeadB",
      "departmentHeadC",
    ] as const) {
      const page = await use(role);
      await roleWork(page, runner, state, role);
    }

    for (const role of [
      "teamMemberA",
      "teamMemberB",
      "teamMemberC",
    ] as const) {
      const page = await use(role);
      await teamMemberWork(page, runner, state, role);
    }

    const chiefEngineer = await use("chiefEngineer");
    await verifyProjectForUser(
      chiefEngineer,
      runner,
      state,
      "Chief Engineer / Project Manager",
    );

    const viewer = await use("viewer");
    await verifyViewer(viewer, runner, state);

    const headC = await use("departmentHeadC");
    await runner.step("Department Head C deletes its task", async () => {
      await headC.goto(
        `${ROUTES.projects}/${state.projectId}/milestones`,
        { waitUntil: "domcontentloaded" },
      );
      const taskName = "Procurement Review Task";
      await headC.getByText(taskName, { exact: true }).first().click();
      await headC.locator('button[title="Delete task"]').last().click();
      await headC.getByRole("button", { name: /delete permanently/i }).last().click();
      await expect(headC.getByText(taskName, { exact: true })).toHaveCount(0);
    });

    const manager = await use("projectManager");
    await runner.step("Project Manager edits the project", async () => {
      await manager.goto(`${ROUTES.projects}/${state.projectId}`, {
        waitUntil: "domcontentloaded",
      });
      await manager.locator('button[title="Edit project"]').click();
      await fillLabel(manager, /description/, "Updated by Project Manager in browser E2E.");
      await manager.getByRole("button", { name: /^Save$/ }).click();
      await expect(manager.getByText("Updated by Project Manager in browser E2E.", { exact: true })).toBeVisible();
    });

    const admin = await use("director");
    await runner.step("Director edits the project", async () => {
      await admin.goto(`${ROUTES.projects}/${state.projectId}`, {
        waitUntil: "domcontentloaded",
      });
      await admin.locator('button[title="Edit project"]').click();
      await fillLabel(admin, /name/, "Browser E2E Updated");
      await fillLabel(
        admin,
        /description/,
        "Updated through the real project edit modal.",
      );
      await admin.getByRole("button", { name: /^Save$/ }).click();
      await expect(admin.getByText("Browser E2E Updated", { exact: true })).toBeVisible();
    });

    const finalAdmin = await use("superAdmin");
    await runner.step("SuperAdmin performs final project deletion", async () => {
      await finalAdmin.goto(`${ROUTES.projects}/${state.projectId}`, {
        waitUntil: "domcontentloaded",
      });
      await finalAdmin.locator('button[title="Delete project"]').click();
      await finalAdmin.getByRole("button", { name: /delete permanently/i }).last().click();
      await finalAdmin.waitForURL(/\/projects(\/)?$/, { timeout: 60_000 });
    });

    await runner.step("SuperAdmin verifies the project disappeared", async () => {
      await finalAdmin.goto(ROUTES.projects, { waitUntil: "domcontentloaded" });
      await expect(
        finalAdmin.getByText(projectName, { exact: true }),
      ).toHaveCount(0);
    });

    return state;
  } finally {
    if (session) await closeUserSession(session);
  }
}
