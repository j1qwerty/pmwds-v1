# System Architecture - Domain Diagrams

## 1. Authentication & User Domain

```mermaid
classDiagram
class User {
    +Guid UserId
    +string Email
    +string FirstName
    +string LastName
    +string HashedPassword
    +string Salt
    +DateTime CreatedDate
    +bool IsActive
    +string PhoneNumber
    +string ProfilePictureUrl
    +string TimeZone
    +Authenticate(password: string): bool
    +UpdateProfile(profileData: UserProfile): void
    +ChangePassword(oldPassword: string, newPassword: string): bool
    +GeneratePasswordResetToken(): string
    +ValidatePasswordResetToken(token: string): bool
}

class UserProfile {
    +Guid ProfileId
    +Guid UserId
    +string Bio
    +string JobTitle
    +DateTime DateOfBirth
    +string Address
    +string EmergencyContact
    +string LinkedInUrl
    +UpdateProfileDetails(details: object): void
    +GetFullProfile(): UserProfile
}

class Role {
    +Guid RoleId
    +string Name
    +string Description
    +int PermissionLevel
    +AddPermission(permission: Permission): void
    +RemovePermission(permissionId: Guid): void
    +CheckPermission(permissionCode: string): bool
    +Clone(): Role
}

class Permission {
    +Guid PermissionId
    +string Code
    +string Name
    +string Description
    +string Module
    +bool IsGlobal
    +Validate(): bool
}

class UserSkill {
    +Guid UserSkillId
    +Guid UserId
    +Guid SkillId
    +int ProficiencyLevel
    +DateTime LastUsed
    +int ExperienceMonths
    +double ConfidenceScore
    +CalculateProficiencyScore(): double
    +UpdateExperience(months: int): void
    +IncrementUsage(): void
}

class Skill {
    +Guid SkillId
    +string Name
    +string Category
    +string Description
    +int BaseProficiencyRequired
    +List~string~ RelatedSkills
    +AddRelatedSkill(skillId: Guid): void
    +RemoveRelatedSkill(skillId: Guid): void
    +GetSkillGap(userSkills: List~UserSkill~): List~Skill~
}

User "1" -- "*" UserSkill
Skill "1" -- "*" UserSkill
User "1" -- "*" Role
Role "1" -- "*" Permission
User "1" -- "1" UserProfile
```

---

## 2. Department & Organization Domain

```mermaid
classDiagram
 class Department {
 +Guid DepartmentId
 +string Name
 +string Code
 +Guid? ParentDepartmentId
 +Guid DepartmentHeadId
 +string Description
 +DateTime EstablishedDate
 +int MemberCount

 +AddMember(userId: Guid): bool
 +RemoveMember(userId: Guid): bool
  +GetAllMembers(): List~User~
 +GetSubDepartments(): List~Department~
 +CalculateWorkload(): Dictionary~string, double~
 }
 class Organization {
 +Guid OrganizationId
 +string Name
 +string TaxId
 +string Address
 +string ContactEmail
 +string ContactPhone
 +DateTime FoundedDate

 +AddDepartment(department: Department): void
 +RemoveDepartment(departmentId: Guid): bool
 +GetOrganizationHierarchy(): Tree~Department~
 +GetTotalEmployees(): int
 }

Department "1" -- "*" Department
Department "1" -- "*" User
```

---

## 3. Project Management Domain

```mermaid
classDiagram
class Project {
 +Guid ProjectId
 +string ProjectCode
 +string Name
 +string Description
 +Guid DepartmentId
 +Guid ProjectManagerId
 +DateTime StartDate
 +DateTime? EndDate
 +DateTime EstimatedEndDate
 +decimal Budget
 +decimal ActualCost
 +string Status
 +string Priority
 +string ClientName
 +Dictionary~string, string~ Metadata

 +CalculateProgress(): double
 +UpdateStatus(newStatus: string): void
 +AddMilestone(milestone: Milestone): void
 +GetActiveTasks(): List~Task~
 +GetDelayedTasks(): List~Task~
 +CalculateBudgetVariance(): decimal
 +GenerateProjectCode(): string
 }
 class Milestone {
 +Guid MilestoneId
 +Guid ProjectId
 +string Name
 +string Description
 +DateTime DueDate
 +DateTime? CompletedDate
 +string Status
 +int Order
 +Dictionary~string, object~ CustomFields

 +CalculateProgress(): double
 +MarkComplete(): void
 +UpdateDueDate(newDate: DateTime): void
 +GetDependentTasks(): List~Task~
 +IsCritical(): bool
 }
 class Task {
 +Guid TaskId
 +Guid? ParentTaskId
 +Guid ProjectId
 +Guid? MilestoneId
 +string Title
 +string Description
 +Guid? AssignedToUserId
 +Guid? AssignedByUserId
 +DateTime CreatedDate
 +DateTime StartDate
 +DateTime DueDate
 +DateTime? CompletedDate
 +string Status
 +string Priority
 +int EstimatedHours
 +double ProgressPercentage
 +List~Guid~ Dependencies
 +List~string~ Tags

 +UpdateProgress(percentage: double, notes: string): void
 +AddDependency(taskId: Guid): void
 +RemoveDependency(taskId: Guid): void
 +AssignToUser(userId: Guid, assignerId: Guid): void
 +Complete(): void
 +IsOverdue(): bool
 +GetSubTasks(): List~Task~
 }
 class SubTask {
 +Guid SubTaskId
 +Guid TaskId
 +string Description
 +bool IsCompleted
 +DateTime? CompletedDate
 +int Order

 +MarkComplete(): void
 +Reorder(newOrder: int): void
 }
 class TaskDependency {
 +Guid DependencyId
 +Guid PredecessorTaskId
 +Guid SuccessorTaskId
 +string DependencyType
 +int LagDays

 +Validate(): bool
 +GetCriticalPath(): List~Guid~
 }
 Project "1" -- "*" Milestone
Project "1" -- "*" Task
Task "1" -- "*" SubTask
Task "1" -- "*" TaskDependency
```

---

## 4. AI & ML Domain
``` mermaid
classDiagram

class AIModel {
    +Guid ModelId
    +string Name
    +string Version
    +string ModelType
    +DateTime CreatedDate
    +DateTime LastTrainedDate
    +double AccuracyScore
    +double PrecisionScore
    +double RecallScore
    +string ModelPath
    +Dictionary~string, double~ Hyperparameters
    +List~string~ Features

    +Train(trainingData: List~TrainingDataPoint~): TrainingResult
    +Predict(input: Dictionary~string, object~): PredictionResult
    +Evaluate(testData: List~TestDataPoint~): EvaluationResult
    +SaveModel(): void
    +LoadModel(): void
    +GetFeatureImportance(): Dictionary~string, double~
}

class PredictionResult {
    +Guid PredictionId
    +Guid ModelId
    +DateTime PredictionDate
    +Dictionary~string, object~ InputFeatures
    +Dictionary~string, object~ OutputPredictions
    +double ConfidenceScore
    +string Recommendation

    +ToJson(): string
    +GetExplanation(): string
}

class TrainingDataPoint {
    +Guid DataPointId
    +string DataType
    +Dictionary~string, object~ Features
    +Dictionary~string, object~ Labels
    +DateTime CreatedDate
    +string Source

    +Validate(): bool
    +ToFeatureVector(): double[]
    +ToLabelVector(): double[]
}

class TaskAllocationModel {
    +TaskAllocationModel()
    +PredictOptimalAssignee(task: Task, candidates: List~User~): AllocationRecommendation
    +CalculateMatchScore(task: Task, user: User): double
    +GetAssignmentRationale(task: Task, user: User): string
    +UpdateFromFeedback(feedback: AllocationFeedback): void
}

class DelayPredictionModel {
    +DelayPredictionModel()
    +PredictDelayProbability(task: Task): DelayPrediction
    +PredictCompletionDate(task: Task): DateTime
    +GetRiskFactors(task: Task): List~RiskFactor~
    +CalculateConfidenceInterval(task: Task): Tuple~DateTime, DateTime~
}

class AllocationRecommendation {
    +Guid RecommendationId
    +Guid TaskId
    +Guid RecommendedUserId
    +double MatchScore
    +List~string~ Rationale
    +Dictionary~string, double~ FeatureScores

    +Accept(): void
    +Reject(reason: string): void
    +GetAlternativeRecommendations(count: int): List~AllocationRecommendation~
}

class DelayPrediction {
    +Guid PredictionId
    +Guid TaskId
    +double DelayProbability
    +int ExpectedDelayDays
    +DateTime PredictedCompletionDate
    +List~string~ ContributingFactors
    +Dictionary~string, double~ FactorWeights

    +GetRiskLevel(): string
    +GetMitigationStrategies(): List~string~
    +ShouldEscalate(): bool
}


AIModel <|-- TaskAllocationModel
AIModel <|-- DelayPredictionModel
```
---

## 5. Notification Domain

```mermaid
classDiagram
 class Notification {
 +Guid NotificationId
 +Guid UserId
 +string Type
 +string Title
 +string Message
 +DateTime CreatedDate
 +DateTime? ReadDate
 +string Priority
 +Dictionary~string, string~ Metadata
 +bool IsActionable
 +string ActionUrl

 +MarkAsRead(): void
 +Archive(): void
 +GetFormattedMessage(): string
 +TriggerAction(): void
 }
 class NotificationTemplate {
 +Guid TemplateId
 +string TemplateType
 +string SubjectTemplate
 +string BodyTemplate
 +Dictionary~string, string~ Variables
  +List~string~ SupportedChannels

 +GenerateNotification(data: Dictionary~string, object~): Notification
 +ValidateTemplate(): bool
 +TestTemplate(testData: Dictionary~string, object~): string
 }
 class AlertRule {
 +Guid RuleId
 +string Name
 +string ConditionType
 +string ConditionExpression
 +string ActionType
 +Dictionary~string, string~ ActionParameters
 +bool IsEnabled
 +DateTime? LastTriggered

 +Evaluate(context: object): bool
 +TriggerAction(context: object): void
 +ValidateRule(): bool
 }

NotificationTemplate "1" -- "*" Notification
```

---

## 6. Analytics & Reporting Domain

```mermaid
classDiagram
 class Dashboard {
 +Guid DashboardId
 +Guid UserId
 +string Name
 +string LayoutType
 +List~DashboardWidget~ Widgets
 +bool IsDefault
 +DateTime LastAccessed

 +AddWidget(widget: DashboardWidget): void
 +RemoveWidget(widgetId: Guid): void
 +ReorderWidgets(order: List~Guid~): void
 +RefreshData(): void
 +GetDashboardData(): Dictionary~string, object~
 }
 class DashboardWidget {
 +Guid WidgetId
 +string WidgetType
 +string Title
 +Dictionary~string, object~ Configuration
 +int RefreshInterval
 +DateTime LastRefreshed
 +List~string~ RequiredPermissions

 +Render(): object
 +GetData(): object
 +UpdateConfig(config: Dictionary~string, object~): void
 +ValidatePermissions(user: User): bool
 }
 class Report {
 +Guid ReportId
 +string Name
 +string ReportType
 +Dictionary~string, object~ Parameters
 +DateTime GeneratedDate
 +string Format
 +byte[] Data
 +Guid GeneratedByUserId
 
 +Generate(): byte[]
 +Export(format: string): byte[]
 +Schedule(schedule: ReportSchedule): void
 +GetInsights(): List~string~
 }
 class ReportSchedule {
 +Guid ScheduleId
 +Guid ReportId
 +string Frequency
 +DateTime NextRun
 +DateTime? LastRun
 +List~string~ Recipients
 +Dictionary~string, string~ DeliveryOptions

 +CalculateNextRun(): DateTime
 +Execute(): void
 +UpdateSchedule(newSchedule: object): void
 }

Dashboard "1" -- "*" DashboardWidget
Report "1" -- "1" ReportSchedule
```

---

## 7. Integration Domain

```mermaid
classDiagram
class Integration {
 +Guid IntegrationId
 +string IntegrationType
 +string Name
 +Dictionary~string, string~ Configuration
 +bool IsEnabled
 +DateTime LastSync
 +string Status

 +TestConnection(): bool
 +Sync(): SyncResult
 +GetStatus(): IntegrationStatus
 +UpdateConfig(config: Dictionary~string, string~): void
 }
 class Webhook {
 +Guid WebhookId
 +string EventType
 +string CallbackUrl
 +string Secret
 +bool IsActive
 +List~string~ Headers

 +Trigger(payload: object): bool
 +ValidateSignature(signature: string, payload: string): bool
 +Disable(): void
 +GetRecentDeliveries(): List~WebhookDelivery~
 }
 class WebhookDelivery {
 +Guid DeliveryId
 +Guid WebhookId
 +DateTime AttemptedAt
 +int StatusCode
 +string ResponseBody
 +bool Success
 +string ErrorMessage

 +Retry(): bool
 +GetDetails(): object
 }

Webhook "1" -- "*" WebhookDelivery
Integration "1" -- "*" Webhook
```

---

## 8. Knowledge Management Domain

```mermaid
classDiagram
 class KnowledgeArticle {
 +Guid ArticleId
 +string Title
 +string Content
 +string Category
 +List~string~ Tags
 +Guid AuthorId
 +DateTime CreatedDate
 +DateTime LastUpdated
 +int ViewCount
 +double RelevanceScore

 +UpdateContent(newContent: string): void
 +AddTag(tag: string): void
 +RemoveTag(tag: string): void
 +IncrementViewCount(): void
 +CalculateRelevanceScore(query: string): double
 }
 class LessonLearned {
 +Guid LessonId
 +Guid ProjectId
 +string Title
 +string Description
 +string Category
 +string Impact
 +List~string~ Keywords
 +DateTime RecordedDate

 +ExtractFromProject(project: Project): void
 +GetSimilarLessons(): List~LessonLearned~
 +CalculateReuseProbability(): double
 }
```

---

## 9. Audit & Logging Domain

```mermaid
classDiagram
 class AuditLog {
 +Guid LogId
 +DateTime Timestamp
 +string Action
 +Guid UserId
 +string EntityType
 +Guid EntityId
 +Dictionary~string, object~ OldValues
 +Dictionary~string, object~ NewValues
 +string IPAddress
 +string UserAgent

 +ToJson(): string
 +GetChangeSummary(): string
 +Revert(): bool
 }
 class ActivityLog {
 +Guid ActivityId
 +Guid UserId
 +string ActivityType
 +string Description
 +DateTime Timestamp
 Dictionary~string, object~ Metadata

 +LogActivity(): void
 +GetRecentActivities(userId: Guid, count: int): List~ActivityLog~
 }
```

---
## 10. Service Layer

```mermaid
classDiagram
class ProjectService {
    +ProjectService(projectRepository: IProjectRepository, taskService: TaskService)
    +CreateProject(projectData: CreateProjectDto): Project
    +UpdateProject(projectId: Guid, updates: UpdateProjectDto): Project
    +DeleteProject(projectId: Guid): bool
    +GetProjectProgress(projectId: Guid): ProjectProgressDto
    +CalculateProjectHealth(projectId: Guid): ProjectHealthScore
    +GetProjectTimeline(projectId: Guid): ProjectTimeline
    +GenerateProjectReport(projectId: Guid, format: string): Report
}

class TaskService {
    +TaskService(taskRepository: ITaskRepository, aiService: AIService)
    +CreateTask(taskData: CreateTaskDto): Task
    +AssignTask(taskId: Guid, assigneeId: Guid): Task
    +GetOptimalAssignee(taskId: Guid): AllocationRecommendation
    +UpdateTaskProgress(taskId: Guid, progress: double, notes: string): Task
    +CompleteTask(taskId: Guid): Task
    +GetTaskDependencies(taskId: Guid): List~TaskDependency~
    +CalculateCriticalPath(projectId: Guid): List~Task~
    +PredictTaskCompletion(taskId: Guid): DelayPrediction
}

class AIService {
    +AIService(taskAllocationModel: TaskAllocationModel, delayPredictionModel: DelayPredictionModel)
    +AnalyzeTaskForAllocation(task: Task): TaskAnalysis
    +PredictProjectDelays(projectId: Guid): List~DelayPrediction~
    +GenerateInsights(projectId: Guid): List~string~
    +OptimizeResourceAllocation(projectId: Guid): ResourceAllocationPlan
    +TrainModels(trainingData: List~TrainingDataPoint~): TrainingResults
    +GetModelPerformance(): Dictionary~string, double~
    +ExplainRecommendation(recommendationId: Guid): string
}

class NotificationService {
    +NotificationService(notificationRepository: INotificationRepository, emailService: IEmailService)
    +SendNotification(notification: Notification): bool
    +CreateNotificationTemplate(template: NotificationTemplate): Guid
    +GetUserNotifications(userId: Guid, unreadOnly: bool): List~Notification~
    +MarkAsRead(notificationId: Guid): void
    +BulkSend(notifications: List~Notification~): BulkSendResult
    +ScheduleNotification(notification: Notification, schedule: DateTime): void
}

class ReportService {
    +ReportService(reportRepository: IReportRepository, dataService: IDataService)
    +GenerateStandardReport(reportType: string, parameters: Dictionary~string, object~): Report
    +CreateCustomReport(config: ReportConfig): Report
    +ScheduleReport(schedule: ReportSchedule): Guid
    +GetReportTemplates(): List~ReportTemplate~
    +ExportReport(reportId: Guid, format: string): byte[]
    +GenerateAIInsights(reportData: object): List~string~
}

ProjectService --> TaskService
TaskService --> AIService
ReportService --> AIService
NotificationService --> IEmailService

```

--- 

## 11. Interfaces

```mermaid
classDiagram

class IRepository~T~ {
    <<interface>>
    +GetById(id: Guid): T
    +GetAll(): List~T~
    +Add(entity: T): Guid
    +Update(entity: T): bool
    +Delete(id: Guid): bool
    +Find(predicate: Func~T, bool~): List~T~
}

class IUnitOfWork {
    <<interface>>
    +BeginTransaction(): void
    +Commit(): void
    +Rollback(): void
    +SaveChanges(): int
}

class ICacheService {
    <<interface>>
    +Get~T~(key: string): T
    +Set~T~(key: string, value: T, expiration: TimeSpan?): void
    +Remove(key: string): void
    +Exists(key: string): bool
    +Clear(): void
}

class IEmailService {
    <<interface>>
    +SendEmail(to: string, subject: string, body: string): bool
    +SendTemplateEmail(templateId: string, data: Dictionary~string, object~): bool
    +ValidateEmail(email: string): bool
}
```