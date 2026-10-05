using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class KnowledgeArticle : AuditableEntity
{
    public Guid? ProjectId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public string TagsJson { get; private set; } = "[]";
    public Guid AuthorId { get; private set; }
    public DateTime LastUpdated { get; private set; } = DateTime.UtcNow;
    public int ViewCount { get; private set; }
    public double RelevanceScore { get; private set; }

    protected KnowledgeArticle() { }

    public static KnowledgeArticle Create(
        Guid? projectId,
        string title,
        string content,
        string category,
        IEnumerable<string>? tags,
        Guid authorId,
        double relevanceScore = 0)
    {
        return new KnowledgeArticle
        {
            ProjectId = projectId,
            Title = title.Trim(),
            Content = content,
            Category = category.Trim(),
            TagsJson = JsonSerializer.Serialize(tags ?? Enumerable.Empty<string>()),
            AuthorId = authorId,
            LastUpdated = DateTime.UtcNow,
            RelevanceScore = relevanceScore
        };
    }

    public void Update(string title, string content, string category, IEnumerable<string>? tags, double relevanceScore)
    {
        Title = title.Trim();
        Content = content;
        Category = category.Trim();
        TagsJson = JsonSerializer.Serialize(tags ?? Enumerable.Empty<string>());
        RelevanceScore = relevanceScore;
        LastUpdated = DateTime.UtcNow;
    }

    public void IncrementViewCount()
    {
        ViewCount++;
    }
}
