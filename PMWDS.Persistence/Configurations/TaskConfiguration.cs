using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PMWDS.Domain.Entities;
using TaskStatus = PMWDS.Domain.Enums.TaskStatus;
namespace PMWDS.Persistence.Configurations;

public class TaskConfiguration
 : IEntityTypeConfiguration<ProjectTask>
{
    public void Configure(EntityTypeBuilder<ProjectTask> b)
    {
        b.ToTable("Tasks");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title)
        .HasMaxLength(500).IsRequired();
        b.Property(e => e.Description)
        .HasMaxLength(4000);
        b.Property(e => e.Status)
        .HasConversion(new ValueConverter<TaskStatus, string>(
            v => v.ToString(),
            v => v == "Assigned" ? TaskStatus.NotStarted : Enum.Parse<TaskStatus>(v)
        ))
        .HasMaxLength(20);
        b.Property(e => e.Priority)
        .HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.ProgressPercentage)
        .HasColumnType("decimal(5,2)");
        b.Property(e => e.AIDelayProbability)
        .HasColumnType("decimal(5,4)");
        b.Property(e => e.AIOptimalAssigneeScore)
        .HasColumnType("decimal(5,4)");
        b.Property(e => e.AIRiskFactors)
        .HasMaxLength(2000);
        // Self-referencing for sub-tasks
        b.HasMany(e => e.SubTasks)
        .WithOne(s => s.ParentTask)
        .HasForeignKey(s => s.ParentTaskId)
        .OnDelete(DeleteBehavior.Restrict);
        b.HasMany(e => e.Comments)
        .WithOne()
        .HasForeignKey(c => c.TaskId)
        .OnDelete(DeleteBehavior.Cascade);
        b.HasOne<ApplicationUser>()
        .WithMany()
        .HasForeignKey(e => e.AssignedToUserId)
        .OnDelete(DeleteBehavior.NoAction);
        b.HasMany(e => e.Attachments)
        .WithOne()
        .HasForeignKey(a => a.TaskId)
        .OnDelete(DeleteBehavior.Cascade);
        b.HasMany(e => e.Assignments)
        .WithOne(a => a.Task)
        .HasForeignKey(a => a.TaskId)
        .OnDelete(DeleteBehavior.Cascade);
        // Indexes
        b.HasIndex(e => e.ProjectId);
        b.HasIndex(e => e.AssignedToUserId);
        b.HasIndex(e => e.Status);
        b.HasIndex(e => e.DueDate);
        b.HasIndex(e => e.IsDeleted);
        b.HasIndex(e => new { e.IsDeleted, e.ProjectId, e.Status });
        b.HasIndex(e => new { e.IsDeleted, e.AssignedToUserId });
        b.HasIndex(e => new { e.IsDeleted, e.MilestoneId });
        b.HasIndex(e => e.IsEscalated);
        b.HasIndex(e => e.AIDelayProbability);
    }
}
