using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class AllocationRecommendationConfiguration : IEntityTypeConfiguration<AllocationRecommendation>
{
    public void Configure(EntityTypeBuilder<AllocationRecommendation> b)
    {
        b.ToTable("AllocationRecommendations");
        b.HasKey(e => e.Id);
        b.Property(e => e.Status).HasMaxLength(50).IsRequired();
        b.Property(e => e.DecisionReason).HasMaxLength(1000);
        b.HasOne(e => e.Task)
            .WithMany(t => t.AllocationRecommendations)
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Model)
            .WithMany()
            .HasForeignKey(e => e.ModelId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(e => e.TaskId);
        b.HasIndex(e => e.RecommendedUserId);
    }
}
