import { PERMISSION_GROUPS, Permission } from "../../permissions";
import type { ActionVisibilityEntity } from "../shared";

/**
 * Which permission opens the page(s) that show each kind of row or card.
 *
 * Settings → Row & card actions lists only the areas a person can actually open,
 * so a team member is never asked to configure "Organizations" cards they will
 * never see. Each entry is "any of these".
 */
export const ENTITY_ACCESS: Record<ActionVisibilityEntity, readonly string[]> = {
  projects: [PERMISSION_GROUPS.project.view],
  milestones: [PERMISSION_GROUPS.milestone.view],
  tasks: [PERMISSION_GROUPS.task.view],
  subtasks: [PERMISSION_GROUPS.subtask.view],
  users: [PERMISSION_GROUPS.user.view],
  departments: [PERMISSION_GROUPS.department.view],
  organizations: [PERMISSION_GROUPS.organization.view],
  documents: [Permission.DocumentOwnView, Permission.DocumentAllView],
  reports: [PERMISSION_GROUPS.report.view],
};
