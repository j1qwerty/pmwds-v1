export type Role = string;

export type RoleKey =
  | "superadmin"
  | "director"
  | "project-manager"
  | "department-head"
  | "team-member"
  | "viewer";

export interface AuthResponse {
  token: string;
  expiry: string;
  refreshToken?: string;
  refreshTokenExpiry?: string;
  userId: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string | null;
  roles: Role[];
  roleKeys?: RoleKey[];
  permissions: string[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string | null;
  jobTitle?: string | null;
  organizationId?: string | null;
  department?: string | null;
  departmentId?: string | null;
  departments: UserDepartmentAssignment[];
  profileId?: string | null;
  bio?: string | null;
  availabilityStatus: string;
  availabilityPercentage: number;
  aiWorkloadScore: number;
  aiBurnoutRiskScore: number;
  aiPerformanceScore: number;
  activeTaskCount: number;
  isActive: boolean;
  lastLoginDate?: string | null;
  roles: string[];
  roleKeys?: RoleKey[];
  skills: string[];
  skillDetails?: UserSkillAssignment[];
}

export interface UserSkillAssignment {
  skillId: string;
  skillName: string;
  proficiencyLevel: number;
  experienceMonths: number;
  lastUsed?: string | null;
}

export interface UserDepartmentAssignment {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  organizationId?: string | null;
  organizationName?: string | null;
  isPrimary: boolean;
}

export interface PermissionRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  isGlobal: boolean;
}

export interface RoleRecord {
  id: string;
  key: RoleKey | string;
  name: string;
  description: string;
  permissionLevel: number;
  permissions: PermissionRecord[];
}

export interface UserProfileRecord {
  id: string;
  userId: string;
  bio?: string | null;
  jobTitle?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  linkedInUrl?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  organizationId?: string | null;
  parentDepartmentId?: string | null;
  departmentHeadUserId?: string | null;
  maxCapacity: number;
  capacityUtilization: number;
}

export interface ProjectSummary {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  progressPercentage: number;
  aiHealthScore: number;
  aiDelayRiskScore: number;
}

export interface MilestoneDependency {
  id: string;
  projectId: string;
  prerequisiteMilestoneId: string;
  prerequisiteMilestoneName?: string;
  dependentMilestoneId: string;
  dependentMilestoneName?: string;
  type: "CompletionBased" | "ProgressThreshold";
  thresholdPercentage?: number;
  isMet: boolean;
}

export interface DependencyStatus {
  isBlocked: boolean;
  blockedByMessage?: string;
  dependencies: MilestoneDependency[];
}

export interface Milestone {
  id: string;
  projectId: string;
  departmentId?: string | null;
  departmentName?: string | null;
  name: string;
  description: string;
  order: number;
  dueDate: string;
  completedDate?: string | null;
  status: string;
  isCritical: boolean;
  progressPercentage: number;
  hasTasks?: boolean;
  isBlocked?: boolean;
  blockedByMessage?: string;
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  priority: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  plannedBudget: number;
  actualCost: number;
  budgetVariance: number;
  progressPercentage: number;
  aiHealthScore: number;
  aiDelayRiskScore: number;
  aiBudgetRiskScore: number;
  aiInsightsSummary?: string | null;
  departmentId: string;
  departmentName?: string | null;
  departmentIds?: string[];
  departments?: ProjectDepartmentAssignment[];
  projectManagerId: string;
  projectManagerName?: string | null;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMilestones?: number;
  completedMilestones?: number;
  createdDate: string;
  isNewForCurrentUser?: boolean;
}

export interface ProjectDepartmentAssignment {
  departmentId: string;
  departmentName?: string | null;
  isPrimary: boolean;
}

export interface ProjectNavigationItem {
  id: string;
  projectCode: string;
  name: string;
  status: string;
  priority: string;
  departmentId: string;
  departmentIds: string[];
  progressPercentage: number;
  aiDelayRiskScore: number;
  totalTasks: number;
  isNewForCurrentUser: boolean;
  createdDate: string;
}

export interface WorkspaceBootstrap {
  generatedAt: string;
  currentUser: User;
  permissions: string[];
  projects: ProjectNavigationItem[];
  unreadNotificationCount: number;
  userPageSize: number;
}

export interface WorkspaceSnapshot {
  generatedAt: string;
  currentUser: User;
  permissions: string[];
  projects: ProjectNavigationItem[];
  organizations: WorkspaceOrganizationSnapshot[];
  departments: Department[];
  users: WorkspaceUserSnapshot[];
  unreadNotificationCount: number;
  userPageSize: number;
}

export interface WorkspaceOrganizationSnapshot {
  id: string;
  name: string;
  taxId?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  foundedDate?: string | null;
  departmentCount: number;
}

export interface WorkspaceUserSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string | null;
  jobTitle?: string | null;
  organizationId?: string | null;
  department?: string | null;
  departmentId?: string | null;
  availabilityPercentage: number;
  aiWorkloadScore: number;
  aiBurnoutRiskScore: number;
  aiPerformanceScore: number;
  activeTaskCount: number;
  isActive: boolean;
  roles: string[];
  roleKeys: RoleKey[];
}


export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  completedDate?: string | null;
  estimatedHours: number;
  actualHours: number;
  progressPercentage: number;
  projectId: string;
  projectName?: string | null;
  milestoneId?: string | null;
  milestoneName?: string | null;
  parentTaskId?: string | null;
  assignedToUserId?: string | null;
  assignedToUserName?: string | null;
  assignees?: TaskAssignee[];
  isEscalated: boolean;
  escalationLevel: number;
  escalatedDate?: string | null;
  aiDelayProbability: number;
  aiRiskFactors?: string | null;
  isOverdue: boolean;
  createdDate: string;
  dependencies?: TaskDependency[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  subTasks?: Task[];
  hasSubTasks?: boolean;
  aiOptimalAssigneeScore?: number;
  aiPredictedCompletionDate?: string | null;
  aiRecommendedAssigneeId?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdDate: string;
  readDate?: string | null;
  actionUrl?: string | null;
}

export interface NotificationTemplateRecord {
  id: string;
  templateType: string;
  subjectTemplate: string;
  bodyTemplate: string;
  variables: string[];
  supportedChannels: string[];
}

export interface AlertRuleRecord {
  id: string;
  name: string;
  conditionType: string;
  conditionExpression: string;
  actionType: string;
  actionParameters: Record<string, unknown>;
  isEnabled: boolean;
  lastTriggered?: string | null;
}

export interface OrganizationDepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  taxId: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  foundedDate: string;
  director?: {
    id: string;
    fullName: string;
    email: string;
    profilePictureUrl?: string | null;
  } | null;
  departments: OrganizationDepartmentSummary[];
  departmentCount: number;
}

export interface DashboardWidgetRecord {
  id: string;
  dashboardId: string;
  widgetType: string;
  title: string;
  configuration: Record<string, unknown>;
  refreshInterval: number;
  lastRefreshed: string;
  requiredPermissions: string[];
  displayOrder: number;
}

export interface DashboardRecord {
  id: string;
  userId: string;
  name: string;
  layoutType: string;
  isDefault: boolean;
  lastAccessed: string;
  widgets: DashboardWidgetRecord[];
}

export interface AiReportResponse {
  id: string;
  reportType: string;
  title: string;
  summary: string;
  metrics: ReportMetric[];
  tables: ReportTable[];
  sections: ReportSection[];
  insights: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface ReportMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  icon: string;
  color: string;
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface ReportSection {
  title: string;
  content: string;
  type: string;
}

export interface StoredReportRecord {
  id: string;
  name: string;
  reportType: string;
  parameters: Record<string, unknown>;
  generatedDate: string;
  format: string;
  generatedByUserId: string;
  sizeBytes: number;
}

export interface ReportScheduleRecord {
  id: string;
  reportId: string;
  frequency: string;
  nextRun: string;
  lastRun?: string | null;
  recipients: string[];
  deliveryOptions: Record<string, unknown>;
  isActive: boolean;
}

export interface StoredReportDetailRecord {
  report: StoredReportRecord;
  schedules: ReportScheduleRecord[];
}

export interface IntegrationRecord {
  id: string;
  integrationType: string;
  name: string;
  configuration: Record<string, unknown>;
  isEnabled: boolean;
  lastSync?: string | null;
  status: string;
}

export interface WebhookRecord {
  id: string;
  integrationId?: string | null;
  eventType: string;
  callbackUrl: string;
  headers: string[];
  isActive: boolean;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  attemptedAt: string;
  statusCode: number;
  responseBody: string;
  success: boolean;
  errorMessage?: string | null;
}

export interface WebhookDetailRecord {
  webhook: WebhookRecord;
  deliveries: WebhookDeliveryRecord[];
}

export interface IntegrationDetailRecord {
  integration: IntegrationRecord;
  webhooks: WebhookRecord[];
}

export interface SkillRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  userCount: number;
  organizationId?: string | null;
  createdBy?: string | null;
}

export interface KnowledgeArticleRecord {
  id: string;
  projectId?: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorId: string;
  createdDate: string;
  lastUpdated: string;
  viewCount: number;
  relevanceScore: number;
}

export interface LessonLearnedRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: string;
  impact: string;
  keywords: string[];
  recordedDate: string;
}

export interface ActivityLogRecord {
  id: string;
  userId: string;
  userName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  activityType: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface WorkloadMember {
  userId: string;
  fullName: string;
  jobTitle?: string | null;
  availabilityPercent: number;
  workloadScore: number;
  burnoutRisk: number;
  performanceScore: number;
  activeTaskCount: number;
  completedThisMonth: number;
  skills: string[];
  status: string;
}

export interface WorkloadReport {
  departmentId?: string | null;
  totalMembers: number;
  availableCount: number;
  overloadedCount: number;
  averageWorkload: number;
  averageBurnoutRisk: number;
  members: WorkloadMember[];
  generatedAt: string;
}

export interface ProjectDashboardData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  delayedProjects: number;
  overdueProjects: number;
  highRiskProjects: number;
  averageHealthScore: number;
  totalBudget: number;
  totalActualCost: number;
  recentProjects: ProjectSummary[];
  atRiskProjects: ProjectSummary[];
  recentProjectPreviews: ProjectSummary[];
}

export interface DashboardData {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  escalatedTasks: number;
  totalTeamMembers: number;
  availableMembers: number;
  overallHealthScore: number;
  overallDelayRisk: number;
  totalBudget: number;
  totalActualCost: number;
  budgetVariance: number;
  highRiskProjects: ProjectSummary[];
  recentEscalations: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
    aiDelayProbability: number;
    isEscalated: boolean;
  }>;
  projectHealthBreakdown: Array<{
    id: string;
    name: string;
    healthScore: number;
    delayRisk: number;
    status: string;
  }>;
  workloadDistribution: Array<{
    userId: string;
    fullName: string;
    workloadScore: number;
    burnoutRisk: number;
    activeTasks: number;
  }>;
  departmentWorkloadDistribution: Array<{
    departmentId: string;
    departmentName: string;
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    workloadScore: number;
    memberCount: number;
  }>;
  taskCompletionTrend: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
  generatedAt: string;
}

export interface AIProvider {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  isConfigured: boolean;
  defaultModel: string;
  baseUrl: string;
}

export interface AIModel {
  provider: string;
  id: string;
  name: string;
  contextLength?: number | null;
  description?: string | null;
}

export interface AIProviderTestResult {
  provider: string;
  model: string;
  success: boolean;
  message: string;
  rawResponse?: string | null;
  executedAtUtc: string;
}

export interface ChatResponse {
  message: string;
  intent: string;
  suggestedActions: string[];
  contextData?: unknown;
  requiresConfirmation: boolean;
}

export interface AlternativeAssignee {
  userId: string;
  userName: string;
  score: number;
  reason: string;
}

export interface DelayPrediction {
  taskId: string;
  delayProbability: number;
  expectedDelayDays: number;
  predictedCompletionDate: string;
  riskLevel: string;
  contributingFactors: string[];
  mitigationStrategies: string[];
  shouldEscalate: boolean;
}

export interface AssigneeRecommendation {
  taskId: string;
  recommendedUserId: string;
  recommendedUserName: string;
  confidenceScore: number;
  rationale: string[];
  alternatives: AlternativeAssignee[];
  featureScores: Record<string, number>;
  generatedAt: string;
}

export interface AllocationRecommendationRecord {
  id: string;
  taskId: string;
  modelId: string;
  recommendedUserId: string;
  matchScore: number;
  rationale: string[];
  featureScores: Record<string, number>;
  alternatives: AlternativeAssignee[];
  status: string;
  decisionReason?: string | null;
  createdDate: string;
}

export interface DelayPredictionRecord {
  id: string;
  taskId: string;
  modelId: string;
  delayProbability: number;
  expectedDelayDays: number;
  predictedCompletionDate: string;
  riskLevel: string;
  contributingFactors: string[];
  factorWeights: Record<string, number>;
  mitigationStrategies: string[];
  shouldEscalate: boolean;
  createdDate: string;
}

export interface PredictionResultRecord {
  id: string;
  modelId: string;
  taskId?: string | null;
  predictionDate: string;
  inputFeatures: Record<string, unknown>;
  outputPredictions: Record<string, unknown>;
  confidenceScore: number;
  recommendation: string;
}

export interface TaskAnalysisRecord {
  taskId: string;
  taskTitle: string;
  candidateCount: number;
  summary: string;
  inputFeatures: Record<string, unknown>;
  keyFactors: string[];
  generatedAt: string;
}

export interface BurnoutRiskRecord {
  userId: string;
  fullName: string;
  burnoutRisk: number;
  workloadScore: number;
  activeTasks: number;
  riskLevel: string;
  recommendations: string[];
}

export interface ReallocationSuggestion {
  taskId: string;
  taskTitle: string;
  currentAssigneeId: string;
  currentAssigneeName: string;
  suggestedAssigneeId: string;
  suggestedAssigneeName: string;
  reason: string;
  improvementScore: number;
}

export interface ResourceOptimizationRecord {
  projectId: string;
  suggestions: ReallocationSuggestion[];
  expectedEfficiencyGain: number;
  tasksAtRisk: number;
  actionPlan: string[];
  generatedAt: string;
}

export interface AIModelRecord {
  id: string;
  name: string;
  version: string;
  modelType: string;
  createdDate: string;
  lastTrainedDate?: string | null;
  accuracyScore: number;
  precisionScore: number;
  recallScore: number;
  modelPath?: string | null;
  hyperparameters: Record<string, number>;
  features: string[];
  predictionCount: number;
}

export interface TrainingDataPointRecord {
  id: string;
  dataType: string;
  features: Record<string, unknown>;
  labels: Record<string, unknown>;
  createdDate: string;
  source: string;
}

export interface ProjectHealth {
  projectId: string;
  projectName: string;
  overallHealthScore: number;
  scheduleHealth: number;
  budgetHealth: number;
  teamHealth: number;
  qualityHealth: number;
  healthStatus: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  risks: Array<{
    category: string;
    description: string;
    probability: number;
    severity: string;
    mitigationStrategy: string;
  }>;
  generatedAt: string;
}

export interface AISettingsRequest {
  defaultProvider: string;
  defaultModel: string;
  riskThreshold: number;
  useLocalModel: boolean;
  mlModelPath: string;
  providers: AIProviderConfigRequest[];
}

export interface AIProviderConfigRequest {
  provider: string;
  displayName: string;
  enabled: boolean;
  useEnvironmentDefault: boolean;
  baseUrl: string;
  defaultModel: string;
}

export interface AISettingsResponse {
  defaultProvider: string;
  defaultModel: string;
  riskThreshold: number;
  useLocalModel: boolean;
  mlModelPath: string;
  providers: AIProviderConfig[];
}

export interface AIProviderConfig {
  provider: string;
  displayName: string;
  enabled: boolean;
  useEnvironmentDefault: boolean;
  baseUrl: string;
  defaultModel: string;
}

export interface TaskAssignee {
  userId: string;
  fullName?: string | null;
}

export interface TaskDependency {
  id: string;
  predecessorTaskId: string;
  predecessorTaskTitle?: string | null;
  successorTaskId: string;
  successorTaskTitle?: string | null;
  type: string;
  lagDays: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  isSystemGenerated: boolean;
  parentCommentId?: string | null;
  createdDate: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByUserId: string;
  createdDate: string;
}

export type DocumentCategory =
  | "General"
  | "Plan"
  | "Report"
  | "Contract"
  | "Compliance"
  | "Financial"
  | "UtilizationCertificate";

export interface ProjectDocument {
  id: string;
  projectId: string;
  title: string;
  filePath: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByUserId: string;
  description?: string | null;
  version: string;
  category?: DocumentCategory;
  createdDate: string;
}

export type UtilizationCertificateStatus =
  | "Draft"
  | "Submitted"
  | "UnderReview"
  | "Approved"
  | "Rejected";

export interface UtilizationCertificate {
  id: string;
  projectId: string;
  documentId: string;
  certificateNumber: string;
  fundingSource: string;
  amountClaimed: number;
  amountUtilized: number;
  unutilizedAmount: number;
  utilizationPercentage: number;
  periodStart: string;
  periodEnd: string;
  status: UtilizationCertificateStatus;
  milestoneId?: string | null;
  taskId?: string | null;
  milestoneTitle?: string | null;
  taskTitle?: string | null;
  purpose?: string | null;
  submittedByUserId: string;
  submittedOn?: string | null;
  reviewedByUserId?: string | null;
  reviewedOn?: string | null;
  reviewNotes?: string | null;
  createdDate: string;
  // Denormalized document info.
  title: string;
  filePath: string;
  contentType: string;
  fileSizeBytes: number;
  capabilities: UtilizationCertificateCapabilities;
}

export interface SubmitUtilizationCertificatePayload {
  projectId: string;
  certificateNumber: string;
  fundingSource: string;
  amountClaimed: number;
  amountUtilized: number;
  periodStart: string;
  periodEnd: string;
  milestoneId?: string | null;
  taskId?: string | null;
  purpose?: string | null;
  title?: string | null;
  description?: string | null;
}

export type UpdateUtilizationCertificatePayload = Omit<
  SubmitUtilizationCertificatePayload,
  "projectId"
>;

export interface UtilizationCertificateCapabilities {
  /** Resolved server-side, so the UI never disagrees with the API. */
  canEdit: boolean;
  canSubmitForReview: boolean;
  canReview: boolean;
  canDelete: boolean;
  isOwner: boolean;
}


