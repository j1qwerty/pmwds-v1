using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;
namespace PMWDS.Persistence.Configurations;

public class NotificationConfiguration
 : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("Notifications");
        b.HasKey(e => e.Id);
        b.Property(e => e.UserId)
        .HasMaxLength(64).IsRequired();
        b.Property(e => e.Title)
        .HasMaxLength(500).IsRequired();
        b.Property(e => e.Message)
        .HasMaxLength(2000).IsRequired();
        b.Property(e => e.Type)
        .HasConversion<string>().HasMaxLength(50);
        b.Property(e => e.Priority)
        .HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.ActionUrl)
        .HasMaxLength(500);
        b.Property(e => e.RelatedEntityId)
        .HasMaxLength(100);
        b.Property(e => e.RelatedEntityType)
        .HasMaxLength(100);
        b.HasIndex(e => e.UserId);
        b.HasIndex(e => e.IsRead);
        b.HasIndex(e => e.CreatedDate);
        b.HasIndex(e => e.IsDeleted);
        b.HasIndex(e => new { e.IsDeleted, e.UserId, e.IsRead, e.CreatedDate });
    }
}
