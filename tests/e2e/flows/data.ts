import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Deterministic-ish unique suffix so reruns do not collide on names. */
export function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface Plan {
  projectName: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  budgetLakhs: string;
  startDate: string;
  endDate: string;
  /** Milestones created in wizard step 2, each with a department code. */
  milestones: Array<{ name: string; description: string; dueDate: string; critical: boolean; deptCode: string }>;
  /** Optional dependency between two milestones, by index. */
  dependency?: { prereq: number; dependent: number; type: "completion" | "percent"; threshold?: number };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Which seeded account creates the project in flow 1.
 *
 * The ProjectManager holds the organization-wide (`*_ALL`) flavours of the
 * department, project, milestone, task, subtask, user-view and document
 * permissions, so `GET /departments` returns all eleven departments and wizard
 * step 3 can assign a second department. A DepartmentHead or TeamMember would
 * only ever see their own department's projects.
 *
 * Set this to "admin" to create as a Director instead - useful for isolating a
 * permissions problem to the ProjectManager role.
 */
export const CREATOR_USER = "pm";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}

/**
 * Builds the project plan.
 *
 * `deptCodes` are the departments to spread the wizard's milestones across; one
 * milestone is created per code, and that is what puts those departments on the
 * project. The API rejects a milestone whose department is not assigned to the
 * project (400 "Validation failed"), so flow 2's Director-created Procurement
 * milestone is only legal because PROC is in this list.
 *
 * Defaults to the three seeded departments the flows use: PWDC (PWD Civil
 * Division -> head.eng@org1.com), PWD (Public Works Department ->
 * head.pmo@org1.com) and PROC (Procurement & Finance -> head.ops@org1.com).
 */
export function buildPlan(deptCodes: string[] = ["PWDC", "PWD", "PROC"]): Plan {
  const s = stamp();
  const codes = deptCodes.length >= 2 ? deptCodes : ["PWDC", "PWD", "PROC"];
  const milestones = codes.map((deptCode, i) => ({
    name: `${MILESTONE_NAMES[i % MILESTONE_NAMES.length]} ${s}`,
    description: MILESTONE_DESCRIPTIONS[i % MILESTONE_DESCRIPTIONS.length],
    dueDate: addDays(25 + i * 30),
    critical: i === 0,
    deptCode,
  }));

  return {
    projectName: `E2E Water Works ${s}`,
    description: `Automated end-to-end test project created ${s}. Safe to delete.`,
    priority: "High",
    budgetLakhs: "120",
    startDate: addDays(0),
    endDate: addDays(120),
    milestones,
    dependency: { prereq: 0, dependent: 1, type: "completion" },
  };
}

const MILESTONE_NAMES = ["Survey & Design", "Execution Phase 1", "Procurement Handover"];
const MILESTONE_DESCRIPTIONS = [
  "Site survey, drawings and design sign-off.",
  "First construction package.",
  "Vendor selection and material release.",
];

/** Creates the dummy text file used by the upload tests. */
export function makeDummyFile(dir: string, name = "e2e-dummy.txt"): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  const body = [
    "PMWDS end-to-end test attachment.",
    `Generated: ${new Date().toISOString()}`,
    "This is a dummy file used to exercise the document upload path.",
    "".padEnd(60, "-"),
  ].join("\n");
  writeFileSync(path, body, "utf8");
  return path;
}

/** Creates a small fake PDF-ish file for the utilization certificate test. */
export function makeDummyPdf(dir: string, name = "e2e-dummy-cert.pdf"): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  // Minimal valid PDF structure; the API only checks size and extension.
  const pdf = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  writeFileSync(path, pdf, "utf8");
  return path;
}
