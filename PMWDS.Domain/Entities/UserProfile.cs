using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class UserProfile : AuditableEntity
{
    public Guid UserId { get; private set; }
    public string? Bio { get; private set; }
    public string? JobTitle { get; private set; }
    public DateTime? DateOfBirth { get; private set; }
    public string? Address { get; private set; }
    public string? EmergencyContact { get; private set; }
    public string? LinkedInUrl { get; private set; }

    public ApplicationUser? User { get; private set; }

    protected UserProfile() { }

    public static UserProfile Create(
        Guid userId,
        string? bio,
        string? jobTitle,
        DateTime? dateOfBirth,
        string? address,
        string? emergencyContact,
        string? linkedInUrl)
    {
        return new UserProfile
        {
            UserId = userId,
            Bio = bio,
            JobTitle = jobTitle,
            DateOfBirth = dateOfBirth,
            Address = address,
            EmergencyContact = emergencyContact,
            LinkedInUrl = linkedInUrl
        };
    }

    public void UpdateProfileDetails(
        string? bio,
        string? jobTitle,
        DateTime? dateOfBirth,
        string? address,
        string? emergencyContact,
        string? linkedInUrl)
    {
        Bio = bio;
        JobTitle = jobTitle;
        DateOfBirth = dateOfBirth;
        Address = address;
        EmergencyContact = emergencyContact;
        LinkedInUrl = linkedInUrl;
    }

    public UserProfile GetFullProfile() => this;
}
