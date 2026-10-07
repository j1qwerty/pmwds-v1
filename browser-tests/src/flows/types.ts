import type { Browser, Page } from "@playwright/test";
import type { TestUserId } from "../config.js";
import { StepRunner } from "../lib/step-runner.js";

export type FlowState = {
  projectName: string;
  projectId: string;
  milestoneByDepartment: Record<string, string>;
  taskByRole: Record<string, string>;
  subtaskByRole: Record<string, string>;
};

export type FullFlowOptions = {
  browser: Browser;
  runner: StepRunner;
  interactive: boolean;
};

export type UserPage = {
  page: Page;
  userId: TestUserId;
};

export function newFlowState(projectName: string): FlowState {
  return {
    projectName,
    projectId: "",
    milestoneByDepartment: {},
    taskByRole: {},
    subtaskByRole: {},
  };
}
