using PMWDS.Application.DTOs.Users;

namespace PMWDS.Application.DTOs.Workspace;

public record WorkspaceBootstrapDto(
    DateTime GeneratedAt,
    UserDto CurrentUser,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<ProjectNavigationDto> Projects,
    int UnreadNotificationCount,
    int UserPageSize);

public record ProjectNavigationDto(
    Guid Id,
    string ProjectCode,
    string Name,
    string Status,
    string Priority,
    Guid DepartmentId,
    IReadOnlyList<Guid> DepartmentIds,
    double ProgressPercentage,
    double AIDelayRiskScore,
    int TotalTasks,
    bool IsNewForCurrentUser,
    DateTime CreatedDate);
