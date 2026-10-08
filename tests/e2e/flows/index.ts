import type { Flow } from "./types.js";
import { projectCreateFlow } from "./01-project-create.js";
import { deptHeadMilestonesFlow } from "./02-head-milestones.js";
import { tasksAndSubtasksFlow } from "./03-tasks-subtasks.js";
import { memberProgressFlow } from "./04-member-progress.js";
import { documentsFlow } from "./05-documents.js";
import { editDeleteFlow } from "./06-edit-delete.js";
import { projectTeardownFlow } from "./07-project-teardown.js";

/** Every flow, in the order the full run executes them. */
export const FLOWS: Flow[] = [
  projectCreateFlow,
  deptHeadMilestonesFlow,
  tasksAndSubtasksFlow,
  memberProgressFlow,
  documentsFlow,
  editDeleteFlow,
  projectTeardownFlow,
];

export function flowById(id: string): Flow | undefined {
  return FLOWS.find((f) => f.id === id);
}

export type { Flow, Step, FlowApi } from "./types.js";