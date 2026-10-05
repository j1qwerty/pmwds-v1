using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Configurations;

public class KnowledgeArticleConfiguration : IEntityTypeConfiguration<KnowledgeArticle>
{
    public void Configure(EntityTypeBuilder<KnowledgeArticle> b)
    {
        b.ToTable("KnowledgeArticles");
        b.HasKey(e => e.Id);
        b.Property(e => e.Title).HasMaxLength(250).IsRequired();
        b.Property(e => e.Category).HasMaxLength(100).IsRequired();
        b.Property(e => e.Content).HasMaxLength(8000).IsRequired();
        b.HasIndex(e => e.ProjectId);
        b.HasIndex(e => e.AuthorId);
    }
}
