using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class DelayPredictionConfiguration : IEntityTypeConfiguration<DelayPrediction>
{
    public void Configure(EntityTypeBuilder<DelayPrediction> b)
    {
        b.ToTable("DelayPredictions");
        b.HasKey(e => e.Id);
        b.HasOne(e => e.Task)
            .WithMany(t => t.DelayPredictions)
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Model)
            .WithMany()
            .HasForeignKey(e => e.ModelId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(e => e.TaskId);
        b.HasIndex(e => e.PredictedCompletionDate);
    }
}
