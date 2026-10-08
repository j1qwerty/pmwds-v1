import type { Flow, FlowApi, Step } from "./types.js";
import type { Plan } from "./data.js";
import type { RunContext } from "../lib/context.js";

/**
 * Flow 3 - a department head creates assigned project tasks; the PM adds subtasks.
 */

// The project created in flow 1 has PWDC as its primary department. The app
// grants task management to that department's head, so this flow exercises
// task and subtask creation through head-civil.
const HEADS = ["head-civil"];

function plan(ctx: RunContext): Plan {
  if (!ctx.notes.plan) throw new Error("Flow 1 must run first: no project plan on the context.");
  return JSON.parse(ctx.notes.plan) as Plan;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function taskTitle(ctx: RunContext, head: string, i: number): string {
  return `Task ${head}-${i + 1} ${plan(ctx).projectName.split(" ").pop()}`;
}

function subtaskTitle(head: string, i: number, j: number): string {
  return `Subtask ${head}-${i + 1}.${j + 1}`;
}

function makeTaskStep(head: string): Step {
  return {
    id: `tasks-${head}`,
    title: `${head} creates two assigned tasks`,
    as: head,
    async run(api) {
      const d = await api.as(head);
      const project = api.ctx.latestProject();
      const milestone = milestoneFor(api.ctx, project.id, head);

      await d.goto(`/projects/${project.id}/tasks`);

      for (let i = 0; i < 2; i++) {
        const title = taskTitle(api.ctx, head, i);
        await d.click("newTask", "shell-actions");
        await d.fill("title", title, "task-form");
        await d.fill("description", `Task created by ${head} during e2e run.`, "task-form");
        await d.fill("start", today(), "task-form");
        await d.fill("due", inDays(14 + i * 7), "task-form");
        await d.fill("estimatedHours", "16", "task-form");
        await d.select("priority", i === 0 ? "High" : "Medium", "task-form");

        // Milestone assignment is manager-only in the task form. Heads can
        // still create assigned project tasks, which this flow verifies.

        // Keep the created tasks visible to the member-progress flow. This
        // creator's primary department is PWDC, which includes the seeded
        // member account.
        const assigneeSearch = d.page.getByPlaceholder("Search users...").first();
        if (await assigneeSearch.count()) {
          for (const name of ["Ananya Patel", "Rohan Iyer"]) {
            await assigneeSearch.fill(name);
            await d.page.locator("div.max-h-56 button").filter({ hasText: name }).first().click();
          }
        }

        await d.clickAndWait("save", "task-form", "createTask", { nth: "0,1" });

        const list = (api.ctx.tasks[project.id] ??= []);
        list.push({ id: "", title, milestone: "" });
        api.report.ok(`${head} created task "${title}"`);
      }
    },
  };
}

function makeSubtaskStep(head: string): Step {
  return {
    id: `subtasks-${head}`,
    title: `Project manager adds subtasks to ${head}'s task`,
    as: "pm",
    async run(api) {
      const d = await api.as("pm");
      const project = api.ctx.latestProject();
      const tasks = api.ctx.tasks[project.id] ?? [];
      const task = tasks.find((t) => t.title.startsWith(`Task ${head}-1`)) ?? tasks[0];
      if (!task) {
        api.report.warn("no task to add subtasks to, skipping");
        return;
      }

      // Open the task's New Subtask modal and add two subtasks.
      await d.goto(`/projects/${project.id}/tasks`);
      const card = d.page.locator("div.bg-white.rounded-xl.py-4.px-2").filter({ hasText: task.title }).first();
      if ((await card.count()) === 0) {
        api.report.warn(`task card not found for "${task.title}"`);
        return;
      }
      await card.hover();

      for (let j = 0; j < 2; j++) {
        const title = subtaskTitle(head, 0, j);
        await card.hover();
        const addBtn = d.page.getByTitle("Add subtask").first();
        if ((await addBtn.count()) === 0) {
          api.report.warn("no Add subtask button visible");
          break;
        }
        await addBtn.click({ force: true });
        await d.page.waitForTimeout(500);
        await d.fill("title", title, "subtask-form");
        const subtaskAssigneeSearch = d.page.getByPlaceholder("Search users...").last();
        if (await subtaskAssigneeSearch.count()) {
          await subtaskAssigneeSearch.fill("Ananya Patel");
          await d.page.locator("div.max-h-56 button").filter({ hasText: "Ananya Patel" }).first().click();
        }
        await d.clickAndWait("createSubtask", "subtask-form", "createSubtask");

        const list = (api.ctx.subtasks[project.id] ??= []);
        list.push({ id: "", title, task: task.title });
        api.report.ok(`${head} created subtask "${title}"`);
      }
    },
  };
}

/** The milestone this head created in flow 2, if it exists. */
function milestoneFor(ctx: RunContext, projectId: string, head: string) {
  const list = ctx.milestones[projectId] ?? [];
  return list.find((m) => m.departmentId === head) ?? list[list.length - 1];
}

export const tasksAndSubtasksFlow: Flow = {
  id: "tasks-subtasks",
  title: "3. Department heads create tasks and subtasks",
  description:
    "The primary department head creates two assigned project tasks. The project manager " +
    "then adds subtasks to the first task so the assigned member can update their progress.",
  users: HEADS,
  steps: [...HEADS.map(makeTaskStep), ...HEADS.map(makeSubtaskStep)],
};
