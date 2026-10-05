using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> b)
    {
        b.ToTable("Reports");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.ReportType).HasMaxLength(100).IsRequired();
        b.Property(e => e.Format).HasMaxLength(50).IsRequired();
        b.HasIndex(e => e.GeneratedByUserId);
        b.HasIndex(e => e.GeneratedDate);
    }
}
