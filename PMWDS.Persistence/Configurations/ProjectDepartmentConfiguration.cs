using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class ProjectDepartmentConfiguration : IEntityTypeConfiguration<ProjectDepartment>
{
    public void Configure(EntityTypeBuilder<ProjectDepartment> b)
    {
        b.ToTable("ProjectDepartments");
        b.HasKey(e => e.Id);
        b.HasIndex(e => new { e.ProjectId, e.DepartmentId }).IsUnique();
        b.HasIndex(e => e.DepartmentId);

        b.HasOne(e => e.Project)
            .WithMany(p => p.ProjectDepartments)
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(e => e.Department)
            .WithMany(d => d.ProjectDepartments)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
