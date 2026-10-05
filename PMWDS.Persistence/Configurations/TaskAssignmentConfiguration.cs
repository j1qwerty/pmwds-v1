using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class TaskAssignmentConfiguration
    : IEntityTypeConfiguration<TaskAssignment>
{
    public void Configure(EntityTypeBuilder<TaskAssignment> b)
    {
        b.ToTable("TaskAssignments");
        b.HasKey(e => e.Id);

        b.Property(e => e.AIRationale)
            .HasMaxLength(2000);

        b.HasOne(e => e.Task)
            .WithMany(t => t.Assignments)
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.User)
            .WithMany(u => u.TaskAssignments)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.NoAction);

        b.HasIndex(e => e.TaskId);
        b.HasIndex(e => e.UserId);
        b.HasIndex(e => e.IsActive);
        b.HasIndex(e => e.IsDeleted);
        b.HasIndex(e => new { e.IsDeleted, e.TaskId, e.UserId, e.IsActive });
    }
}
