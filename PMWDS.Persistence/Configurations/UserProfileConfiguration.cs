using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> b)
    {
        b.ToTable("UserProfiles");
        b.HasKey(e => e.Id);
        b.Property(e => e.Bio).HasMaxLength(2000);
        b.Property(e => e.JobTitle).HasMaxLength(200);
        b.Property(e => e.Address).HasMaxLength(500);
        b.Property(e => e.EmergencyContact).HasMaxLength(200);
        b.Property(e => e.LinkedInUrl).HasMaxLength(250);
        b.HasIndex(e => e.UserId).IsUnique();
    }
}
