using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class TimeEntryConfiguration
    : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> b)
    {
        b.ToTable("TimeEntries");
        b.HasKey(e => e.Id);

        b.Property(e => e.Description)
            .HasMaxLength(2000)
            .IsRequired();

        b.HasOne(e => e.Task)
            .WithMany(t => t.TimeEntries)
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.User)
            .WithMany(u => u.TimeEntries)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        b.HasIndex(e => e.TaskId);
        b.HasIndex(e => e.UserId);
        b.HasIndex(e => e.StartTime);
        b.HasIndex(e => e.IsDeleted);
        b.HasIndex(e => new { e.IsDeleted, e.TaskId, e.UserId, e.StartTime });
    }
}
