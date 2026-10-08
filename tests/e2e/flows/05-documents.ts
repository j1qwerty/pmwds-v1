import type { Flow, FlowApi, Step } from "./types.js";
import { makeDummyFile, makeDummyPdf, CREATOR_USER } from "./data.js";

/**
 * Flow 5 - dummy text/PDF uploads at project, milestone and task level, plus
 * a utilization certificate draft. Files are generated on the fly, so nothing
 * binary lives in the repo.
 */

const PM = CREATOR_USER;

function uploadAt(level: "project" | "milestone" | "task"): Step {
  return {
    id: `upload-${level}`,
    title: `Upload a dummy file at ${level} level`,
    as: PM,
    async run(api) {
      const d = await api.as(PM);
      const project = api.ctx.latestProject();
      const file = api.ctx.notes.dummyFile ?? makeDummyFile(api.ctx.notes.artifactDir!, "e2e-dummy.txt");
      api.ctx.notes.dummyFile = file;

      await d.goto(`/projects/${project.id}/documents`);
      await d.page.waitForTimeout(800);

      // The upload sheet sets the level itself - no need to touch the tabs.
      await d.click("openUpload", "docs-upload");
      await d.upload("uploadFile", [file], "docs-upload");
      const levelLabel = level === "project" ? "Project" : level === "milestone" ? "Milestone" : "Task";
      await d.select("uploadLevel", levelLabel, "docs-upload");

      // Milestone/Task levels need a target: first real option of the sheet's
      // second select ("Select milestone"/"Select task" is index 0).
      if (level !== "project") {
        const target = d.page.locator('[role="dialog"] select').nth(1);
        if ((await target.count()) > 0) {
          await target.selectOption({ index: 1 }).catch((e: unknown) => api.report.warn(String(e).split("\n")[0]));
        }
      }

      await d.click("uploadSubmit", "docs-upload").catch(async (err: unknown) => {
        api.report.warn(`Upload not clickable: ${String(err).split("\n")[0]}`);
      });
      await d.page.waitForTimeout(2000);

      const failures = d.apiFailures();
      if (failures.length) {
        api.report.warn(`upload ${level}: ${failures.map((f) => `${f.status} ${f.url.split("/api/v1")[1]}`).join(", ")}`);
      } else {
        api.ctx.documents.push({ name: file, level });
        api.report.ok(`dummy file uploaded at ${level} level`);
      }
    },
  };
}

const uploadCertificate: Step = {
  id: "upload-certificate",
  title: "Upload a dummy utilization certificate (draft)",
  as: PM,
  async run(api) {
    const d = await api.as(PM);
    const project = api.ctx.latestProject();
    const pdf = makeDummyPdf(api.ctx.notes.artifactDir!, "e2e-dummy-cert.pdf");

    await d.goto(`/projects/${project.id}/documents`);
    await d.click("submitUc", "docs-uc", { nth: "0,1" }).catch((err: unknown) => {
      api.report.warn(`Submit UC not available: ${String(err).split("\n")[0]}`);
    });
    await d.page.waitForTimeout(800);

    await d.upload("ucFile", [pdf], "docs-uc", { nth: "0,1" }).catch((e: unknown) => api.report.warn(String(e).split("\n")[0]));
    await d.fill("ucNumber", `UC-E2E-${Date.now() % 100000}`, "docs-uc", { nth: "0,1" });
    await d.fill("ucFundingSource", "Government Grant (e2e)", "docs-uc", { nth: "0,1" });
    await d.fill("ucAmountClaimed", "500000", "docs-uc", { nth: "0,1" });
    await d.fill("ucAmountUtilized", "250000", "docs-uc", { nth: "0,1" });

    const periodStart = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    await d.fill("ucPeriodStart", periodStart, "docs-uc", { nth: "0,1,2" });
    await d.fill("ucPeriodEnd", end.toISOString().slice(0, 10), "docs-uc", { nth: "0,1,2" });

    await d.click("saveUc", "docs-uc", { nth: "0,1" }).catch(async (err: unknown) => {
      api.report.warn(`Save as draft not clickable: ${String(err).split("\n")[0]}`);
    });
    await d.page.waitForTimeout(1500);

    const failures = d.apiFailures();
    if (failures.length) {
      api.report.warn(`certificate: ${failures.map((f) => `${f.status} ${f.url.split("/api/v1")[1]}`).join(", ")}`);
    } else {
      api.report.ok("utilization certificate submitted as draft");
    }
    await d.click("closeOverlay", "modal-shell").catch(() => undefined);
  },
};

export const documentsFlow: Flow = {
  id: "documents",
  title: "5. Document uploads (dummy txt/pdf, project + milestone + task + certificate)",
  description:
    "Generates dummy files and uploads them at each level, then submits a dummy " +
    "utilization certificate as a draft.",
  users: [PM],
  steps: [uploadAt("project"), uploadAt("milestone"), uploadAt("task"), uploadCertificate],
};