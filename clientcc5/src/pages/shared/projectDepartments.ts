import type { Department, Project } from "../../types";

export function getProjectDepartmentIds(project: Pick<Project, "departmentId" | "departmentIds" | "departments">): string[] {
  const ids = project.departmentIds?.length
    ? project.departmentIds
    : project.departments?.map((department) => department.departmentId) ?? [];

  return Array.from(new Set([...(ids ?? []), project.departmentId].filter(Boolean) as string[]));
}

export function projectBelongsToDepartment(project: Project, departmentId: string) {
  return getProjectDepartmentIds(project).includes(departmentId);
}

export function projectBelongsToAnyDepartment(project: Project, departmentIds: string[]) {
  const assignedDepartmentIds = getProjectDepartmentIds(project);
  return assignedDepartmentIds.some((departmentId) => departmentIds.includes(departmentId));
}

export function getProjectDepartments(project: Project, departments: Department[]) {
  const assignedDepartmentIds = getProjectDepartmentIds(project);
  return departments.filter((department) => assignedDepartmentIds.includes(department.id));
}
