using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class TrainingDataPointConfiguration : IEntityTypeConfiguration<TrainingDataPoint>
{
    public void Configure(EntityTypeBuilder<TrainingDataPoint> b)
    {
        b.ToTable("TrainingDataPoints");
        b.HasKey(e => e.Id);
        b.Property(e => e.DataType).HasMaxLength(100).IsRequired();
        b.Property(e => e.Source).HasMaxLength(200).IsRequired();
        b.HasIndex(e => e.DataType);
        b.HasIndex(e => e.Source);
    }
}
