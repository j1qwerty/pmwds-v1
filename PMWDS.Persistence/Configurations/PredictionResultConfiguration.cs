using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class PredictionResultConfiguration : IEntityTypeConfiguration<PredictionResult>
{
    public void Configure(EntityTypeBuilder<PredictionResult> b)
    {
        b.ToTable("PredictionResults");
        b.HasKey(e => e.Id);
        b.Property(e => e.Recommendation).HasMaxLength(1000).IsRequired();
        b.HasOne(e => e.Model)
            .WithMany(m => m.PredictionResults)
            .HasForeignKey(e => e.ModelId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Task)
            .WithMany()
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.SetNull);
        b.HasIndex(e => e.ModelId);
        b.HasIndex(e => e.TaskId);
        b.HasIndex(e => e.PredictionDate);
    }
}
