using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class AIProviderCredentialConfiguration : IEntityTypeConfiguration<AIProviderCredential>
{
    public void Configure(EntityTypeBuilder<AIProviderCredential> b)
    {
        b.ToTable("AIProviderCredentials");
        b.HasKey(e => e.Id);

        b.Property(e => e.Provider).HasMaxLength(80).IsRequired();
        b.Property(e => e.DisplayName).HasMaxLength(120).IsRequired();
        b.Property(e => e.BaseUrl).HasMaxLength(500).IsRequired();
        b.Property(e => e.ApiKey).HasMaxLength(2000);
        b.Property(e => e.DefaultModel).HasMaxLength(200).IsRequired();

        b.HasIndex(e => e.Provider).IsUnique();
        b.HasIndex(e => e.Enabled);
    }
}
