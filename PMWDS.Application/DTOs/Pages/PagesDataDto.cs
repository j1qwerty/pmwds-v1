using PMWDS.Application.DTOs.Common;
using PMWDS.Application.DTOs.Notifications;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.DTOs.Tasks;
using PMWDS.Application.DTOs.Users;

namespace PMWDS.Application.DTOs.Pages;

public record PagesDataResponse(
    int Page,
    int UserPageSize,
    int ReturnedPageSize,
    DateTime GeneratedAt,
    UserDto? CurrentUser,
    PaginatedResponse<PageOrganizationDto> Organizations,
    PaginatedResponse<PageDepartmentDto> Departments,
    PaginatedResponse<ProjectDto> Projects,
    PaginatedResponse<MilestoneDto> Milestones,
    PaginatedResponse<TaskDto> Tasks,
    PaginatedResponse<TaskDto> Subtasks,
    PaginatedResponse<UserDto> Users,
    PaginatedResponse<PageRoleDto> Roles,
    PaginatedResponse<PagePermissionDto> Permissions,
    PaginatedResponse<NotificationDto> Notifications,
    PaginatedResponse<PageNotificationTemplateDto> NotificationTemplates,
    PaginatedResponse<PageAlertRuleDto> AlertRules,
    PaginatedResponse<PageSkillDto> Skills,
    PaginatedResponse<PageReportDto> Reports,
    PaginatedResponse<PageIntegrationDto> Integrations,
    PaginatedResponse<PageKnowledgeArticleDto> KnowledgeArticles,
    PaginatedResponse<PageLessonLearnedDto> LessonsLearned,
    PaginatedResponse<PageActivityLogDto> ActivityLogs);

public record PageOrganizationDto(
    Guid Id,
    string Name,
    string TaxId,
    string ContactEmail,
    string ContactPhone,
    int DepartmentCount);

public record PageDepartmentDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    Guid? OrganizationId,
    string? OrganizationName,
    string? DepartmentHeadUserId,
    int MaxCapacity);

public record PageRoleDto(
    Guid Id,
    string Key,
    string Name,
    string Description,
    int PermissionLevel,
    int PaginationPageSize,
    List<string> PermissionCodes);

public record PagePermissionDto(
    Guid Id,
    string Code,
    string Name,
    string Description,
    string Module,
    bool IsGlobal);

public record PageNotificationTemplateDto(
    Guid Id,
    string TemplateType,
    string SubjectTemplate,
    string BodyTemplate,
    List<string> Variables,
    List<string> SupportedChannels);

public record PageAlertRuleDto(
    Guid Id,
    string Name,
    string ConditionType,
    string ConditionExpression,
    string ActionType,
    string ActionParametersJson,
    bool IsEnabled,
    DateTime? LastTriggered);

public record PageSkillDto(
    Guid Id,
    string Name,
    string Category,
    string Description,
    Guid? OrganizationId,
    string? OrganizationName);

public record PageReportDto(
    Guid Id,
    string Name,
    string ReportType,
    string ParametersJson,
    DateTime GeneratedDate,
    string Format,
    Guid GeneratedByUserId,
    int SizeBytes);

public record PageIntegrationDto(
    Guid Id,
    string IntegrationType,
    string Name,
    string ConfigurationJson,
    bool IsEnabled,
    DateTime? LastSync,
    string Status);

public record PageKnowledgeArticleDto(
    Guid Id,
    Guid? ProjectId,
    string? ProjectName,
    string Title,
    string Category,
    List<string> Tags,
    Guid AuthorId,
    DateTime CreatedDate,
    DateTime LastUpdated,
    int ViewCount,
    double RelevanceScore);

public record PageLessonLearnedDto(
    Guid Id,
    Guid ProjectId,
    string? ProjectName,
    string Title,
    string Category,
    string Impact,
    List<string> Keywords,
    DateTime RecordedDate);

public record PageActivityLogDto(
    Guid Id,
    Guid UserId,
    string? UserName,
    Guid? ProjectId,
    string? ProjectName,
    string ActivityType,
    string Description,
    DateTime Timestamp,
    Dictionary<string, object> Metadata);
