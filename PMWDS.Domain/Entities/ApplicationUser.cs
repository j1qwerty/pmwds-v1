using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Domain.Entities;

public class ApplicationUser : AuditableEntity
{
    // Identity
    public string Email { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public string? ProfilePictureUrl { get; private set; }
    public string TimeZone { get; private set; } = "UTC";
    public string? PasswordHash { get; private set; }
    public string? PasswordResetTokenHash { get; private set; }
    public DateTime? PasswordResetTokenExpiresAt { get; private set; }
    public string? RefreshTokenHash { get; private set; }
    public DateTime? RefreshTokenExpiresAt { get; private set; }
    public DateTime? RefreshTokenRevokedAt { get; private set; }
    public int AccessTokenVersion { get; private set; }
    // Organization
    public Guid? OrganizationId { get; private set; }
    public Guid? DepartmentId { get; private set; }
    public string JobTitle { get; private set; } = string.Empty;
    public string EmployeeCode { get; private set; } = string.Empty;
    public AvailabilityStatus AvailabilityStatus { get; private set; }
    public double AvailabilityPercentage { get; private set; } = 100;
    // AI Profile
    public double AIPerformanceScore { get; private set; } = 0;
    public double AIWorkloadScore { get; private set; } = 0;
    public double AIBurnoutRiskScore { get; private set; } = 0;
    public DateTime? LastAIScoreUpdate { get; private set; }
    // Navigation
    public Department? Department { get; private set; }
    public Organization? Organization { get; private set; }
    public UserProfile? Profile { get; private set; }
    public ICollection<Role> Roles { get; private set; } = new List<Role>();
    public ICollection<UserDepartment> DepartmentAssignments { get; private set; } = new List<UserDepartment>();
    public IReadOnlyCollection<UserSkill> Skills =>
    _skills.AsReadOnly();
    public IReadOnlyCollection<TaskAssignment> TaskAssignments =>
    _taskAssignments.AsReadOnly();
    private readonly List<UserSkill> _skills = new();
    private readonly List<TaskAssignment> _taskAssignments = new();
    protected ApplicationUser() { }
    public static ApplicationUser Create(
    string email,
    string firstName,
    string lastName,
    string employeeCode,
    string jobTitle,
    Guid? departmentId = null)
    {
        var user = new ApplicationUser
        {
            Email = email.ToLower().Trim(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            EmployeeCode = employeeCode,
            JobTitle = jobTitle,
            DepartmentId = departmentId,
            AvailabilityStatus = AvailabilityStatus.Available
        };
        return user;
    }
    public void UpdateProfile(
    string firstName,
    string lastName,
    string phoneNumber,
    string jobTitle,
    string? profilePictureUrl = null)
    {
        FirstName = firstName;
        LastName = lastName;
        PhoneNumber = phoneNumber;
        JobTitle = jobTitle;
        if (profilePictureUrl != null)
        {
            ProfilePictureUrl = profilePictureUrl;
        }
    }
    public void AssignToDepartment(Guid departmentId) => DepartmentId = departmentId;
    public void UpdateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        Email = email.ToLower().Trim();
    }
    public void AssignToOrganization(Guid organizationId) => OrganizationId = organizationId;
    public void ClearPrimaryDepartment() => DepartmentId = null;
    public void ClearOrganization() => OrganizationId = null;
    public void UpdateAvailability(
    AvailabilityStatus status, double percentage)
    {
        AvailabilityStatus = status;
        AvailabilityPercentage = percentage;
    }
    public void AddSkill(UserSkill skill) => _skills.Add(skill);
    public void RemoveSkill(Guid skillId) => _skills.RemoveAll(s => s.SkillId == skillId);
    public void UpdateAIScores(
    double performance, double workload, double burnoutRisk)
    {
        AIPerformanceScore = performance;
        AIWorkloadScore = workload;
        AIBurnoutRiskScore = burnoutRisk;
        LastAIScoreUpdate = DateTime.UtcNow;
    }
    public string FullName => $"{FirstName} {LastName}";
    public int GetActiveTaskCount()
    => _taskAssignments
    .Count(t => t.Task?.Status == TaskStatus.InProgress);
    public void SetPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        PasswordResetTokenHash = null;
        PasswordResetTokenExpiresAt = null;
        RevokeAllTokens();
    }
    public void SetPasswordResetToken(string tokenHash, DateTime expiresAtUtc)
    {
        PasswordResetTokenHash = tokenHash;
        PasswordResetTokenExpiresAt = expiresAtUtc;
    }
    public bool IsPasswordResetTokenValid(string tokenHash)
        => !string.IsNullOrWhiteSpace(PasswordResetTokenHash)
        && PasswordResetTokenHash == tokenHash
        && PasswordResetTokenExpiresAt.HasValue
        && PasswordResetTokenExpiresAt.Value >= DateTime.UtcNow;
    public void SetRefreshToken(string tokenHash, DateTime expiresAtUtc)
    {
        RefreshTokenHash = tokenHash;
        RefreshTokenExpiresAt = expiresAtUtc;
        RefreshTokenRevokedAt = null;
    }
    public bool IsRefreshTokenValid(string tokenHash)
        => IsActive
        && !string.IsNullOrWhiteSpace(RefreshTokenHash)
        && RefreshTokenHash == tokenHash
        && RefreshTokenExpiresAt.HasValue
        && RefreshTokenExpiresAt.Value >= DateTime.UtcNow
        && RefreshTokenRevokedAt == null;
    public void RevokeRefreshToken()
    {
        if (string.IsNullOrWhiteSpace(RefreshTokenHash) || RefreshTokenRevokedAt != null)
        {
            return;
        }

        RefreshTokenRevokedAt = DateTime.UtcNow;
    }
    public void RevokeAllTokens()
    {
        RevokeRefreshToken();
        AccessTokenVersion++;
    }
    public new void Deactivate()
    {
        base.Deactivate();
        RevokeAllTokens();
    }
    public void SetProfile(UserProfile profile)
    {
        Profile = profile;
    }
}
