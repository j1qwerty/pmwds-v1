import type { Locator } from "playwright";
import type { Flow, FlowApi, Step } from "./types.js";
import { buildPlan, CREATOR_USER, type Plan } from "./data.js";
import type { RunContext } from "../lib/context.js";

/**
 * Flow 1 - the project manager creates a project through the 4-step wizard and
 * uploads a document on step 1.
 *
 * The wizard has no route and no deep link to a step, so this flow drives it
 * button by button: open, fill, Next, Next, Next, Finish.
 */

const PM = CREATOR_USER;

/**
 * The plan is generated once per run and cached on the context, because the
 * name is stamped with the current time - building it again in a later step
 * would produce a different project name.
 */
function plan(ctx: RunContext): Plan {
  const cached = ctx.notes.plan;
  if (cached) return JSON.parse(cached) as Plan;
  const p = buildPlan();
  ctx.notes.plan = JSON.stringify(p);
  return p;
}

async function openWizard(api: FlowApi): Promise<void> {
  const d = await api.as(PM);
  await d.goto("/projects");
  await d.click("newProject");
  await d.expectText("wizardVisible");
  api.report.ok("wizard opened at step 1 of 4");
}

const stepDetails: Step = {
  id: "details",
  title: "Wizard step 1 - Project Details (name, dates, budget, document)",
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const p = plan(api.ctx);
    api.ctx.notes.projectName = p.projectName;

    await d.fill("projectName", p.projectName, "step-details");
    await d.fill("description", p.description, "step-details");
    await d.select("priority", p.priority, "step-details");
    await d.fill("budget", p.budgetLakhs, "step-details");
    await d.fill("startDate", p.startDate, "step-details");
    await d.fill("endDate", p.endDate, "step-details");

    api.report.ok(`details filled: ${p.projectName}`);
    api.report.info(`  dates ${p.startDate} -> ${p.endDate}, budget ${p.budgetLakhs} lakhs`);

    // Document upload is permission-gated, so failure here is not fatal.
    const file = api.ctx.notes.dummyFile;
    if (file) {
      try {
        await d.upload("projectDocs", [file], "step-details");
        api.report.ok("document attached on step 1");
      } catch (err) {
        api.report.warn(`step-1 document attach skipped: ${String(err).split("\n")[0]}`);
      }
    }

    await d.click("next", "step-details");
    await d.expectText("onMilestones");
  },
};

const stepMilestones: Step = {
  id: "milestones",
  title: "Wizard step 2 - Milestones (add two, one per department)",
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const p = plan(api.ctx);

    for (const m of p.milestones) {
      await d.click("addMilestoneOpen", "step-milestones");
      await d.fill("milestoneName", m.name, "step-milestones");
      await d.fill("milestoneDescription", m.description, "step-milestones");
      await d.fill("milestoneDueDate", m.dueDate, "step-milestones");
      if (m.critical) {
        await d
          .toggle("milestoneCritical", true, "step-milestones", { nth: "0,1" })
          .catch(() => api.report.warn("critical checkbox not toggled"));
      }
      await d.click("milestoneSave", "step-milestones");
      api.report.ok(`milestone added: ${m.name}`);
    }

    await d.click("next", "step-milestones");
    await d.expectText("onDepartments");
  },
};

const stepDepartments: Step = {
  id: "departments",
  title: "Wizard step 3 - Assign Departments (one select per milestone)",
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const p = plan(api.ctx);
    const selects = d.page.locator("select");
    api.report.info(`  ${await selects.count()} department select(s) on the step`);
    // A ProjectManager's department list is scoped to their own department, so
    // the wizard can only offer PWD here. Prefer an exact code match, fall back
    // to the first real option, and keep assignments distinct when the list
    // allows it. The other department's milestone is added by its own head in
    // flow 2, so the finished project still spans both departments.
    const used = new Set<string>();
    for (let i = 0; i < p.milestones.length; i++) {
      const m = p.milestones[i];
      const select = selects.nth(i);
      const label = await pickOptionByCode(select, m.deptCode);

      if (label && !used.has(label)) {
        await select.selectOption({ label });
        used.add(label);
        api.report.ok(`${m.name} -> ${label}`);
        continue;
      }

      // Fall back to the first option this select has not already been given.
      const options = (await select.locator("option").allTextContents()).map((o) => o.trim());
      const fallback = options.slice(1).find((o) => o && !used.has(o)) ?? options[1];
      if (!fallback) {
        api.report.warn(`no department available for ${m.name}`);
        continue;
      }
      await select.selectOption({ label: fallback });
      used.add(fallback);
      api.report.warn(`${m.name}: no option for code ${m.deptCode}, used ${fallback}`);
    }

    await d.click("next", "step-departments");
    await d.expectText("onDependencies");
  },
};

const stepDependencies: Step = {
  id: "dependencies",
  title: "Wizard step 4 - Dependencies (one link between the two milestones)",
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const p = plan(api.ctx);
    if (!p.dependency) {
      api.report.info("  no dependency planned, finishing");
      await d.click("finish", "wizard-nav");
    } else {
      await d.click("addDependencyOpen", "step-dependencies");
      const prereq = p.milestones[p.dependency.prereq].name;
      const dependent = p.milestones[p.dependency.dependent].name;
      const all = d.page.locator("select");

      await pickByLabel(all.nth(0), prereq).catch(async () => {
        api.report.warn(`prerequisite "${prereq}" not matched by label, using first option`);
        await all.nth(0).selectOption({ index: 1 });
      });
      await pickByLabel(all.nth(1), dependent).catch(async () => {
        api.report.warn(`dependent "${dependent}" not matched by label, using second option`);
        await all.nth(1).selectOption({ index: 2 });
      });

      if (p.dependency.type === "percent") {
        await d.toggle("depReachPercent", true, "step-dependencies");
        await d.fill("depThreshold", String(p.dependency.threshold ?? 50), "step-dependencies");
      }
      await d.click("dependencySave", "step-dependencies");
      api.report.ok(`dependency added: ${prereq} -> ${dependent}`);
      await d.click("finish", "wizard-nav");
    }

    await d.expectText("created", undefined, 30000);
    const id = api.ctx.projectIdFromUrl(d);
    api.ctx.projects.push({ id, name: p.projectName });
    api.ctx.milestones[id] = p.milestones.map((m, i) => ({
      name: m.name,
      id: "",
      departmentId: m.deptCode === "PWDC" ? "head-civil" : m.deptCode === "PWD" ? "head-pmo" : m.deptCode,
      index: i,
    }));
    api.report.ok(`project created: ${p.projectName} (${id})`);
  },
};

/** Finds the option label ending in `({code})`. */
async function pickOptionByCode(select: Locator, code: string): Promise<string | undefined> {
  const options = await select.locator("option").allTextContents();
  const hit = options.find((o) => o.includes(`(${code})`) || o.includes(`(${code} ·`));
  return hit?.trim();
}

/** Selects the option whose text equals `label`, with a helpful error. */
async function pickByLabel(select: Locator, label: string): Promise<void> {
  const options = (await select.locator("option").allTextContents()).map((o) => o.trim());
  if (!options.includes(label)) {
    throw new Error(`option "${label}" not in [${options.join(" | ")}]`);
  }
  await select.selectOption({ label });
}

export const projectCreateFlow: Flow = {
  id: "project-create",
  title: "1. Project manager creates a project (4-step wizard)",
  description:
    "Signs in as the project manager, opens the creation wizard and fills all four steps, " +
    "including a document on step 1 and a dependency on step 4.",
  users: [PM],
  steps: [
    {
      id: "open",
      title: "Open the project creation wizard",
      as: PM,
      async run(api) {
        await openWizard(api);
      },
    },
    stepDetails,
    stepMilestones,
    stepDepartments,
    stepDependencies,
  ],
};
