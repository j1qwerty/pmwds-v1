using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;
namespace PMWDS.Persistence.Configurations;

public class MilestoneDependencyConfiguration : IEntityTypeConfiguration<MilestoneDependency>
{
    public void Configure(EntityTypeBuilder<MilestoneDependency> b)
    {
        b.ToTable("MilestoneDependencies");
        b.HasKey(e => e.Id);
        b.Property(e => e.Type)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();
        b.Property(e => e.ThresholdPercentage)
            .HasColumnType("decimal(5,2)");

        b.HasOne(e => e.Project)
            .WithMany()
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.PrerequisiteMilestone)
            .WithMany(m => m.PrerequisiteDependencies)
            .HasForeignKey(e => e.PrerequisiteMilestoneId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(e => e.DependentMilestone)
            .WithMany(m => m.DependentDependencies)
            .HasForeignKey(e => e.DependentMilestoneId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(e => e.ProjectId);
        b.HasIndex(e => e.PrerequisiteMilestoneId);
        b.HasIndex(e => e.DependentMilestoneId);
    }
}
