using PMWDS.Domain.Entities;

namespace PMWDS.Application.DTOs.Users;

public record UserDto(
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
 List<UserDepartmentDto> Departments,
 Guid? ProfileId,
 string? Bio,
 string AvailabilityStatus,
 double AvailabilityPercentage,
 double AIWorkloadScore,
 double AIBurnoutRiskScore,
 double AIPerformanceScore,
 int ActiveTaskCount,
 bool IsActive,
 DateTime? LastLoginDate,
 List<string> Roles,
 List<string> RoleKeys,
 List<string>? Skills,
 List<UserSkillDto>? SkillDetails)
{
    public static UserDto FromEntity(
    ApplicationUser u,
    IList<string>? roles = null)
    => new(
    Id: u.Id.ToString(),
    FirstName: u.FirstName,
    LastName: u.LastName,
    FullName: u.FullName,
    Email: u.Email,
    ProfilePictureUrl: u.ProfilePictureUrl,
    JobTitle: u.Profile?.JobTitle ?? u.JobTitle,
    OrganizationId: u.OrganizationId ?? u.Department?.OrganizationId,
    Department: u.Department?.Name,
    DepartmentId: u.DepartmentId,
    Departments: MapDepartments(u),
    ProfileId: u.Profile?.Id,
    Bio: u.Profile?.Bio,
    AvailabilityStatus: u.AvailabilityStatus
    .ToString(),
    AvailabilityPercentage: u.AvailabilityPercentage,
    AIWorkloadScore: u.AIWorkloadScore,
    AIBurnoutRiskScore: u.AIBurnoutRiskScore,
    AIPerformanceScore: u.AIPerformanceScore,
    ActiveTaskCount: u.GetActiveTaskCount(),
    IsActive: u.IsActive,
    LastLoginDate: null,
    Roles: roles?.ToList()
    ?? new(),
    RoleKeys: u.Roles
    .Select(role => role.Key)
    .Where(key => !string.IsNullOrWhiteSpace(key))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList(),
    Skills: null,
    SkillDetails: null
    );
    public static UserDto FromEntityWithSkills(
    ApplicationUser u,
    IList<string>? roles = null)
    => new(
    Id: u.Id.ToString(),
    FirstName: u.FirstName,
    LastName: u.LastName,
    FullName: u.FullName,
    Email: u.Email,
    ProfilePictureUrl: u.ProfilePictureUrl,
    JobTitle: u.Profile?.JobTitle ?? u.JobTitle,
    OrganizationId: u.OrganizationId ?? u.Department?.OrganizationId,
    Department: u.Department?.Name,
    DepartmentId: u.DepartmentId,
    Departments: MapDepartments(u),
    ProfileId: u.Profile?.Id,
    Bio: u.Profile?.Bio,
    AvailabilityStatus: u.AvailabilityStatus
    .ToString(),
    AvailabilityPercentage: u.AvailabilityPercentage,
    AIWorkloadScore: u.AIWorkloadScore,
    AIBurnoutRiskScore: u.AIBurnoutRiskScore,
    AIPerformanceScore: u.AIPerformanceScore,
    ActiveTaskCount: u.GetActiveTaskCount(),
    IsActive: u.IsActive,
    LastLoginDate: null,
    Roles: roles?.ToList()
    ?? new(),
    RoleKeys: u.Roles
    .Select(role => role.Key)
    .Where(key => !string.IsNullOrWhiteSpace(key))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToList(),
    Skills: u.Skills
    .Select(s => s.Skill?.Name ?? "")
    .ToList(),
    SkillDetails: u.Skills
    .Select(s => new UserSkillDto(
        s.SkillId,
        s.Skill?.Name ?? "",
        s.ProficiencyLevel,
        s.ExperienceMonths,
        s.LastUsed))
    .ToList()
    );

    private static List<UserDepartmentDto> MapDepartments(ApplicationUser u)
        => u.DepartmentAssignments
            .Where(d => d.Department != null)
            .Select(d => new UserDepartmentDto(
                d.DepartmentId,
                d.Department!.Name,
                d.Department.Code,
                d.Department.OrganizationId,
                d.Department.Organization?.Name,
                d.IsPrimary))
            .ToList();
}

public record UserDepartmentDto(
 Guid DepartmentId,
 string DepartmentName,
 string DepartmentCode,
 Guid? OrganizationId,
 string? OrganizationName,
 bool IsPrimary);

public record UserSkillDto(
 Guid SkillId,
 string SkillName,
 int ProficiencyLevel,
 int ExperienceMonths,
 DateTime LastUsed);
public record UserSummaryDto(
 string Id,
 string FullName,
 string? JobTitle,
 double AvailabilityPercentage,
 double WorkloadScore)
{
    public static UserSummaryDto FromEntity(
    ApplicationUser u)
    => new(u.Id.ToString(), u.FullName, u.Profile?.JobTitle ?? u.JobTitle,
    u.AvailabilityPercentage,
    u.AIWorkloadScore);
}
public record RegisterUserDto(
 string FirstName,
 string LastName,
 string Email,
 string Password,
 string? JobTitle,
 Guid? OrganizationId,
 Guid? DepartmentId,
 List<Guid>? DepartmentIds,
 string Role = "Viewer");
public record UpdateUserDto(
 string FirstName,
 string LastName,
 string? JobTitle,
 string? PhoneNumber,
 Guid? OrganizationId,
 Guid? DepartmentId,
 List<Guid>? DepartmentIds,
 double AvailabilityPercentage,
 PMWDS.Domain.Enums.AvailabilityStatus? AvailabilityStatus,
 List<string>? RoleNames,
 string? ProfilePictureUrl);
public record WorkloadDistributionDto(
 Guid? DepartmentId,
 int TotalMembers,
 int AvailableCount,
 int OverloadedCount,
 double AverageWorkload,
 double AverageBurnoutRisk,
 List<UserWorkloadItem> Members,
 DateTime GeneratedAt);
public record UserWorkloadItem(
 string UserId,
 string FullName,
 string? JobTitle,
 double AvailabilityPercent,
 double WorkloadScore,
 double BurnoutRisk,
 double PerformanceScore,
 int ActiveTaskCount,
 int CompletedThisMonth,
 List<string> Skills,
 string Status);
