using PMWDS.Domain.Enums;
using PMWDS.Domain.Entities;

namespace PMWDS.Application.DTOs.Controllers;

// From AuthController.cs
public record LoginRequest(string Email, string Password);
public record ChangePasswordRequest(string OldPassword, string NewPassword);
public record RefreshTokenRequest(string UserId, string RefreshToken);
public record SignupRequest(string FirstName, string LastName, string Email, string Password, string? JobTitle);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);

// From DepartmentsController.cs
public record DepartmentDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    Guid? OrganizationId,
    Guid? ParentDepartmentId,
    string? DepartmentHeadUserId,
    int MaxCapacity,
    double CapacityUtilization);

public record CreateDepartmentDto(
    string Name,
    string Code,
    string? Description,
    Guid? ParentDepartmentId = null,
    Guid? OrganizationId = null,
    string? DepartmentHeadUserId = null,
    int? MaxCapacity = null);

public record UpdateDepartmentDto(
    string Name,
    string Code,
    string? Description,
    Guid? OrganizationId = null,
    string? DepartmentHeadUserId = null,
    int? MaxCapacity = null);

// From IntegrationsController.cs
public record IntegrationResponse(Guid Id, string IntegrationType, string Name, Dictionary<string, object> Configuration, bool IsEnabled, DateTime? LastSync, string Status);
public record IntegrationDetailResponse(IntegrationResponse Integration, List<WebhookResponse> Webhooks);
public record UpsertIntegrationRequest(string IntegrationType, string Name, Dictionary<string, object> Configuration, bool IsEnabled, string Status);
public record SyncIntegrationRequest(string Status);

// From OrganizationsController.cs
public record OrganizationResponse(
    Guid Id,
    string Name,
    string? TaxId,
    string? Address,
    string? ContactEmail,
    string? ContactPhone,
    DateTime? FoundedDate,
    OrganizationDirectorResponse? Director,
    List<OrganizationDepartmentResponse> Departments,
    int DepartmentCount);

public record OrganizationDirectorResponse(Guid Id, string FullName, string Email, string? ProfilePictureUrl);
public record OrganizationDepartmentResponse(Guid Id, string Name, string Code);
public record UpsertOrganizationRequest(string Name, string? TaxId = null, string? Address = null, string? ContactEmail = null, string? ContactPhone = null, DateTime? FoundedDate = null);

// From MilestonesController.cs
public record SetMilestoneStatusDto(string Status, bool ForceComplete = false);

public record CreateMilestoneDto(
    Guid ProjectId,
    string Name,
    string Description,
    DateTime DueDate,
    int Order,
    Guid? DepartmentId = null,
    bool IsCritical = false);

public record UpdateMilestoneDto(
    string Name,
    string Description,
    DateTime DueDate,
    int Order,
    bool IsCritical,
    Guid? DepartmentId,
    double ProgressPercentage);

public record CreateMilestoneDependencyDto(
    Guid ProjectId,
    Guid PrerequisiteMilestoneId,
    Guid DependentMilestoneId,
    string Type,
    double? ThresholdPercentage = null);

public record UpdateMilestoneDependencyDto(
    string Type,
    double? ThresholdPercentage = null);

// From WebhooksController.cs
public record WebhookResponse(Guid Id, Guid? IntegrationId, string EventType, string CallbackUrl, List<string> Headers, bool IsActive);
public record WebhookDetailResponse(WebhookResponse Webhook, List<WebhookDeliveryResponse> Deliveries);
public record WebhookDeliveryResponse(Guid Id, Guid WebhookId, DateTime AttemptedAt, int StatusCode, string ResponseBody, bool Success, string? ErrorMessage);
public record UpsertWebhookRequest(Guid? IntegrationId, string EventType, string CallbackUrl, string Secret, List<string> Headers, bool IsActive);
public record CreateWebhookDeliveryRequest(int StatusCode, string ResponseBody, bool Success, string? ErrorMessage);

// From RolesController.cs
public record RoleResponse(
    Guid Id,
    string Key,
    string Name,
    string Description,
    int PermissionLevel,
    int PaginationPageSize,
    List<PermissionResponse> Permissions);

public record PermissionResponse(
    Guid Id,
    string Code,
    string Name,
    string Description,
    string Module,
    bool IsGlobal);

public record CreateRoleRequest(string Name, string Description, int PermissionLevel, List<Guid> PermissionIds, int? PaginationPageSize = null);
public record UpdateRoleRequest(string Name, string Description, int PermissionLevel, List<Guid> PermissionIds, int? PaginationPageSize = null);
public record CreatePermissionRequest(string Code, string Name, string Description, string Module, bool IsGlobal);
public record UpdatePermissionRequest(string Name, string Description, string Module, bool IsGlobal);

// From AIController.cs
public record ChatRequest(
    string Message,
    string? Provider = null,
    string? Model = null);

public record ProviderTestRequest(
    string? Model = null,
    string? Prompt = null);

public record RejectRecommendationRequest(
    string Reason);

public record AISettingsDto
{
    public string DefaultProvider { get; set; } = "OpenRouter";
    public string DefaultModel { get; set; } = "";
    public double RiskThreshold { get; set; } = 0.7;
    public bool UseLocalModel { get; set; } = false;
    public string MLModelPath { get; set; } = "";
    public List<AIProviderSettingsDto> Providers { get; set; } = new();
}

public record AIProviderSettingsDto
{
    public string Provider { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public bool Enabled { get; set; }
    public bool UseEnvironmentDefault { get; set; } = true;
    public string BaseUrl { get; set; } = "";
    public string DefaultModel { get; set; } = "";
}

// From DashboardsController.cs
public record DashboardResponse(
    Guid Id,
    Guid UserId,
    string Name,
    string LayoutType,
    bool IsDefault,
    DateTime LastAccessed,
    List<DashboardWidgetResponse> Widgets);

public record DashboardWidgetResponse(
    Guid Id,
    Guid DashboardId,
    string WidgetType,
    string Title,
    Dictionary<string, object> Configuration,
    int RefreshInterval,
    DateTime LastRefreshed,
    List<string> RequiredPermissions,
    int DisplayOrder);

public record UpsertDashboardRequest(string Name, string LayoutType, bool IsDefault);
public record UpsertDashboardWidgetRequest(string WidgetType, string Title, Dictionary<string, object> Configuration, int RefreshInterval, List<string> RequiredPermissions, int DisplayOrder);
public record ReorderDashboardWidgetsRequest(List<Guid> WidgetIds);

// From KnowledgeController.cs
public record KnowledgeArticleResponse(Guid Id, Guid? ProjectId, string Title, string Content, string Category, List<string> Tags, Guid AuthorId, DateTime CreatedDate, DateTime LastUpdated, int ViewCount, double RelevanceScore);
public record LessonLearnedResponse(Guid Id, Guid ProjectId, string Title, string Description, string Category, string Impact, List<string> Keywords, DateTime RecordedDate);
public record UpsertKnowledgeArticleRequest(Guid? ProjectId, string Title, string Content, string Category, List<string> Tags, double RelevanceScore);
public record UpsertLessonLearnedRequest(Guid ProjectId, string Title, string Description, string Category, string Impact, List<string> Keywords);

// From NotificationsController.cs
public record BroadcastNotificationRequest(
    string Title,
    string Message,
    Guid? DepartmentId = null,
    string? ActionUrl = null);

public record NotificationTemplateResponse(
    Guid Id,
    string TemplateType,
    string SubjectTemplate,
    string BodyTemplate,
    List<string> Variables,
    List<string> SupportedChannels);

public record UpsertNotificationTemplateRequest(
    string TemplateType,
    string SubjectTemplate,
    string BodyTemplate,
    List<string> Variables,
    List<string> SupportedChannels);

public record AlertRuleResponse(
    Guid Id,
    string Name,
    string ConditionType,
    string ConditionExpression,
    string ActionType,
    Dictionary<string, object> ActionParameters,
    bool IsEnabled,
    DateTime? LastTriggered);

public record UpsertAlertRuleRequest(
    string Name,
    string ConditionType,
    string ConditionExpression,
    string ActionType,
    Dictionary<string, object> ActionParameters,
    bool IsEnabled);

// From UsersController.cs
public record UpdateAvailabilityRequest(
    PMWDS.Domain.Enums.AvailabilityStatus Status,
    double AvailabilityPercentage);

public record AddUserSkillRequest(
    Guid SkillId,
    int ProficiencyLevel,
    int ExperienceMonths);

public record UpdateUserSkillRequest(
    int ProficiencyLevel,
    int ExperienceMonths);

public record AssignUserDepartmentsRequest(
    List<Guid> DepartmentIds,
    Guid? PrimaryDepartmentId);

// From ProjectsController.cs
public record UpdateProjectStatusRequest(ProjectStatus NewStatus, string? Justification = null);

// From ReportsController.cs
public record DepartmentWorkloadRequest(Guid DepartmentId, DateTime StartDate, DateTime EndDate);
public record StoredReportResponse(Guid Id, string Name, string ReportType, Dictionary<string, object> Parameters, DateTime GeneratedDate, string Format, Guid GeneratedByUserId, int SizeBytes);
public record StoredReportDetailResponse(StoredReportResponse Report, List<ReportScheduleResponse> Schedules);
public record ReportScheduleResponse(Guid Id, Guid ReportId, string Frequency, DateTime NextRun, DateTime? LastRun, List<string> Recipients, Dictionary<string, object> DeliveryOptions, bool IsActive);
public record UpsertStoredReportRequest(string Name, string ReportType, Dictionary<string, object> Parameters, string Format, string? ContentBase64);
public record UpsertReportScheduleRequest(Guid ReportId, string Frequency, DateTime NextRun, List<string> Recipients, Dictionary<string, object> DeliveryOptions, bool IsActive);

// From ActivityLogsController.cs
public record ActivityLogResponse(
    Guid Id,
    Guid UserId,
    string? UserName,
    Guid? ProjectId,
    string? ProjectName,
    string ActivityType,
    string Description,
    DateTime Timestamp,
    Dictionary<string, object> Metadata);
public record CreateActivityLogRequest(string ActivityType, string Description, Dictionary<string, object> Metadata, Guid? ProjectId = null);

// From ProfilesController.cs
public record UserProfileResponse(
    Guid Id,
    Guid UserId,
    string? Bio,
    string? JobTitle,
    DateTime? DateOfBirth,
    string? Address,
    string? EmergencyContact,
    string? LinkedInUrl);

public record UpsertProfileRequest(
    string? Bio,
    string? JobTitle,
    DateTime? DateOfBirth,
    string? Address,
    string? EmergencyContact,
    string? LinkedInUrl);

// From SkillsController.cs
public record SkillDto(
    Guid Id,
    string Name,
    string Category,
    string Description,
    int UserCount,
    Guid? OrganizationId,
    string CreatedBy)
{
    public static SkillDto FromEntity(Skill s)
    => new(s.Id, s.Name, s.Category, s.Description, s.UserSkills.Count, s.OrganizationId, s.CreatedBy);
}

public record CreateSkillDto(
    string Name,
    string Category,
    string Description,
    Guid? OrganizationId = null);

public record UpdateSkillDto(
    string Name,
    string Category,
    string Description);

// From TasksController.cs
public record UpdateTaskStatusRequest(PMWDS.Domain.Enums.TaskStatus NewStatus, bool ConfirmReset = false);
public record AssignTaskRequest(string? AssigneeId, bool UseAIRecommendation = false, List<string>? AssigneeIds = null);
public record AddCommentRequest(string Comment);
