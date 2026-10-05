using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> b)
    {
        b.ToTable("Organizations");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.TaxId).HasMaxLength(100);
        b.Property(e => e.Address).HasMaxLength(500);
        b.Property(e => e.ContactEmail).HasMaxLength(200);
        b.Property(e => e.ContactPhone).HasMaxLength(50);
        b.HasIndex(e => e.Name).IsUnique();
        b.HasIndex(e => e.TaxId).IsUnique().HasFilter("[TaxId] IS NOT NULL AND [TaxId] <> ''");
    }
}
