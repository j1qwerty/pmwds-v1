using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;

namespace PMWDS.Domain.Entities;

public class ProjectDocument : BaseEntity
{
    public Guid ProjectId { get; private set; }
    public Guid? MilestoneId { get; private set; }
    public Guid? TaskId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string FilePath { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public string UploadedByUserId { get; private set; } = string.Empty;
    public DateTime? DeletedDate { get; private set; }
    public string? Description { get; private set; }
    public Project? Project { get; private set; }
    public Milestone? Milestone { get; private set; }
    public ProjectTask? Task { get; private set; }

    public string Version { get; private set; } = "1.0";

    /// <summary>
    /// Groups the document in the UI and decides whether extra metadata is required.
    /// Defaults to <see cref="DocumentCategory.General"/> so existing rows keep behaving as plain files.
    /// </summary>
    public DocumentCategory Category { get; private set; } = DocumentCategory.General;

    public DocumentLevel Level => TaskId.HasValue
        ? DocumentLevel.Task
        : MilestoneId.HasValue
            ? DocumentLevel.Milestone
            : DocumentLevel.Project;

    protected ProjectDocument() { }

    public static ProjectDocument Create(
    Guid projectId, string title,
    string filePath, string contentType,
    long sizeBytes, string userId,
    string? description = null,
    DocumentCategory category = DocumentCategory.General,
    Guid? milestoneId = null,
    Guid? taskId = null)
    {
        return new ProjectDocument
        {
            ProjectId = projectId,
            Title = SanitizeTitle(title),
            FilePath = filePath,
            ContentType = contentType,
            FileSizeBytes = sizeBytes,
            UploadedByUserId = userId,
            Description = description,
            Category = category,
            MilestoneId = milestoneId,
            TaskId = taskId
        };
    }

    /// <summary>
    /// The title is display-only, so strip control characters and any path structure a client may
    /// have sent. The file on disk is named separately, so the original name is not needed here and
    /// must never be able to influence where the file is written.
    /// </summary>
    private static string SanitizeTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return "document";
        }

        var cleaned = new string(title
            .Where(c => !char.IsControl(c))
            .ToArray())
            .Trim();

        var lastSeparator = cleaned.LastIndexOfAny(new[] { '/', '\\' });
        if (lastSeparator >= 0 && lastSeparator < cleaned.Length - 1)
        {
            cleaned = cleaned[(lastSeparator + 1)..];
        }

        return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
    }

    /// <summary>
    /// Guards against meaningless work-item links. A milestone reference is optional even for a
    /// task document: a task is not required to sit under a milestone, and <see cref="Level"/>
    /// already resolves the task level from <see cref="TaskId"/> alone. Requiring the milestone
    /// here would reject every document uploaded against a standalone task.
    /// </summary>
    public void ValidateHierarchy()
    {
        if (MilestoneId == Guid.Empty)
        {
            throw new InvalidOperationException("Milestone link is invalid.");
        }

        if (TaskId == Guid.Empty)
        {
            throw new InvalidOperationException("Task link is invalid.");
        }
    }

    /// <summary>A Utilization Certificate carries a finance approval lifecycle.</summary>
    public bool IsUtilizationCertificate() => Category == DocumentCategory.UtilizationCertificate;

    /// <summary>
    /// Detaches the task link. A document is uploaded evidence and the task is only the context
    /// it was filed under, so removing the task must never take the document with it.
    /// </summary>
    public void UnlinkTask() => TaskId = null;

    /// <summary>Detaches the milestone link, for the same reason as <see cref="UnlinkTask"/>.</summary>
    public void UnlinkMilestone() => MilestoneId = null;

    public void UpdateMetadata(string title, string? description, DocumentCategory category)
    {
        Title = SanitizeTitle(title);
        Description = description;
        Category = category == DocumentCategory.UtilizationCertificate
            ? DocumentCategory.General
            : category;
    }

    public void BumpVersion(string newVersion)
    => Version = newVersion;

    public void Archive(string userId)
    {
        DeletedDate ??= DateTime.UtcNow;
        SoftDelete(userId);
    }
}
