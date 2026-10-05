using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class DashboardWidgetConfiguration : IEntityTypeConfiguration<DashboardWidget>
{
    public void Configure(EntityTypeBuilder<DashboardWidget> b)
    {
        b.ToTable("DashboardWidgets");
        b.HasKey(e => e.Id);
        b.Property(e => e.WidgetType).HasMaxLength(100).IsRequired();
        b.Property(e => e.Title).HasMaxLength(200).IsRequired();
        b.HasOne(e => e.Dashboard)
            .WithMany(e => e.Widgets)
            .HasForeignKey(e => e.DashboardId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(e => e.DashboardId);
    }
}
