using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class AIModelConfiguration : IEntityTypeConfiguration<AIModel>
{
    public void Configure(EntityTypeBuilder<AIModel> b)
    {
        b.ToTable("AIModels");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Version).HasMaxLength(50).IsRequired();
        b.Property(e => e.ModelType).HasMaxLength(100).IsRequired();
        b.Property(e => e.ModelPath).HasMaxLength(500);
        b.HasDiscriminator<string>("ModelDiscriminator")
            .HasValue<TaskAllocationModel>("TaskAllocation")
            .HasValue<DelayPredictionModel>("DelayPrediction");
        b.HasIndex(e => new { e.ModelType, e.Name, e.Version }).IsUnique();
    }
}
