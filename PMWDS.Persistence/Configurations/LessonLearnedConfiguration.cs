using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class LessonLearnedConfiguration : IEntityTypeConfiguration<LessonLearned>
{
    public void Configure(EntityTypeBuilder<LessonLearned> b)
    {
        b.ToTable("LessonsLearned");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(250).IsRequired();
        b.Property(e => e.Category).HasMaxLength(100).IsRequired();
        b.Property(e => e.Impact).HasMaxLength(200).IsRequired();
        b.Property(e => e.Description).HasMaxLength(4000).IsRequired();
        b.HasIndex(e => e.ProjectId);
    }
}
