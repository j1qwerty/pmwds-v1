using PMWDS.Application.DTOs.Users;

namespace PMWDS.Application.DTOs.Workspace;

public record WorkspaceSnapshotDto(
    DateTime GeneratedAt,
    UserDto CurrentUser,
    IReadOnlyList<string> Permissions,
    IReadOnlyList<ProjectNavigationDto> Projects,
    IReadOnlyList<WorkspaceOrganizationDto> Organizations,
    IReadOnlyList<WorkspaceDepartmentDto> Departments,
    IReadOnlyList<WorkspaceUserDto> Users,
    int UnreadNotificationCount,
    int UserPageSize);

public record WorkspaceOrganizationDto(
    Guid Id,
    string Name,
    string? TaxId,
    string? Address,
    string? ContactEmail,
    string? ContactPhone,
    DateTime? FoundedDate,
    int DepartmentCount);

public record WorkspaceDepartmentDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    Guid? OrganizationId,
    Guid? ParentDepartmentId,
    string? DepartmentHeadUserId,
    int MaxCapacity,
    double CapacityUtilization);

public record WorkspaceUserDto(
    string Id,
    string FirstName,
    string LastName,
    string FullName,
    string Email,
    string? ProfilePictureUrl,
    string? JobTitle,
    Guid? OrganizationId,
    string? Department,
    Guid? DepartmentId,
    double AvailabilityPercentage,
    double AIWorkloadScore,
    double AIBurnoutRiskScore,
    double AIPerformanceScore,
    int ActiveTaskCount,
    bool IsActive,
    List<string> Roles,
    List<string> RoleKeys);
