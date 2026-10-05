export const Permission = {
  SystemAdmin: "SYSTEM_ADMIN",
  SystemDatabaseView: "SYSTEM_DATABASE_VIEW",
  AuthManage: "AUTH_MANAGE",

  OrganizationManage: "ORGANIZATION_MANAGE",
  OrganizationView: "ORGANIZATION_VIEW",
  OrganizationCreate: "ORGANIZATION_CREATE",
  OrganizationEdit: "ORGANIZATION_EDIT",
  OrganizationDelete: "ORGANIZATION_DELETE",

  DepartmentManage: "DEPARTMENT_MANAGE",
  DepartmentView: "DEPARTMENT_VIEW",
  DepartmentCreate: "DEPARTMENT_CREATE",
  DepartmentEdit: "DEPARTMENT_EDIT",
  DepartmentDelete: "DEPARTMENT_DELETE",

  ProjectManage: "PROJECT_MANAGE",
  ProjectPrimaryDepartmentManage: "PROJECT_PRIMARY_DEPARTMENT_MANAGE",
  ProjectView: "PROJECT_VIEW",
  ProjectCreate: "PROJECT_CREATE",
  ProjectEdit: "PROJECT_EDIT",
  ProjectDelete: "PROJECT_DELETE",

  MilestoneManage: "MILESTONE_MANAGE",
  MilestoneView: "MILESTONE_VIEW",
  MilestoneCreate: "MILESTONE_CREATE",
  MilestoneEdit: "MILESTONE_EDIT",
  MilestoneDelete: "MILESTONE_DELETE",

  TaskManage: "TASK_MANAGE",
  TaskView: "TASK_VIEW",
  TaskCreate: "TASK_CREATE",
  TaskEdit: "TASK_EDIT",
  TaskDelete: "TASK_DELETE",
  TaskAssign: "TASK_ASSIGN",
  TaskCommentCreate: "TASK_COMMENT_CREATE",
  TaskAttachmentCreate: "TASK_ATTACHMENT_CREATE",
  TaskTimeTrack: "TASK_TIME_TRACK",

  SubtaskManage: "SUBTASK_MANAGE",
  SubtaskView: "SUBTASK_VIEW",
  SubtaskCreate: "SUBTASK_CREATE",
  SubtaskEdit: "SUBTASK_EDIT",
  SubtaskDelete: "SUBTASK_DELETE",

  UserManage: "USER_MANAGE",
  UserView: "USER_VIEW",
  UserCreate: "USER_CREATE",
  UserEdit: "USER_EDIT",
  UserDelete: "USER_DELETE",
  UserDepartmentManage: "USER_DEPARTMENT_MANAGE",
  UserProfilePictureManage: "USER_PROFILE_PICTURE_MANAGE",

  RoleManage: "ROLE_MANAGE",
  RoleView: "ROLE_VIEW",
  RoleCreate: "ROLE_CREATE",
  RoleEdit: "ROLE_EDIT",
  RoleDelete: "ROLE_DELETE",
  PermissionManage: "PERMISSION_MANAGE",
  PermissionView: "PERMISSION_VIEW",
  PermissionCreate: "PERMISSION_CREATE",
  PermissionEdit: "PERMISSION_EDIT",
  PermissionDelete: "PERMISSION_DELETE",

  NotificationManage: "NOTIFICATION_MANAGE",
  NotificationView: "NOTIFICATION_VIEW",
  NotificationBroadcast: "NOTIFICATION_BROADCAST",
  NotificationTemplateManage: "NOTIFICATION_TEMPLATE_MANAGE",
  NotificationRuleManage: "NOTIFICATION_RULE_MANAGE",

  ActivityLogManage: "ACTIVITY_LOG_MANAGE",
  ActivityLogView: "ACTIVITY_LOG_VIEW",
  ActivityLogCreate: "ACTIVITY_LOG_CREATE",

  ReportManage: "REPORT_MANAGE",
  ReportView: "REPORT_VIEW",
  ReportCreate: "REPORT_CREATE",
  ReportEdit: "REPORT_EDIT",
  ReportDelete: "REPORT_DELETE",

  KnowledgeManage: "KNOWLEDGE_MANAGE",
  KnowledgeView: "KNOWLEDGE_VIEW",
  KnowledgeCreate: "KNOWLEDGE_CREATE",
  KnowledgeEdit: "KNOWLEDGE_EDIT",
  KnowledgeDelete: "KNOWLEDGE_DELETE",

  IntegrationManage: "INTEGRATION_MANAGE",
  IntegrationView: "INTEGRATION_VIEW",
  IntegrationCreate: "INTEGRATION_CREATE",
  IntegrationEdit: "INTEGRATION_EDIT",
  IntegrationDelete: "INTEGRATION_DELETE",

  AiView: "AI_VIEW",
  AiManage: "AI_MANAGE",

  UtilizationCertificateManage: "UTILIZATION_CERTIFICATE_MANAGE",
  UtilizationCertificateView: "UTILIZATION_CERTIFICATE_VIEW",
  UtilizationCertificateCreate: "UTILIZATION_CERTIFICATE_CREATE",
  UtilizationCertificateEdit: "UTILIZATION_CERTIFICATE_EDIT",
  UtilizationCertificateDelete: "UTILIZATION_CERTIFICATE_DELETE",
  UtilizationCertificateReview: "UTILIZATION_CERTIFICATE_REVIEW",
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_GROUPS = {
  system: {
    view: Permission.SystemDatabaseView,
    manage: Permission.SystemAdmin,
  },
  auth: {
    manage: Permission.AuthManage,
  },
  organization: {
    view: Permission.OrganizationView,
    create: Permission.OrganizationCreate,
    edit: Permission.OrganizationEdit,
    delete: Permission.OrganizationDelete,
    manage: Permission.OrganizationManage,
  },
  department: {
    view: Permission.DepartmentView,
    create: Permission.DepartmentCreate,
    edit: Permission.DepartmentEdit,
    delete: Permission.DepartmentDelete,
    manage: Permission.DepartmentManage,
  },
  project: {
    view: Permission.ProjectView,
    create: Permission.ProjectCreate,
    edit: Permission.ProjectEdit,
    delete: Permission.ProjectDelete,
    manage: Permission.ProjectManage,
    primaryDepartmentManage: Permission.ProjectPrimaryDepartmentManage,
  },
  milestone: {
    view: Permission.MilestoneView,
    create: Permission.MilestoneCreate,
    edit: Permission.MilestoneEdit,
    delete: Permission.MilestoneDelete,
    manage: Permission.MilestoneManage,
  },
  task: {
    view: Permission.TaskView,
    create: Permission.TaskCreate,
    edit: Permission.TaskEdit,
    delete: Permission.TaskDelete,
    manage: Permission.TaskManage,
    assign: Permission.TaskAssign,
    comment: Permission.TaskCommentCreate,
    attach: Permission.TaskAttachmentCreate,
    time: Permission.TaskTimeTrack,
  },
  subtask: {
    view: Permission.SubtaskView,
    create: Permission.SubtaskCreate,
    edit: Permission.SubtaskEdit,
    delete: Permission.SubtaskDelete,
    manage: Permission.SubtaskManage,
  },
  user: {
    view: Permission.UserView,
    create: Permission.UserCreate,
    edit: Permission.UserEdit,
    delete: Permission.UserDelete,
    manage: Permission.UserManage,
    department: Permission.UserDepartmentManage,
    profilePicture: Permission.UserProfilePictureManage,
  },
  role: {
    view: Permission.RoleView,
    create: Permission.RoleCreate,
    edit: Permission.RoleEdit,
    delete: Permission.RoleDelete,
    manage: Permission.RoleManage,
  },
  permission: {
    view: Permission.PermissionView,
    create: Permission.PermissionCreate,
    edit: Permission.PermissionEdit,
    delete: Permission.PermissionDelete,
    manage: Permission.PermissionManage,
  },
  notification: {
    view: Permission.NotificationView,
    broadcast: Permission.NotificationBroadcast,
    template: Permission.NotificationTemplateManage,
    rule: Permission.NotificationRuleManage,
    manage: Permission.NotificationManage,
  },
  activityLog: {
    view: Permission.ActivityLogView,
    create: Permission.ActivityLogCreate,
    manage: Permission.ActivityLogManage,
  },
  report: {
    view: Permission.ReportView,
    create: Permission.ReportCreate,
    edit: Permission.ReportEdit,
    delete: Permission.ReportDelete,
    manage: Permission.ReportManage,
  },
  knowledge: {
    view: Permission.KnowledgeView,
    create: Permission.KnowledgeCreate,
    edit: Permission.KnowledgeEdit,
    delete: Permission.KnowledgeDelete,
    manage: Permission.KnowledgeManage,
  },
  integration: {
    view: Permission.IntegrationView,
    create: Permission.IntegrationCreate,
    edit: Permission.IntegrationEdit,
    delete: Permission.IntegrationDelete,
    manage: Permission.IntegrationManage,
  },
  ai: {
    view: Permission.AiView,
    manage: Permission.AiManage,
  },
  utilizationCertificate: {
    view: Permission.UtilizationCertificateView,
    create: Permission.UtilizationCertificateCreate,
    edit: Permission.UtilizationCertificateEdit,
    delete: Permission.UtilizationCertificateDelete,
    review: Permission.UtilizationCertificateReview,
    manage: Permission.UtilizationCertificateManage,
  },
} as const;

export type PermissionModule = keyof typeof PERMISSION_GROUPS;

export const PERMISSION_COVERAGE: Record<string, readonly string[]> = {
  [Permission.AuthManage]: [],
  [Permission.OrganizationManage]: [
    Permission.OrganizationView,
    Permission.OrganizationCreate,
    Permission.OrganizationEdit,
    Permission.OrganizationDelete,
  ],
  [Permission.DepartmentManage]: [
    Permission.DepartmentView,
    Permission.DepartmentCreate,
    Permission.DepartmentEdit,
    Permission.DepartmentDelete,
  ],
  [Permission.ProjectManage]: [
    Permission.ProjectView,
    Permission.ProjectCreate,
    Permission.ProjectEdit,
    Permission.ProjectDelete,
    Permission.ProjectPrimaryDepartmentManage,
  ],
  [Permission.MilestoneManage]: [
    Permission.MilestoneView,
    Permission.MilestoneCreate,
    Permission.MilestoneEdit,
    Permission.MilestoneDelete,
  ],
  [Permission.TaskManage]: [
    Permission.TaskView,
    Permission.TaskCreate,
    Permission.TaskEdit,
    Permission.TaskDelete,
    Permission.TaskAssign,
    Permission.TaskCommentCreate,
    Permission.TaskAttachmentCreate,
    Permission.TaskTimeTrack,
  ],
  [Permission.SubtaskManage]: [
    Permission.SubtaskView,
    Permission.SubtaskCreate,
    Permission.SubtaskEdit,
    Permission.SubtaskDelete,
  ],
  [Permission.UserManage]: [
    Permission.UserView,
    Permission.UserCreate,
    Permission.UserEdit,
    Permission.UserDelete,
    Permission.UserDepartmentManage,
    Permission.UserProfilePictureManage,
  ],
  [Permission.RoleManage]: [
    Permission.RoleView,
    Permission.RoleCreate,
    Permission.RoleEdit,
    Permission.RoleDelete,
  ],
  [Permission.PermissionManage]: [
    Permission.PermissionView,
    Permission.PermissionCreate,
    Permission.PermissionEdit,
    Permission.PermissionDelete,
  ],
  [Permission.NotificationManage]: [
    Permission.NotificationView,
    Permission.NotificationBroadcast,
    Permission.NotificationTemplateManage,
    Permission.NotificationRuleManage,
  ],
  [Permission.ActivityLogManage]: [
    Permission.ActivityLogView,
    Permission.ActivityLogCreate,
  ],
  [Permission.ReportManage]: [
    Permission.ReportView,
    Permission.ReportCreate,
    Permission.ReportEdit,
    Permission.ReportDelete,
  ],
  [Permission.KnowledgeManage]: [
    Permission.KnowledgeView,
    Permission.KnowledgeCreate,
    Permission.KnowledgeEdit,
    Permission.KnowledgeDelete,
  ],
  [Permission.IntegrationManage]: [
    Permission.IntegrationView,
    Permission.IntegrationCreate,
    Permission.IntegrationEdit,
    Permission.IntegrationDelete,
  ],
  [Permission.AiManage]: [
    Permission.AiView,
  ],
  [Permission.UtilizationCertificateManage]: [
    Permission.UtilizationCertificateView,
    Permission.UtilizationCertificateCreate,
    Permission.UtilizationCertificateEdit,
    Permission.UtilizationCertificateDelete,
    Permission.UtilizationCertificateReview,
  ],
};

export function isSuperAdmin(perms: readonly string[] | undefined | null): boolean {
  return Boolean(perms?.includes(Permission.SystemAdmin));
}

export function coversManagedPermission(
  userPermissions: readonly string[] | undefined | null,
  requested: string,
): boolean {
  if (!userPermissions?.length) return false;
  if (userPermissions.includes(Permission.SystemAdmin)) return true;
  if (userPermissions.includes(requested)) return true;
  return Object.entries(PERMISSION_COVERAGE).some(
    ([managePermission, covered]) =>
      userPermissions.includes(managePermission) && covered.includes(requested),
  );
}

export function coversAnyPermission(
  userPermissions: readonly string[] | undefined | null,
  requested: readonly string[],
): boolean {
  if (!requested.length) return true;
  return requested.some((perm) => coversManagedPermission(userPermissions, perm));
}

export function expandPermissions(userPermissions: readonly string[] | undefined | null): string[] {
  const set = new Set<string>();
  if (!userPermissions?.length) return [];
  for (const perm of userPermissions) {
    set.add(perm);
    const covered = PERMISSION_COVERAGE[perm];
    if (covered) {
      for (const scoped of covered) set.add(scoped);
    }
  }
  return Array.from(set);
}

export const RoleKey = {
  SuperAdmin: "superadmin",
  Director: "director",
  ProjectManager: "project-manager",
  DepartmentHead: "department-head",
  TeamMember: "team-member",
  Viewer: "viewer",
} as const;

export type RoleKeyCode = (typeof RoleKey)[keyof typeof RoleKey];

export const ROLE_DISPLAY_NAMES: Record<RoleKeyCode, string> = {
  [RoleKey.SuperAdmin]: "SuperAdmin",
  // Presented as "Admin" throughout the UI. The backend key stays "director", so no
  // permission, guard or API payload changes.
  [RoleKey.Director]: "Admin",
  [RoleKey.ProjectManager]: "ProjectManager",
  [RoleKey.DepartmentHead]: "DepartmentHead",
  [RoleKey.TeamMember]: "TeamMember",
  [RoleKey.Viewer]: "Viewer",
};

export const ROLE_LEVELS: Record<string, number> = {
  [RoleKey.SuperAdmin]: 100,
  [RoleKey.Director]: 90,
  [RoleKey.ProjectManager]: 80,
  [RoleKey.DepartmentHead]: 70,
  [RoleKey.TeamMember]: 40,
  [RoleKey.Viewer]: 10,
};

const LEGACY_ROLE_KEYS: Record<string, RoleKeyCode> = {
  SuperAdmin: RoleKey.SuperAdmin,
  Director: RoleKey.Director,
  ProjectManager: RoleKey.ProjectManager,
  DepartmentHead: RoleKey.DepartmentHead,
  TeamMember: RoleKey.TeamMember,
  Viewer: RoleKey.Viewer,
};

export function normalizeRoleKey(role: string): string {
  return LEGACY_ROLE_KEYS[role] ?? role;
}

/**
 * Display label for a role, given either its backend key ("director") or the role name
 * stored on the user ("Director"). Use this anywhere a role is shown to a user so the
 * relabelled roles read the same everywhere.
 */
export function roleDisplayName(role: string | null | undefined): string {
  const trimmed = role?.trim();
  if (!trimmed) return "";
  const key = normalizeRoleKey(trimmed) as RoleKeyCode;
  return ROLE_DISPLAY_NAMES[key] ?? trimmed;
}

/** Display labels for a list of roles, dropping any empty entries. */
export function roleDisplayNames(roles: readonly string[] | null | undefined): string[] {
  return (roles ?? []).map(roleDisplayName).filter(Boolean);
}

export function hasRoleKey(roles: readonly string[] | undefined | null, roleKey: RoleKeyCode): boolean {
  return Boolean(roles?.some((role) => normalizeRoleKey(role) === roleKey));
}

export function hasAnyRoleKey(roles: readonly string[] | undefined | null, roleKeys: readonly RoleKeyCode[]): boolean {
  return roleKeys.some((roleKey) => hasRoleKey(roles, roleKey));
}

export function getModuleGroup(module: PermissionModule) {
  return PERMISSION_GROUPS[module];
}

export function moduleManage(module: PermissionModule): string | undefined {
  const group = PERMISSION_GROUPS[module] as Record<string, string>;
  return group.manage;
}

export function moduleView(module: PermissionModule): string | undefined {
  const group = PERMISSION_GROUPS[module] as Record<string, string>;
  return group.view;
}
