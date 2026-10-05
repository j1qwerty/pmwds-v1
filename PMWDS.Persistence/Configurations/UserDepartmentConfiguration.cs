using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class UserDepartmentConfiguration : IEntityTypeConfiguration<UserDepartment>
{
    public void Configure(EntityTypeBuilder<UserDepartment> b)
    {
        b.ToTable("UserDepartments");
        b.HasKey(e => e.Id);

        b.HasOne(e => e.User)
            .WithMany(u => u.DepartmentAssignments)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.Department)
            .WithMany()
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(e => new { e.UserId, e.DepartmentId }).IsUnique();
        b.HasIndex(e => e.DepartmentId);
        b.HasIndex(e => e.IsPrimary);
    }
}
