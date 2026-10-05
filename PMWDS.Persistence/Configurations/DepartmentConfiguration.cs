using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> b)
    {
        b.ToTable("Departments");
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(200).IsRequired();
        b.Property(e => e.Code).HasMaxLength(50).IsRequired();
        b.Property(e => e.Description).HasMaxLength(500);
        b.Property(e => e.DepartmentHeadUserId).HasMaxLength(100);
        b.HasIndex(e => new { e.OrganizationId, e.Code }).IsUnique();
        b.HasIndex(e => new { e.OrganizationId, e.Name }).IsUnique();
        b.HasOne(e => e.Organization)
            .WithMany(e => e.Departments)
            .HasForeignKey(e => e.OrganizationId)
            .OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.ParentDepartment)
            .WithMany(e => e.SubDepartments)
            .HasForeignKey(e => e.ParentDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
