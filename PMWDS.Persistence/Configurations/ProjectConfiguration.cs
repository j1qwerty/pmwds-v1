using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;


using PMWDS.Domain.Entities;
namespace PMWDS.Persistence.Configurations;

public class ProjectConfiguration
 : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.ToTable("Projects");
        b.HasKey(e => e.Id);
        b.Property(e => e.ProjectCode)
        .HasMaxLength(50).IsRequired();
        b.Property(e => e.Name)
        .HasMaxLength(200).IsRequired();
        b.Property(e => e.Description)
        .HasMaxLength(2000);
        b.Property(e => e.Category)
        .HasMaxLength(100).IsRequired();
        b.Property(e => e.PlannedBudget)
        .HasColumnType("decimal(18,2)");
        b.Property(e => e.ActualCost)
        .HasColumnType("decimal(18,2)");
        b.Property(e => e.Priority)
        .HasConversion<string>()
        .HasMaxLength(20);
        b.Property(e => e.Status)
        .HasConversion<string>()
        .HasMaxLength(20);
        // AI columns
        b.Property(e => e.AIHealthScore)
        .HasColumnType("decimal(5,2)");
        b.Property(e => e.AIDelayRiskScore)
        .HasColumnType("decimal(5,4)");
        b.Property(e => e.AIBudgetRiskScore)
        .HasColumnType("decimal(5,4)");
        b.Property(e => e.AIInsightsSummary)
        .HasMaxLength(4000);
        // Relationships
        b.HasMany(e => e.Milestones)
        .WithOne(m => m.Project)
        .HasForeignKey(m => m.ProjectId)
        .OnDelete(DeleteBehavior.NoAction);
        b.HasMany(e => e.Tasks)
        .WithOne(t => t.Project)
        .HasForeignKey(t => t.ProjectId)
        .OnDelete(DeleteBehavior.Cascade);
        // Bind the reference side explicitly. A bare WithOne() leaves ProjectDocument.Project
        // unmatched, so EF keeps this configured relationship *and* convention adds a second
        // one over the navigation, producing a phantom shadow FK column (ProjectId1).
        b.HasMany(e => e.Documents)
        .WithOne(d => d.Project)
        .HasForeignKey(d => d.ProjectId)
        .OnDelete(DeleteBehavior.Cascade);
        b.HasOne<ApplicationUser>()
        .WithMany()
        .HasForeignKey(e => e.ProjectManagerId)
        .OnDelete(DeleteBehavior.NoAction);
        // Indexes
        b.HasIndex(e => e.ProjectCode).IsUnique();
        b.HasIndex(e => e.Status);
        b.HasIndex(e => e.DepartmentId);
        b.HasIndex(e => e.ProjectManagerId);
        b.HasIndex(e => e.AIDelayRiskScore);
    }
}
