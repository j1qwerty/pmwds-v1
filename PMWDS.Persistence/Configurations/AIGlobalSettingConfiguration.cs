using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class AIGlobalSettingConfiguration : IEntityTypeConfiguration<AIGlobalSetting>
{
    public void Configure(EntityTypeBuilder<AIGlobalSetting> b)
    {
        b.ToTable("AIGlobalSettings");
        b.HasKey(e => e.Id);

        b.Property(e => e.DefaultProvider).HasMaxLength(80).IsRequired();
        b.Property(e => e.DefaultModel).HasMaxLength(200);
        b.Property(e => e.MLModelPath).HasMaxLength(500);
        b.Property(e => e.DocumentArchiveRetentionDays).HasDefaultValue(30);

        b.HasIndex(e => e.DefaultProvider);
    }
}
