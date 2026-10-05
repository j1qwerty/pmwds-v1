using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b)
    {
        b.ToTable("Roles");
        b.HasKey(e => e.Id);
        b.Property(e => e.Key).HasMaxLength(100).IsRequired();
        b.Property(e => e.Name).HasMaxLength(100).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500);
        b.Property(e => e.PaginationPageSize).HasDefaultValue(10);
        b.HasIndex(e => e.Key).IsUnique();
        b.HasIndex(e => e.Name).IsUnique();

        b.HasMany(e => e.Permissions)
            .WithMany(e => e.Roles)
            .UsingEntity(j => j.ToTable("RolePermissions"));
    }
}
