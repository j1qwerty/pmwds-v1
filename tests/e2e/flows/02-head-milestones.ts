import type { Flow, FlowApi, Step } from "./types.js";
import type { Plan } from "./data.js";
import type { RunContext } from "../lib/context.js";

/**
 * Flow 2 - each department head assigned in wizard step 3 adds their own
 * milestone to the same project.
 *
 * The two heads come from the plan's department codes so the milestone is
 * created by the department that actually owns it.
 */

// Only the department head of the project's primary department can manage
// milestones. The wizard assigns the first milestone to PWDC, so head-civil is
// the authorized head for this additional-milestone check. head-pmo still owns
// the PWD milestone created in flow 1 and participates in task flows.
const HEADS = ["head-civil"];

function plan(ctx: RunContext): Plan {
  if (!ctx.notes.plan) throw new Error("Flow 1 must run first: no project plan on the context.");
  return JSON.parse(ctx.notes.plan) as Plan;
}

/** Milestone name this head will create, e.g. "<head label> Package <stamp>". */
function milestoneName(ctx: RunContext, head: string): string {
  const key = `ms_${head}`;
  if (ctx.notes[key]) return ctx.notes[key];
  const name = `${head} Package ${plan(ctx).projectName.split(" ").pop()}`;
  ctx.notes[key] = name;
  return name;
}

function dueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString().slice(0, 10);
}

function makeStep(head: string): Step {
  return {
    id: `head-${head}`,
    title: `${head} creates its own milestone on the project`,
    as: head,
    async run(api) {
      const d = await api.as(head);
      const project = api.ctx.latestProject();
      const name = milestoneName(api.ctx, head);

      await d.goto(`/projects/${project.id}/milestones`);
      await d.click("newMilestone", "shell-actions");
      await d.page.waitForTimeout(500);

      await d.fill("name", name, "milestone-form", { nth: "0,1" });
      await d.fill("description", `Deliverables owned by ${head}.`, "milestone-form", { nth: "0,1" });
      await d.fill("dueDate", dueDate(), "milestone-form", { nth: "0,1" });

      // The Department select is scoped to what this head may assign. Leave the
      // default (their own department) unless the modal offers an explicit one.
      // The milestone is created by Save; wait for the POST so we know it stuck
      // rather than trusting the toast (toasts auto-dismiss after 3s).
      await d
        .clickAndWait("save", "milestone-form", "createMilestone", { nth: "0,1" })
        .catch(async (err: unknown) => {
          api.report.warn(`save failed: ${String(err).split("\n")[0]}`);
        });
      await d.page.waitForTimeout(1500);
      const list = api.ctx.milestones[project.id] ?? (api.ctx.milestones[project.id] = []);
      list.push({ id: "", name, departmentId: head });
      api.report.ok(`${head} created milestone "${name}"`);
    },
  };
}

export const deptHeadMilestonesFlow: Flow = {
  id: "head-milestones",
  title: "2. Department heads create their own milestones",
  description:
    "The head of the project's primary department signs in and adds a milestone " +
    "belonging to their own department on the same project.",
  users: HEADS,
  steps: HEADS.map(makeStep),
};
