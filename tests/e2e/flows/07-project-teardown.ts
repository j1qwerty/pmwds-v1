import type { Flow, FlowApi, Step } from "./types.js";
import { CREATOR_USER } from "./data.js";

/**
 * Flow 7 - the project manager edits the project and, as the very last step,
 * deletes it. This is the final flow in the full run: the project created in
 * flow 1 is torn down here.
 */

const PM = CREATOR_USER;

const editProject: Step = {
  id: "edit-project",
  title: `${PM} edits the project (name, description, priority)`,
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const project = api.ctx.latestProject();
    const newName = `${project.name} [edited]`;
    const newDescription = `${project.name} - description edited by ${PM} during the e2e run.`;

    await d.goto(`/projects/${project.id}/milestones`);
    await d.click("editProject", "shell-info", { nth: "0" });
    await d.page.waitForTimeout(600);

    await d.fill("name", newName, "project-form", { nth: "0,1,2" });
    await d.fill("description", newDescription, "project-form", { nth: "0,1,2" });
    await d.select("priority", "Critical", "project-form", { nth: "0,1,2" }).catch(
      () => api.report.warn("priority select not matched in the edit form"),
    );
    await d.click("save", "project-form", { nth: "0,1" });
    await d.page.waitForTimeout(2000);

    if (d.apiFailures().length) {
      api.report.warn(`edit project API failures: ${d.apiFailures().map((f) => `${f.status} ${f.url.split("/api/v1")[1]}`).join(", ")}`);
    } else {
      project.name = newName;
      api.report.ok(`project edited -> "${newName}"`);
    }
  },
};

const deleteProject: Step = {
  id: "delete-project",
  title: `${PM} deletes the project (final step) via the confirmation modal`,
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const project = api.ctx.latestProject();

    await d.goto(`/projects/${project.id}/milestones`);
    await d.click("deleteProject", "shell-info", { nth: "0" });
    await d.page.waitForTimeout(600);

    // ConfirmDeleteModal: heading "Confirm Deletion", submit "Delete Permanently".
    await d.expectText("confirmHeading", "project-delete", 5000).catch(() =>
      api.report.warn("confirm heading not detected"),
    );
    await d.click("confirm", "project-delete", { nth: "0,1" });
    await d.page.waitForTimeout(3000);

    // Deleting navigates back to /projects.
    if (d.page.url().includes("/projects") && !d.page.url().includes(project.id)) {
      api.ctx.projects = api.ctx.projects.filter((p) => p.id !== project.id);
      delete api.ctx.milestones[project.id];
      delete api.ctx.tasks[project.id];
      delete api.ctx.subtasks[project.id];
      api.report.ok(`project deleted: ${project.name} (${project.id})`);
    } else {
      api.report.warn(`still on ${d.page.url()} - project may not have been deleted`);
    }
  },
};

export const projectTeardownFlow: Flow = {
  id: "project-edit-delete",
  title: "7. Project manager edits and then deletes the project (final)",
  description:
    "The PM opens the edit form, changes the name/description/priority and saves, then " +
    "deletes the project through the confirmation modal, tearing down the project " +
    "created in step 1.",
  users: [PM],
  steps: [editProject, deleteProject],
};