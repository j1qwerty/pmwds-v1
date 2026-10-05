using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class NotificationTemplateConfiguration : IEntityTypeConfiguration<NotificationTemplate>
{
    public void Configure(EntityTypeBuilder<NotificationTemplate> b)
    {
        b.ToTable("NotificationTemplates");
        b.HasKey(e => e.Id);
        b.Property(e => e.TemplateType).HasMaxLength(100).IsRequired();
        b.Property(e => e.SubjectTemplate).HasMaxLength(500).IsRequired();
        b.Property(e => e.BodyTemplate).HasMaxLength(4000).IsRequired();
    }
}
