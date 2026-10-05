import { runCoordinatedRead } from "./api/requestCoordinator";
import type {
  AiReportResponse,
  AIModel,
  AIModelRecord,
  AIProvider,
  AISettingsRequest,
  AISettingsResponse,
  AIProviderTestResult,
  AllocationRecommendationRecord,
  AssigneeRecommendation,
  AuthResponse,
  BurnoutRiskRecord,
  ChatResponse,
  DashboardData,
  ProjectDashboardData,
  DatabaseStatus,
  DashboardRecord,
  DelayPrediction,
  DelayPredictionRecord,
  Department,
  DependencyStatus,
  IntegrationDetailRecord,
  IntegrationRecord,
  KnowledgeArticleRecord,
  LessonLearnedRecord,
  Milestone,
  MilestoneDependency,
  NotificationItem,
  NotificationTemplateRecord,
  AlertRuleRecord,
  OrganizationRecord,
  PagesDataResponse,
  PermissionRecord,
  Project,
  ProjectDocument,
  ProjectHealth,
  PredictionResultRecord,
  ReportScheduleRecord,
  ResourceOptimizationRecord,
  RoleRecord,
  TaskAnalysisRecord,
  SkillRecord,
  StoredReportDetailRecord,
  StoredReportRecord,
  Task,
  TaskDependency,
  TrainingDataPointRecord,
  ActivityLogRecord,
  UserProfileRecord,
  User,
  WebhookDetailRecord,
  WebhookRecord,
  WorkspaceBootstrap,
  WorkspaceSnapshot,
  WorkloadReport,
  SubmitUtilizationCertificatePayload,
  UpdateUtilizationCertificatePayload,
  UtilizationCertificate,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:5177/api/v1";

type ApiOptions = {
  token?: string | null;
  method?: string;
  body?: BodyInit | object | null;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  responseType?: 'json' | 'blob';
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type TaskListQuery = {
  page?: number;
  pageSize?: number;
  projectId?: string;
  departmentId?: string;
  search?: string;
  statuses?: string;
  priorities?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  // Resolve against the current origin so a relative API base such as "/api/v1" works. `new URL`
  // throws "is not a valid URL" for a relative input with no base argument, which is why the
  // absolute subdomain URL used to be required.
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const url = new URL(`${API_BASE_URL}/${path.replace(/^\//, "")}`, origin);

  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = new Headers(options.headers);
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let body = options.body ?? undefined;
  if (
    body &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    typeof body !== "string"
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const method = (options.method ?? "GET").toUpperCase();
  const execute = async () => {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const responseText = await response.text();
      let message = responseText;
      try {
        const json = JSON.parse(responseText);
        message = json.error?.message || json.message || json.error || responseText;
      } catch {
        // Keep the server-provided response text when it is not valid JSON.
      }
      throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
    }

    if (options.responseType === 'blob') {
      return (await response.blob()) as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      if (json && typeof json === "object" && "success" in json && "data" in json) {
        return json.data as T;
      }
      return json as T;
    }

    return (await response.blob()) as T;
  };

  if ((method === "GET" || method === "HEAD") && options.responseType !== "blob") {
    return runCoordinatedRead(
      `${method}:${url.toString()}:${options.token ?? ""}`,
      execute,
    );
  }

  return execute();

}

async function requestList<T>(path: string, options: ApiOptions = {}): Promise<T[]> {
  const result = await request<T[] | PaginatedResponse<T>>(path, options);
  return Array.isArray(result) ? result : result.items;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>("auth/login", {
      method: "POST",
      body: { email, password },
    });
  },
  signup(payload: Record<string, unknown>) {
    return request<User>("auth/signup", { method: "POST", body: payload });
  },
  forgotPassword(email: string) {
    return request<{ message: string }>("auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  },
  resetPassword(email: string, token: string, newPassword: string) {
    return request<{ message: string }>("auth/reset-password", {
      method: "POST",
      body: { email, token, newPassword },
    });
  },
  refresh(userId: string, refreshToken: string) {
    return request<{ token: string; expiry: string; refreshToken: string; refreshTokenExpiry: string }>("auth/refresh", {
      method: "POST",
      body: { userId, refreshToken },
    });
  },
  logout(token: string) {
    return request<void>("auth/logout", { method: "POST", token });
  },
  getDashboard(token: string, departmentId?: string | null) {
    return request<ProjectDashboardData>("projects/dashboard", {
      token,
      query: { departmentId: departmentId ?? undefined },
    });
  },
  getProjects(token: string, filters?: { departmentId?: string; status?: string }) {
    return requestList<Project>("projects", {
      token,
      query: filters ?? {},
    });
  },
  getProject(token: string, id: string) {
    return request<Project>(`projects/${id}`, { token });
  },
  createProject(token: string, payload: Record<string, unknown>) {
    return request<Project>("projects", { token, method: "POST", body: payload });
  },
  updateProject(token: string, id: string, payload: Record<string, unknown>) {
    return request<Project>(`projects/${id}`, { token, method: "PUT", body: payload });
  },
  updateProjectStatus(token: string, id: string, newStatus: string, justification?: string) {
    return request<Project>(`projects/${id}/status`, {
      token,
      method: "PATCH",
      body: { newStatus, justification },
    });
  },
  getProjectProgress(token: string, id: string) {
    return request<Record<string, unknown>>(`projects/${id}/progress`, { token });
  },
  getProjectInsights(token: string, id: string) {
    return request<string[]>(`projects/${id}/ai/insights`, { token });
  },
  getProjectHealth(token: string, id: string) {
    return request<ProjectHealth>(`projects/${id}/ai/health`, { token });
  },
  optimizeProjectResources(token: string, id: string) {
    return request<Record<string, unknown>>(`projects/${id}/ai/optimize-resources`, {
      token,
      method: "POST",
    });
  },
  uploadProjectDocument(token: string, id: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<void>(`projects/${id}/documents`, { token, method: "POST", body: form });
  },
  getProjectDocuments(token: string, id: string) {
    return request<ProjectDocument[]>(`projects/${id}/documents`, { token });
  },
  downloadProjectDocument(token: string, id: string, docId: string) {
    return request<Blob>(`projects/${id}/documents/${docId}/download`, { token });
  },
  getProjectUtilizationCertificates(token: string, projectId: string) {
    return request<UtilizationCertificate[]>(`utilization-certificates/project/${projectId}`, { token });
  },
  getUtilizationCertificate(token: string, id: string) {
    return request<UtilizationCertificate>(`utilization-certificates/${id}`, { token });
  },
  submitUtilizationCertificate(token: string, file: File, payload: SubmitUtilizationCertificatePayload) {
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", payload.projectId);
    form.set("certificateNumber", payload.certificateNumber);
    form.set("fundingSource", payload.fundingSource);
    form.set("amountClaimed", String(payload.amountClaimed));
    form.set("amountUtilized", String(payload.amountUtilized));
    // Date-only fields: send yyyy-MM-dd so the server is not off by a timezone day.
    form.set("periodStart", payload.periodStart.slice(0, 10));
    form.set("periodEnd", payload.periodEnd.slice(0, 10));
    if (payload.milestoneId) form.set("milestoneId", payload.milestoneId);
    if (payload.taskId) form.set("taskId", payload.taskId);
    if (payload.purpose) form.set("purpose", payload.purpose);
    if (payload.title) form.set("title", payload.title);
    if (payload.description) form.set("description", payload.description);
    return request<UtilizationCertificate>("utilization-certificates", { token, method: "POST", body: form });
  },
  updateUtilizationCertificate(token: string, id: string, payload: UpdateUtilizationCertificatePayload) {
    return request<UtilizationCertificate>(`utilization-certificates/${id}`, {
      token,
      method: "PUT",
      body: {
        certificateNumber: payload.certificateNumber,
        fundingSource: payload.fundingSource,
        amountClaimed: payload.amountClaimed,
        amountUtilized: payload.amountUtilized,
        periodStart: payload.periodStart.slice(0, 10),
        periodEnd: payload.periodEnd.slice(0, 10),
        milestoneId: payload.milestoneId ?? null,
        taskId: payload.taskId ?? null,
        purpose: payload.purpose ?? null,
        title: payload.title ?? null,
        description: payload.description ?? null,
      },
    });
  },
  submitUtilizationCertificateForReview(token: string, id: string) {
    return request<UtilizationCertificate>(`utilization-certificates/${id}/submit`, { token, method: "POST" });
  },
  reviewUtilizationCertificate(token: string, id: string, approve: boolean, notes?: string) {
    return request<UtilizationCertificate>(`utilization-certificates/${id}/review`, {
      token,
      method: "POST",
      body: { approve, notes: notes ?? null },
    });
  },
  deleteUtilizationCertificate(token: string, id: string) {
    return request<void>(`utilization-certificates/${id}`, { token, method: "DELETE" });
  },
  deleteProject(token: string, id: string) {
    return request<void>(`projects/${id}`, { token, method: "DELETE" });
  },
  getMilestonesByProject(token: string, projectId: string) {
    return request<Milestone[]>(`milestones/by-project/${projectId}`, { token });
  },
  createMilestone(token: string, payload: Record<string, unknown>) {
    return request<Milestone>("milestones", { token, method: "POST", body: payload });
  },
  getMilestone(token: string, id: string) {
    return request<Milestone>(`milestones/${id}`, { token });
  },
  updateMilestone(token: string, id: string, payload: Record<string, unknown>) {
    return request<Milestone>(`milestones/${id}`, { token, method: "PUT", body: payload });
  },
  completeMilestone(token: string, id: string, forceComplete?: boolean) {
    const query = forceComplete ? { forceComplete: "true" } : undefined;
    return request<Milestone>(`milestones/${id}/complete`, { token, method: "PATCH", query });
  },
  setMilestoneStatus(token: string, id: string, status: string, forceComplete?: boolean) {
    return request<Milestone>(`milestones/${id}/status`, { token, method: "PATCH", body: { status, forceComplete } });
  },
  deleteMilestone(token: string, id: string) {
    return request<void>(`milestones/${id}`, { token, method: "DELETE" });
  },
  getMilestoneDependencies(token: string, projectId: string) {
    return request<MilestoneDependency[]>(`milestones/by-project/${projectId}/dependencies`, { token });
  },
  createMilestoneDependency(token: string, payload: Record<string, unknown>) {
    return request<MilestoneDependency>("milestones/dependencies", { token, method: "POST", body: payload });
  },
  updateMilestoneDependency(token: string, id: string, payload: Record<string, unknown>) {
    return request<MilestoneDependency>(`milestones/dependencies/${id}`, { token, method: "PUT", body: payload });
  },
  deleteMilestoneDependency(token: string, id: string) {
    return request<void>(`milestones/dependencies/${id}`, { token, method: "DELETE" });
  },
  checkMilestoneDependencyStatus(token: string, milestoneId: string) {
    return request<DependencyStatus>(`milestones/${milestoneId}/dependency-status`, { token });
  },
  getTasksByProject(token: string, projectId: string) {
    return requestList<Task>(`tasks/by-project/${projectId}`, { token });
  },
  getTasks(token: string, query: TaskListQuery = {}) {
    return request<PaginatedResponse<Task>>("tasks", { token, query });
  },
  getMyTasks(token: string) {
    return requestList<Task>("tasks/my-tasks", { token });
  },
  getTask(token: string, id: string) {
    return request<Task>(`tasks/${id}`, { token });
  },
  getOverdueTasks(token: string) {
    return requestList<Task>("tasks/overdue", { token });
  },
  getEscalatedTasks(token: string) {
    return requestList<Task>("tasks/escalated", { token });
  },
  getUnassignedTasks(token: string) {
    return requestList<Task>("tasks/unassigned", { token });
  },
  createTask(token: string, payload: Record<string, unknown>) {
    return request<Task>("tasks", { token, method: "POST", body: payload });
  },
  updateTask(token: string, id: string, payload: Record<string, unknown>) {
    return request<Task>(`tasks/${id}`, { token, method: "PUT", body: payload });
  },
  updateTaskProgress(token: string, id: string, progressPercentage: number, notes?: string) {
    return request<Task>(`tasks/${id}/progress`, {
      token,
      method: "PATCH",
      body: { progressPercentage, notes },
    });
  },
  updateTaskStatus(token: string, id: string, newStatus: string, options?: { confirmReset?: boolean }) {
    return request<Task>(`tasks/${id}/status`, {
      token,
      method: "PATCH",
      body: { newStatus, confirmReset: options?.confirmReset ?? false },
    });
  },
  assignTask(token: string, id: string, assigneeId: string, useAIRecommendation = false) {
    return request<Task>(`tasks/${id}/assign`, {
      token,
      method: "POST",
      body: { assigneeId, useAIRecommendation },
    });
  },
  assignTaskMembers(token: string, id: string, assigneeIds: string[]) {
    return request<Task>(`tasks/${id}/assign`, {
      token,
      method: "POST",
      body: { assigneeIds },
    });
  },
  getTaskRecommendation(token: string, id: string) {
    return request<Record<string, unknown>>(`tasks/${id}/ai/recommend-assignee`, { token });
  },
  getTaskDelayPrediction(token: string, id: string) {
    return request<DelayPrediction>(`tasks/${id}/ai/delay-prediction`, { token });
  },
  escalateTask(token: string, id: string) {
    return request<Task>(`tasks/${id}/escalate`, { token, method: "POST" });
  },
  addTaskComment(token: string, id: string, comment: string) {
    return request<Task>(`tasks/${id}/comments`, {
      token,
      method: "POST",
      body: { comment },
    });
  },
  uploadTaskAttachment(token: string, id: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<Task>(`tasks/${id}/attachments`, { token, method: "POST", body: form });
  },
  deleteTask(token: string, id: string) {
    return request<void>(`tasks/${id}`, { token, method: "DELETE" });
  },
  getSubtasks(token: string, parentTaskId: string) {
    return requestList<Task>(`tasks/${parentTaskId}/subtasks`, { token });
  },
  createSubtask(token: string, parentTaskId: string, payload: Record<string, unknown>) {
    return request<Task>(`tasks/${parentTaskId}/subtasks`, { token, method: "POST", body: payload });
  },
  getSubtask(token: string, id: string) {
    return request<Task>(`tasks/subtasks/${id}`, { token });
  },
  updateSubtask(token: string, id: string, payload: Record<string, unknown>) {
    return request<Task>(`tasks/subtasks/${id}`, { token, method: "PUT", body: payload });
  },
  updateSubtaskProgress(token: string, id: string, progressPercentage: number, notes?: string) {
    return request<Task>(`tasks/subtasks/${id}/progress`, {
      token,
      method: "PATCH",
      body: { progressPercentage, notes },
    });
  },
  updateSubtaskStatus(token: string, id: string, newStatus: string, options?: { confirmReset?: boolean }) {
    return request<Task>(`tasks/subtasks/${id}/status`, {
      token,
      method: "PATCH",
      body: { newStatus, confirmReset: options?.confirmReset ?? false },
    });
  },
  assignSubtask(token: string, id: string, assigneeId: string, useAIRecommendation = false) {
    return request<Task>(`tasks/subtasks/${id}/assign`, {
      token,
      method: "POST",
      body: { assigneeId, useAIRecommendation },
    });
  },
  deleteSubtask(token: string, id: string) {
    return request<void>(`tasks/subtasks/${id}`, { token, method: "DELETE" });
  },
  getTaskDependencies(token: string, taskId: string) {
    return request<TaskDependency[]>(`tasks/${taskId}/dependencies`, { token });
  },
  createTaskDependency(token: string, taskId: string, payload: { predecessorTaskId: string; successorTaskId: string; type: string; lagDays: number }) {
    return request<TaskDependency>(`tasks/${taskId}/dependencies`, { token, method: "POST", body: payload });
  },
  updateTaskDependency(token: string, depId: string, payload: { type: string; lagDays: number }) {
    return request<TaskDependency>(`tasks/dependencies/${depId}`, { token, method: "PUT", body: payload });
  },
  deleteTaskDependency(token: string, depId: string) {
    return request<void>(`tasks/dependencies/${depId}`, { token, method: "DELETE" });
  },
  getUsers(token: string, departmentId?: string | null) {
    return requestList<User>("users", {
      token,
      query: { departmentId: departmentId ?? undefined, pageSize: 500 },
    });
  },
  getMe(token: string) {
    return request<User>("users/me", { token });
  },
  getAvailableUsers(token: string) {
    return requestList<User>("users/available", { token });
  },
  getWorkload(token: string, departmentId?: string | null) {
    return request<WorkloadReport>("users/workload", {
      token,
      query: { departmentId: departmentId ?? undefined },
    });
  },
  registerUser(token: string, payload: Record<string, unknown>) {
    return request<User>("users/register", { token, method: "POST", body: payload });
  },
  updateUser(token: string, id: string, payload: Record<string, unknown>) {
    return request<User>(`users/${id}`, { token, method: "PUT", body: payload });
  },
  assignUserDepartments(token: string, id: string, departmentIds: string[], primaryDepartmentId?: string | null) {
    return request<User>(`users/${id}/departments`, {
      token,
      method: "PUT",
      body: { departmentIds, primaryDepartmentId },
    });
  },
  uploadUserProfilePicture(token: string, id: string, file: File) {
    const form = new FormData();
    form.set("file", file);
    return request<{ profilePictureUrl: string; user: User }>(`users/${id}/profile-picture`, {
      token,
      method: "POST",
      body: form,
    });
  },
  updateAvailability(token: string, id: string, status: string, availabilityPercentage: number) {
    return request<User>(`users/${id}/availability`, {
      token,
      method: "PATCH",
      body: { status, availabilityPercentage },
    });
  },
  addUserSkill(token: string, id: string, skillId: string, proficiencyLevel: number, experienceMonths: number) {
    return request<User>(`users/${id}/skills`, {
      token,
      method: "POST",
      body: { skillId, proficiencyLevel, experienceMonths },
    });
  },
  updateUserSkill(token: string, userId: string, skillId: string, proficiencyLevel: number, experienceMonths: number) {
    return request<User>(`users/${userId}/skills/${skillId}`, {
      token,
      method: "PUT",
      body: { proficiencyLevel, experienceMonths },
    });
  },
  removeUserSkill(token: string, userId: string, skillId: string) {
    return request<User>(`users/${userId}/skills/${skillId}`, {
      token,
      method: "DELETE",
    });
  },
  deactivateUser(token: string, id: string) {
    return request<void>(`users/${id}/deactivate`, { token, method: "PATCH" });
  },
  reactivateUser(token: string, id: string) {
    return request<User>(`users/${id}/reactivate`, { token, method: "PATCH" });
  },
  getDepartments(token: string, pageSize = 500) {
    return requestList<Department>("departments", { token, query: { page: 1, pageSize } });
  },
  getRoles(token: string) {
    return request<RoleRecord[]>("roles", { token });
  },
  createRole(token: string, payload: Record<string, unknown>) {
    return request<RoleRecord>("roles", { token, method: "POST", body: payload });
  },
  updateRole(token: string, id: string, payload: Record<string, unknown>) {
    return request<RoleRecord>(`roles/${id}`, { token, method: "PUT", body: payload });
  },
  deleteRole(token: string, id: string) {
    return request<void>(`roles/${id}`, { token, method: "DELETE" });
  },
  getPermissions(token: string) {
    return request<PermissionRecord[]>("roles/permissions", { token });
  },
  createPermission(token: string, payload: Record<string, unknown>) {
    return request<PermissionRecord>("roles/permissions", { token, method: "POST", body: payload });
  },
  updatePermission(token: string, id: string, payload: Record<string, unknown>) {
    return request<PermissionRecord>(`roles/permissions/${id}`, { token, method: "PUT", body: payload });
  },
  deletePermission(token: string, id: string) {
    return request<void>(`roles/permissions/${id}`, { token, method: "DELETE" });
  },
  getProfile(token: string, userId: string) {
    return request<UserProfileRecord>(`profiles/${userId}`, { token });
  },
  upsertProfile(token: string, userId: string, payload: Record<string, unknown>) {
    return request<UserProfileRecord>(`profiles/${userId}`, { token, method: "PUT", body: payload });
  },
  getDepartmentDashboard(token: string, id: string) {
    return request<Record<string, unknown>>(`departments/${id}/dashboard`, { token });
  },
  createDepartment(token: string, payload: Record<string, unknown>) {
    return request<Department>("departments", { token, method: "POST", body: payload });
  },
  updateDepartment(token: string, id: string, payload: Record<string, unknown>) {
    return request<void>(`departments/${id}`, { token, method: "PUT", body: payload });
  },
  deleteDepartment(token: string, id: string) {
    return request<void>(`departments/${id}`, { token, method: "DELETE" });
  },
  getNotifications(token: string, unreadOnly = false) {
    return request<NotificationItem[]>("notifications", {
      token,
      query: { unreadOnly, page: 1, pageSize: 50 },
    });
  },
  getUnreadNotificationCount(token: string) {
    return request<{ count: number }>("notifications/unread-count", { token });
  },
  markNotificationRead(token: string, id: string) {
    return request<void>(`notifications/${id}/read`, { token, method: "PATCH" });
  },
  markAllNotificationsRead(token: string) {
    return request<void>("notifications/read-all", { token, method: "PATCH" });
  },
  deleteNotification(token: string, id: string) {
    return request<void>(`notifications/${id}`, { token, method: "DELETE" });
  },
  broadcastNotification(token: string, payload: Record<string, unknown>) {
    return request<void>("notifications/broadcast", { token, method: "POST", body: payload });
  },
  getNotificationTemplates(token: string) {
    return request<NotificationTemplateRecord[]>("notifications/templates", { token });
  },
  createNotificationTemplate(token: string, payload: Record<string, unknown>) {
    return request<NotificationTemplateRecord>("notifications/templates", {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateNotificationTemplate(token: string, id: string, payload: Record<string, unknown>) {
    return request<NotificationTemplateRecord>(`notifications/templates/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteNotificationTemplate(token: string, id: string) {
    return request<void>(`notifications/templates/${id}`, { token, method: "DELETE" });
  },
  getAlertRules(token: string) {
    return request<AlertRuleRecord[]>("notifications/rules", { token });
  },
  createAlertRule(token: string, payload: Record<string, unknown>) {
    return request<AlertRuleRecord>("notifications/rules", {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateAlertRule(token: string, id: string, payload: Record<string, unknown>) {
    return request<AlertRuleRecord>(`notifications/rules/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteAlertRule(token: string, id: string) {
    return request<void>(`notifications/rules/${id}`, { token, method: "DELETE" });
  },
  getOrganizations(token: string) {
    return requestList<OrganizationRecord>("organizations", { token });
  },
  getOrganization(token: string, id: string) {
    return request<OrganizationRecord>(`organizations/${id}`, { token });
  },
  createOrganization(token: string, payload: Record<string, unknown>) {
    return request<OrganizationRecord>("organizations", { token, method: "POST", body: payload });
  },
  updateOrganization(token: string, id: string, payload: Record<string, unknown>) {
    return request<OrganizationRecord>(`organizations/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  assignDepartmentToOrganization(token: string, id: string, departmentId: string) {
    return request<void>(`organizations/${id}/departments/${departmentId}`, {
      token,
      method: "PUT",
    });
  },
  removeDepartmentFromOrganization(token: string, id: string, departmentId: string) {
    return request<void>(`organizations/${id}/departments/${departmentId}`, {
      token,
      method: "DELETE",
    });
  },
  deleteOrganization(token: string, id: string) {
    return request<void>(`organizations/${id}`, { token, method: "DELETE" });
  },
  getDashboards(token: string) {
    return request<DashboardRecord[]>("dashboards", { token });
  },
  getDashboardById(token: string, id: string) {
    return request<DashboardRecord>(`dashboards/${id}`, { token });
  },
  createDashboard(token: string, payload: Record<string, unknown>) {
    return request<DashboardRecord>("dashboards", { token, method: "POST", body: payload });
  },
  updateDashboard(token: string, id: string, payload: Record<string, unknown>) {
    return request<DashboardRecord>(`dashboards/${id}`, { token, method: "PUT", body: payload });
  },
  addDashboardWidget(token: string, dashboardId: string, payload: Record<string, unknown>) {
    return request<DashboardRecord["widgets"][number]>(`dashboards/${dashboardId}/widgets`, {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateDashboardWidget(token: string, widgetId: string, payload: Record<string, unknown>) {
    return request<DashboardRecord["widgets"][number]>(`dashboards/widgets/${widgetId}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  reorderDashboardWidgets(token: string, dashboardId: string, widgetIds: string[]) {
    return request<void>(`dashboards/${dashboardId}/widgets/reorder`, {
      token,
      method: "PATCH",
      body: { widgetIds },
    });
  },
  deleteDashboardWidget(token: string, widgetId: string) {
    return request<void>(`dashboards/widgets/${widgetId}`, {
      token,
      method: "DELETE",
    });
  },
  deleteDashboard(token: string, id: string) {
    return request<void>(`dashboards/${id}`, { token, method: "DELETE" });
  },
  getAiProviders(token: string) {
    return request<AIProvider[]>("ai/providers", { token });
  },
  searchAiModels(token: string, provider: string, search?: string, limit?: number) {
    return request<AIModel[]>(`ai/providers/${provider}/models`, {
      token,
      query: { search, limit: limit ?? 30 },
    });
  },
  testAiProvider(token: string, provider: string, model?: string, prompt?: string) {
    return request<AIProviderTestResult>(`ai/providers/${provider}/test`, {
      token,
      method: "POST",
      body: { model, prompt },
    });
  },
  chat(token: string, message: string, provider?: string, model?: string) {
    return request<ChatResponse>("ai/chat", {
      token,
      method: "POST",
      body: { message, provider, model },
    });
  },
  getAiBurnoutRisk(token: string, departmentId?: string | null) {
    return request<BurnoutRiskRecord[]>("ai/burnout-risk", {
      token,
      query: { departmentId: departmentId ?? undefined },
    });
  },
  getAiInsights(token: string, projectId: string) {
    return request<string[]>(`ai/insights/${projectId}`, { token });
  },
  getAiProjectHealth(token: string, projectId: string) {
    return request<ProjectHealth>(`ai/project-health/${projectId}`, { token });
  },
  optimizeResources(token: string, projectId: string) {
    return request<ResourceOptimizationRecord>(`ai/optimize-resources/${projectId}`, {
      token,
      method: "POST",
    });
  },
  getTaskDelay(token: string, taskId: string) {
    return request<DelayPrediction>(`ai/predict-delay/${taskId}`, { token });
  },
  recommendAssignee(token: string, taskId: string) {
    return request<AssigneeRecommendation>(`ai/recommend-assignee/${taskId}`, { token });
  },
  generateRecommendation(token: string, taskId: string) {
    return request<AllocationRecommendationRecord>(`ai/recommendations/${taskId}`, {
      token,
      method: "POST",
    });
  },
  getRecommendationHistory(token: string, taskId: string) {
    return request<AllocationRecommendationRecord[]>(`ai/recommendations/${taskId}/history`, {
      token,
    });
  },
  acceptRecommendation(token: string, recommendationId: string) {
    return request<AllocationRecommendationRecord>(`ai/recommendations/${recommendationId}/accept`, {
      token,
      method: "POST",
    });
  },
  rejectRecommendation(token: string, recommendationId: string, reason: string) {
    return request<AllocationRecommendationRecord>(`ai/recommendations/${recommendationId}/reject`, {
      token,
      method: "POST",
      body: { reason },
    });
  },
  explainRecommendation(token: string, recommendationId: string) {
    return request<{ explanation: string }>(`ai/recommendations/${recommendationId}/explanation`, {
      token,
    });
  },
  analyzeTask(token: string, taskId: string) {
    return request<TaskAnalysisRecord>(`ai/tasks/${taskId}/analysis`, { token });
  },
  generateDelayPrediction(token: string, taskId: string) {
    return request<DelayPredictionRecord>(`ai/predictions/${taskId}`, {
      token,
      method: "POST",
    });
  },
  getPredictionHistory(token: string, taskId: string) {
    return request<DelayPredictionRecord[]>(`ai/predictions/${taskId}/history`, { token });
  },
  predictProjectDelays(token: string, projectId: string) {
    return request<DelayPredictionRecord[]>(`ai/projects/${projectId}/predictions`, {
      token,
      method: "POST",
    });
  },
  getPredictionResults(token: string, filters?: { taskId?: string; modelId?: string }) {
    return request<PredictionResultRecord[]>("ai/prediction-results", {
      token,
      query: filters,
    });
  },
  trainModels(token: string) {
    return request<Record<string, unknown>>("ai/train", { token, method: "POST" });
  },
  getAiModels(token: string, modelType?: string) {
    return request<AIModelRecord[]>("ai/models", { token, query: { modelType } });
  },
  getAiModel(token: string, modelId: string) {
    return request<AIModelRecord>(`ai/models/${modelId}`, { token });
  },
  createAiModel(token: string, payload: Record<string, unknown>) {
    return request<AIModelRecord>("ai/models", { token, method: "POST", body: payload });
  },
  updateAiModel(token: string, modelId: string, payload: Record<string, unknown>) {
    return request<AIModelRecord>(`ai/models/${modelId}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteAiModel(token: string, modelId: string) {
    return request<void>(`ai/models/${modelId}`, { token, method: "DELETE" });
  },
  getTrainingData(token: string, dataType?: string) {
    return request<TrainingDataPointRecord[]>("ai/training-data", {
      token,
      query: { dataType },
    });
  },
  createTrainingData(token: string, payload: Record<string, unknown>) {
    return request<TrainingDataPointRecord>("ai/training-data", {
      token,
      method: "POST",
      body: payload,
    });
  },
  getModelPerformance(token: string) {
    return request<Record<string, number>>("ai/performance", { token });
  },
  generateReport(token: string, reportType: string, body: Record<string, unknown>) {
    return request<AiReportResponse>(`reports/${reportType}/generate`, {
      token,
      method: "POST",
      body,
    });
  },
  downloadReport(
    token: string,
    path: string,
    options?: { method?: string; body?: Record<string, unknown>; format?: string },
  ) {
    return request<Blob>(path, {
      token,
      method: options?.method ?? "GET",
      body: options?.body ?? null,
      query: { format: options?.format ?? "pdf" },
    });
  },
  getStoredReports(token: string) {
    return request<StoredReportRecord[]>("reports/stored", { token });
  },
  getStoredReport(token: string, id: string) {
    return request<StoredReportDetailRecord>(`reports/stored/${id}`, { token });
  },
  createStoredReport(token: string, payload: Record<string, unknown>) {
    return request<StoredReportRecord>("reports/stored", { token, method: "POST", body: payload });
  },
  updateStoredReport(token: string, id: string, payload: Record<string, unknown>) {
    return request<StoredReportRecord>(`reports/stored/${id}`, { token, method: "PUT", body: payload });
  },
  deleteStoredReport(token: string, id: string) {
    return request<void>(`reports/stored/${id}`, { token, method: "DELETE" });
  },
  downloadStoredReport(token: string, id: string) {
    return request<Blob>(`reports/stored/${id}/download`, { token, responseType: 'blob' });
  },
  getReportSchedules(token: string) {
    return request<ReportScheduleRecord[]>("reports/schedules", { token });
  },
  createReportSchedule(token: string, payload: Record<string, unknown>) {
    return request<ReportScheduleRecord>("reports/schedules", {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateReportSchedule(token: string, id: string, payload: Record<string, unknown>) {
    return request<ReportScheduleRecord>(`reports/schedules/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteReportSchedule(token: string, id: string) {
    return request<void>(`reports/schedules/${id}`, { token, method: "DELETE" });
  },
  getIntegrations(token: string) {
    return request<IntegrationRecord[]>("integrations", { token });
  },
  getIntegration(token: string, id: string) {
    return request<IntegrationDetailRecord>(`integrations/${id}`, { token });
  },
  createIntegration(token: string, payload: Record<string, unknown>) {
    return request<IntegrationRecord>("integrations", { token, method: "POST", body: payload });
  },
  updateIntegration(token: string, id: string, payload: Record<string, unknown>) {
    return request<IntegrationRecord>(`integrations/${id}`, { token, method: "PUT", body: payload });
  },
  syncIntegration(token: string, id: string, status: string) {
    return request<IntegrationRecord>(`integrations/${id}/sync`, {
      token,
      method: "PATCH",
      body: { status },
    });
  },
  deleteIntegration(token: string, id: string) {
    return request<void>(`integrations/${id}`, { token, method: "DELETE" });
  },
  getWebhooks(token: string, integrationId?: string) {
    return request<WebhookRecord[]>("webhooks", {
      token,
      query: { integrationId },
    });
  },
  getWebhook(token: string, id: string) {
    return request<WebhookDetailRecord>(`webhooks/${id}`, { token });
  },
  createWebhook(token: string, payload: Record<string, unknown>) {
    return request<WebhookRecord>("webhooks", { token, method: "POST", body: payload });
  },
  updateWebhook(token: string, id: string, payload: Record<string, unknown>) {
    return request<WebhookRecord>(`webhooks/${id}`, { token, method: "PUT", body: payload });
  },
  logWebhookDelivery(token: string, id: string, payload: Record<string, unknown>) {
    return request<WebhookDetailRecord["deliveries"][number]>(`webhooks/${id}/deliveries`, {
      token,
      method: "POST",
      body: payload,
    });
  },
  deleteWebhook(token: string, id: string) {
    return request<void>(`webhooks/${id}`, { token, method: "DELETE" });
  },
  getSkills(token: string) {
    return request<SkillRecord[]>("skills", { token });
  },
  createSkill(token: string, payload: Record<string, unknown>) {
    return request<SkillRecord>("skills", { token, method: "POST", body: payload });
  },
  updateSkill(token: string, id: string, payload: Record<string, unknown>) {
    return request<SkillRecord>(`skills/${id}`, { token, method: "PUT", body: payload });
  },
  deleteSkill(token: string, id: string) {
    return request<void>(`skills/${id}`, { token, method: "DELETE" });
  },
  getKnowledgeArticles(token: string, projectId?: string) {
    return request<KnowledgeArticleRecord[]>("knowledge/articles", {
      token,
      query: { projectId },
    });
  },
  createKnowledgeArticle(token: string, payload: Record<string, unknown>) {
    return request<KnowledgeArticleRecord>("knowledge/articles", {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateKnowledgeArticle(token: string, id: string, payload: Record<string, unknown>) {
    return request<KnowledgeArticleRecord>(`knowledge/articles/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteKnowledgeArticle(token: string, id: string) {
    return request<void>(`knowledge/articles/${id}`, { token, method: "DELETE" });
  },
  getLessons(token: string, projectId?: string) {
    return request<LessonLearnedRecord[]>("knowledge/lessons", {
      token,
      query: { projectId },
    });
  },
  createLesson(token: string, payload: Record<string, unknown>) {
    return request<LessonLearnedRecord>("knowledge/lessons", {
      token,
      method: "POST",
      body: payload,
    });
  },
  updateLesson(token: string, id: string, payload: Record<string, unknown>) {
    return request<LessonLearnedRecord>(`knowledge/lessons/${id}`, {
      token,
      method: "PUT",
      body: payload,
    });
  },
  deleteLesson(token: string, id: string) {
    return request<void>(`knowledge/lessons/${id}`, { token, method: "DELETE" });
  },
  getMyActivityLogs(token: string, count = 50) {
    return requestList<ActivityLogRecord>("activitylogs", {
      token,
      query: { count },
    });
  },
  getUserActivityLogs(token: string, userId: string, count = 50) {
    return requestList<ActivityLogRecord>(`activitylogs/user/${userId}`, {
      token,
      query: { count },
    });
  },
  getTeamActivityLogs(token: string, count = 50) {
    return requestList<ActivityLogRecord>("activitylogs/team", {
      token,
      query: { count },
    });
  },
  getAllActivityLogs(token: string, count = 50) {
    return requestList<ActivityLogRecord>("activitylogs/all", {
      token,
      query: { count },
    });
  },
  getProjectActivityLogs(token: string, projectId: string, count = 50) {
    return requestList<ActivityLogRecord>(`activitylogs/project/${projectId}`, {
      token,
      query: { count },
    });
  },
  createActivityLog(token: string, payload: Record<string, unknown>) {
    return request<ActivityLogRecord>("activitylogs", { token, method: "POST", body: payload });
  },
  getAISettings(token: string) {
    return request<AISettingsResponse>("ai/settings", { token });
  },
  getDatabaseStatus(token: string) {
    return request<DatabaseStatus>("system/database", { token });
  },
  getWorkspaceBootstrap(token: string) {
    return request<WorkspaceBootstrap>("workspace/bootstrap", { token });
  },
  getWorkspaceSnapshot(token: string) {
    return request<WorkspaceSnapshot>("workspace/snapshot", { token });
  },
  saveAISettings(token: string, settings: AISettingsRequest) {
    return request<{ success: boolean; message: string }>("ai/settings", {
      token,
      method: "POST",
      body: settings,
    });
  },
  getPagesData(token: string, page = 1, pageSize?: number) {
    return request<PagesDataResponse>("pages", {
      token,
      query: { page, pageSize },
    });
  },
};
