using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> b)
    {
        b.ToTable("ActivityLogs");
        b.HasKey(e => e.Id);
        b.Property(e => e.ActivityType).HasMaxLength(100).IsRequired();
        b.Property(e => e.Description).HasMaxLength(2000).IsRequired();
        b.HasIndex(e => e.UserId);
        b.HasIndex(e => e.Timestamp);
        b.HasIndex(e => e.ProjectId);
    }
}
