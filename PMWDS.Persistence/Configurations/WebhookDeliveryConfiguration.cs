using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> b)
    {
        b.ToTable("WebhookDeliveries");
        b.HasKey(e => e.Id);
        b.Property(e => e.ResponseBody).HasMaxLength(4000).IsRequired();
        b.Property(e => e.ErrorMessage).HasMaxLength(1000);
        b.HasOne(e => e.Webhook)
            .WithMany()
            .HasForeignKey(e => e.WebhookId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(e => e.WebhookId);
    }
}
