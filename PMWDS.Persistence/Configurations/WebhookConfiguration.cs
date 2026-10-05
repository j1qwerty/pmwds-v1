using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    public void Configure(EntityTypeBuilder<Webhook> b)
    {
        b.ToTable("Webhooks");
        b.HasKey(e => e.Id);
        b.Property(e => e.EventType).HasMaxLength(100).IsRequired();
        b.Property(e => e.CallbackUrl).HasMaxLength(500).IsRequired();
        b.Property(e => e.Secret).HasMaxLength(500).IsRequired();
        b.HasOne(e => e.Integration)
            .WithMany()
            .HasForeignKey(e => e.IntegrationId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
