using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> b)
    {
        b.ToTable("Permissions");
        b.HasKey(e => e.Id);
        b.Property(e => e.Code).HasMaxLength(100).IsRequired();
        b.Property(e => e.Name).HasMaxLength(150).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500);
        b.Property(e => e.Module).HasMaxLength(100).IsRequired();
        b.HasIndex(e => e.Code).IsUnique();
        b.HasIndex(e => e.Module);
    }
}
