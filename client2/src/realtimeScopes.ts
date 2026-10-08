/**
 * Data-change scopes pushed by the API over the `DataChanged` SignalR event.
 * Mirrors `DataChangeScopes` in
 * `PMWDS.Application/Interfaces/Services/IDataChangeNotifier.cs`.
 */
export const REALTIME_SCOPES = {
  projects: "projects",
  milestones: "milestones",
  tasks: "tasks",
  users: "users",
  documents: "documents",
  departments: "departments",
  organizations: "organizations",
  roles: "roles",
  notifications: "notifications",
  dashboards: "dashboards",
  utilizationCertificates: "utilization-certificates",
} as const;

export type RealtimeScope = (typeof REALTIME_SCOPES)[keyof typeof REALTIME_SCOPES];

/** Payload of the `DataChanged` hub event. */
export interface DataChangedNotification {
  scope: RealtimeScope | string;
  entityId: string | null;
  projectId: string | null;
  occurredAt: string;
}

/**
 * Scopes that can change anything in the shared app-data store, so receiving one of
 * these means a full bootstrap + pages refetch.
 */
export const GLOBAL_SCOPES: readonly string[] = [
  REALTIME_SCOPES.projects,
  REALTIME_SCOPES.users,
  REALTIME_SCOPES.departments,
  REALTIME_SCOPES.organizations,
  REALTIME_SCOPES.roles,
  REALTIME_SCOPES.notifications,
  REALTIME_SCOPES.dashboards,
];

/**
 * Scopes that affect the data loaded by a single project workspace view. The documents
 * scope is included because a document upload can come from the task-attachment endpoint
 * while the user is looking at the project's Documents tab.
 */
export const PROJECT_WORKSPACE_SCOPES: readonly string[] = [
  REALTIME_SCOPES.projects,
  REALTIME_SCOPES.milestones,
  REALTIME_SCOPES.tasks,
  REALTIME_SCOPES.documents,
  REALTIME_SCOPES.utilizationCertificates,
];

/** Scopes that affect the document list. */
export const DOCUMENT_SCOPES: readonly string[] = [
  REALTIME_SCOPES.documents,
  REALTIME_SCOPES.utilizationCertificates,
];
