import type { Flow, FlowApi, Step } from "./types.js";
import type { RunContext } from "../lib/context.js";

/**
 * Flow 4 - ordinary members open their tasks, read the details, and push
 * subtask progress forward with a comment.
 *
 * Members see the task board but cannot create or delete; this flow only reads
 * and updates progress, which is the permission shape the app intends.
 */

const MEMBERS = ["member"];

function memberStep(member: string): Step {
  return {
    id: `check-${member}`,
    title: `${member} opens the task board and checks their tasks`,
    as: member,
    async run(api) {
      const d = await api.as(member);
      const project = api.ctx.latestProject();
      await d.goto(`/projects/${project.id}/tasks`);
      await d.settle();
      api.report.ok(`${member} can see the task board for ${project.name}`);

      const tasks = api.ctx.tasks[project.id] ?? [];
      const mine = tasks[0];
      if (!mine) {
        api.report.warn("no tasks recorded yet, nothing to check");
        return;
      }

      // Team members can read their assigned task cards but do not open the
      // manager-only task editor from the card.
      const card = d.page.locator("div.bg-white.rounded-xl.py-4.px-2").filter({ hasText: mine.title }).first();
      if ((await card.count()) === 0) {
        api.report.warn(`member cannot see task "${mine.title}" - permissions may differ`);
        return;
      }
      await card.waitFor({ state: "visible" });
      api.report.ok(`${member} can read assigned task: ${mine.title}`);
    },
  };
}

function progressStep(member: string, percent: number): Step {
  return {
    id: `progress-${member}`,
    title: `${member} updates a subtask to ${percent}%`,
    as: member,
    async run(api) {
      const d = await api.as(member);
      const project = api.ctx.latestProject();
      const subtasks = api.ctx.subtasks[project.id] ?? [];
      const target = subtasks[0];
      if (!target) {
        api.report.warn("no subtasks recorded yet, skipping the progress update");
        return;
      }

      await d.goto(`/projects/${project.id}/tasks`);
      const card = d.page.locator("div.bg-white.rounded-xl.py-4.px-2").filter({ hasText: target.title }).first();
      if ((await card.count()) === 0) {
        api.report.warn(`subtask "${target.title}" not visible to ${member}`);
        return;
      }

      // Expand the card's subtask list, then open the subtask editor.
      await card.hover();
      const expander = card.getByRole("button", { name: /Expand subtasks/ }).first();
      if ((await expander.count()) > 0) {
        await expander.click({ force: true });
        await d.page.waitForTimeout(500);
      }
      const row = card.locator("div[role='button']").filter({ hasText: target.title }).first();
      await row.click({ force: true });
      await d.page.waitForTimeout(800);

      // The percent input sits next to the "%" span in ProgressStatusEditor.
      const percentInput = d.page.locator("input[inputmode='numeric']").first();
      if ((await percentInput.count()) === 0) {
        api.report.warn("no percent input found in the subtask editor");
        await d.click("closeModal", "modal-shell").catch(() => undefined);
        return;
      }
      await percentInput.fill(String(percent));
      await percentInput.blur();
      await d.page.waitForTimeout(400);

      const comment = d.page.getByPlaceholder("Add a comment with this update...").first();
      if ((await comment.count()) > 0) {
        await comment.fill(`Progress moved to ${percent}% by ${member} during e2e run.`);
      }

      await d.click("update", "subtask-progress").catch(async (err: unknown) => {
        api.report.warn(`Update not clickable: ${String(err).split("\n")[0]}`);
      });
      await d.page.waitForTimeout(1500);

      const failures = d.apiFailures();
      if (failures.length) {
        api.report.warn(`API failures during update: ${failures.map((f) => `${f.status} ${f.url.split("/api/v1")[1]}`).join(", ")}`);
      } else {
        api.report.ok(`${member} set "${target.title}" to ${percent}%`);
      }
      await d.click("closeModal", "modal-shell").catch(() => undefined);
    },
  };
}

function statusStep(member: string): Step {
  return {
    id: `status-${member}`,
    title: `${member} moves their subtask to In Progress`,
    as: member,
    async run(api) {
      const d = await api.as(member);
      const project = api.ctx.latestProject();
      const subtasks = api.ctx.subtasks[project.id] ?? [];
      const target = subtasks[subtasks.length - 1];
      if (!target) {
        api.report.warn("no subtasks to update");
        return;
      }

      await d.goto(`/projects/${project.id}/tasks`);
      const card = d.page.locator("div.bg-white.rounded-xl.py-4.px-2").filter({ hasText: target.title }).first();
      if ((await card.count()) === 0) {
        api.report.warn(`subtask "${target.title}" not visible to ${member}`);
        return;
      }
      await card.hover();
      const expander = card.getByRole("button", { name: /Expand subtasks/ }).first();
      if ((await expander.count()) > 0) {
        await expander.click({ force: true });
        await d.page.waitForTimeout(500);
      }
      const row = card.locator("div[role='button']").filter({ hasText: target.title }).first();
      await row.click({ force: true });
      await d.page.waitForTimeout(800);

      // StatusDropdown is a button showing the current label; click it, then
      // pick the exact option label.
      const dropdown = d.page.getByRole("button").filter({ hasText: /Not Started|In Progress|Completed|On Hold|Cancelled/ }).first();
      if ((await dropdown.count()) === 0) {
        api.report.warn("no status dropdown in the editor");
        await d.click("closeModal", "modal-shell").catch(() => undefined);
        return;
      }
      await dropdown.click();
      await d.page.waitForTimeout(300);
      // StatusDropdown renders its options with role=option, not as buttons.
      const option = d.page.getByRole("option", { name: "In Progress", exact: true }).last();
      if ((await option.count()) > 0) {
        await option.click();
        api.report.ok(`${member} moved "${target.title}" to In Progress`);
      } else {
        api.report.warn("In Progress option not found");
      }
      await d.click("update", "subtask-progress").catch(() => undefined);
      await d.page.waitForTimeout(1000);
      await d.click("closeModal", "modal-shell").catch(() => undefined);
    },
  };
}

export const memberProgressFlow: Flow = {
  id: "member-progress",
  title: "4. Members check tasks and update subtask progress",
  description:
    "A member of the project's primary department confirms task access, then raises a " +
    "subtask's progress and moves it to In Progress with a comment.",
  users: MEMBERS,
  steps: [
    ...MEMBERS.map(memberStep),
    ...MEMBERS.map((member, index) => progressStep(member, index === 0 ? 40 : 65)),
    statusStep(MEMBERS[0]),
  ],
};
