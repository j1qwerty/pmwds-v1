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
    DocumentCategory category = DocumentCategory.General)
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

    public void ValidateHierarchy()
    {
        if (TaskId.HasValue && !MilestoneId.HasValue)
        {
            throw new InvalidOperationException("Task documents must be linked to their milestone.");
        }

        if (MilestoneId.HasValue && TaskId.HasValue && MilestoneId == Guid.Empty)
        {
            throw new InvalidOperationException("Milestone link is invalid.");
        }
    }

    /// <summary>A Utilization Certificate carries a finance approval lifecycle.</summary>
    public bool IsUtilizationCertificate() => Category == DocumentCategory.UtilizationCertificate;

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
}