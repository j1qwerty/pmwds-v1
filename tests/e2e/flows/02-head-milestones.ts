import type { Flow, FlowApi, Step } from "./types.js";
import type { Plan } from "./data.js";
import type { RunContext } from "../lib/context.js";

/**
 * Flow 2 - the Director adds a milestone for a third department.
 *
 * client2 only grants milestone management to SuperAdmin and Director
 * (ProjectMilestonesPage.canManageMilestones), so department heads cannot use
 * the "New milestone" action. The Director creates the Procurement milestone
 * here instead; the heads participate in the later task flows on the
 * milestones the wizard assigned to their departments.
 */

const DIRECTOR = "admin";
const DEPARTMENT_LABEL = "Procurement & Finance";
const DEPARTMENT_OWNER = "head-ops";

function plan(ctx: RunContext): Plan {
  if (!ctx.notes.plan) throw new Error("Flow 1 must run first: no project plan on the context.");
  return JSON.parse(ctx.notes.plan) as Plan;
}

/** Milestone name the Director will create, e.g. "Procurement Package <stamp>". */
function milestoneName(ctx: RunContext): string {
  const key = "ms_procurement";
  if (ctx.notes[key]) return ctx.notes[key];
  const name = `Procurement Package ${plan(ctx).projectName.split(" ").pop()}`;
  ctx.notes[key] = name;
  return name;
}

function dueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString().slice(0, 10);
}

const directorMilestone: Step = {
  id: "director-procurement-milestone",
  title: "Director creates the Procurement milestone on the project",
  as: DIRECTOR,
  async run(api) {
    const d = await api.as(DIRECTOR);
    const project = api.ctx.latestProject();
    const name = milestoneName(api.ctx);

    await d.goto(`/projects/${project.id}/milestones`);
    await d.click("newMilestone", "shell-actions");
    await d.page.waitForTimeout(500);

    await d.fill("name", name, "milestone-form");
    await d.fill("description", "Deliverables owned by Procurement.", "milestone-form");
    await d.fill("dueDate", dueDate(), "milestone-form");
    await d.select("department", DEPARTMENT_LABEL, "milestone-form").catch((err: unknown) => {
      api.report.warn(`department select skipped: ${String(err).split("\n")[0]}`);
    });

    // The milestone is created by the sheet's Create action; wait for the
    // POST so we know it stuck rather than trusting the toast (toasts
    // auto-dismiss after 3s).
    await d
      .clickAndWait("save", "milestone-form", "createMilestone")
      .catch(async (err: unknown) => {
        api.report.warn(`save failed: ${String(err).split("\n")[0]}`);
      });
    await d.page.waitForTimeout(1500);
    const list = api.ctx.milestones[project.id] ?? (api.ctx.milestones[project.id] = []);
    list.push({ id: "", name, departmentId: DEPARTMENT_OWNER });
    api.report.ok(`${DIRECTOR} created milestone "${name}" for ${DEPARTMENT_LABEL}`);
  },
};

export const deptHeadMilestonesFlow: Flow = {
  id: "head-milestones",
  title: "2. Director creates the Procurement milestone",
  description:
    "The Director signs in and adds a milestone belonging to Procurement on the " +
    "same project, so later flows span three departments.",
  users: [DIRECTOR],
  steps: [directorMilestone],
};
