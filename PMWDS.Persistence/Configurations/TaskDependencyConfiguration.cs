using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class TaskDependencyConfiguration
    : IEntityTypeConfiguration<TaskDependency>
{
    public void Configure(EntityTypeBuilder<TaskDependency> b)
    {
        b.ToTable("TaskDependencies");
        b.HasKey(e => e.Id);

        b.Property(e => e.Type)
            .HasConversion<string>()
            .HasMaxLength(32);

        b.HasOne(e => e.PredecessorTask)
            .WithMany()
            .HasForeignKey(e => e.PredecessorTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.SuccessorTask)
            .WithMany(t => t.Dependencies)
            .HasForeignKey(e => e.SuccessorTaskId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(e => e.PredecessorTaskId);
        b.HasIndex(e => e.SuccessorTaskId);
        b.HasIndex(e => new { e.PredecessorTaskId, e.SuccessorTaskId })
            .IsUnique();
    }
}
