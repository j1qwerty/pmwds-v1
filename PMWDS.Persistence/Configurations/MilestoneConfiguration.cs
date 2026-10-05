using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;
namespace PMWDS.Persistence.Configurations;

public class MilestoneConfiguration
 : IEntityTypeConfiguration<Milestone>
{
    public void Configure(EntityTypeBuilder<Milestone> b)
    {
        b.ToTable("Milestones");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name)
        .HasMaxLength(300).IsRequired();
        b.Property(e => e.Description)
        .HasMaxLength(2000);
        b.Property(e => e.Status)
        .HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.ProgressPercentage)
        .HasColumnType("decimal(5,2)");
        b.HasMany(e => e.Tasks)
        .WithOne(t => t.Milestone)
        .HasForeignKey(t => t.MilestoneId)
        .OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.Department)
        .WithMany()
        .HasForeignKey(e => e.DepartmentId)
        .OnDelete(DeleteBehavior.SetNull);
        b.HasMany(e => e.PrerequisiteDependencies)
        .WithOne(d => d.PrerequisiteMilestone)
        .HasForeignKey(d => d.PrerequisiteMilestoneId)
        .OnDelete(DeleteBehavior.Restrict);
        b.HasMany(e => e.DependentDependencies)
        .WithOne(d => d.DependentMilestone)
        .HasForeignKey(d => d.DependentMilestoneId)
        .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(e => e.DepartmentId);
        b.HasIndex(e => e.ProjectId);
        b.HasIndex(e => e.Status);
        b.HasIndex(e => e.DueDate);
        b.HasIndex(e => e.IsDeleted);
        b.HasIndex(e => new { e.IsDeleted, e.ProjectId, e.Status, e.DueDate });
        b.HasIndex(e => new { e.IsDeleted, e.DepartmentId });
    }
}
