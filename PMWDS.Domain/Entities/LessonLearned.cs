using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class LessonLearned : AuditableEntity
{
    public Guid ProjectId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public string Impact { get; private set; } = string.Empty;
    public string KeywordsJson { get; private set; } = "[]";
    public DateTime RecordedDate { get; private set; } = DateTime.UtcNow;

    protected LessonLearned() { }

    public static LessonLearned Create(
        Guid projectId,
        string title,
        string description,
        string category,
        string impact,
        IEnumerable<string>? keywords)
    {
        return new LessonLearned
        {
            ProjectId = projectId,
            Title = title.Trim(),
            Description = description,
            Category = category.Trim(),
            Impact = impact.Trim(),
            KeywordsJson = JsonSerializer.Serialize(keywords ?? Enumerable.Empty<string>()),
            RecordedDate = DateTime.UtcNow
        };
    }

    public void Update(
        string title,
        string description,
        string category,
        string impact,
        IEnumerable<string>? keywords)
    {
        Title = title.Trim();
        Description = description;
        Category = category.Trim();
        Impact = impact.Trim();
        KeywordsJson = JsonSerializer.Serialize(keywords ?? Enumerable.Empty<string>());
        RecordedDate = DateTime.UtcNow;
    }
}
