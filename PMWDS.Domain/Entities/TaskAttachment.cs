using PMWDS.Domain.Common;
namespace PMWDS.Domain.Entities;

public class TaskAttachment : BaseEntity
{
    public Guid TaskId { get; private set; }
    public string FileName { get; private set; } = string.Empty;
    public string FilePath { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long FileSizeBytes { get; private set; }
    public string UploadedByUserId { get; private set; } = string.Empty;
    protected TaskAttachment() { }
    public static TaskAttachment Create(
    Guid taskId, string fileName,
    string filePath, string contentType,
    long sizeBytes, string userId)
    {
        return new TaskAttachment
        {
            TaskId = taskId,
            FileName = fileName,
            FilePath = filePath,
            ContentType = contentType,
            FileSizeBytes = sizeBytes,
            UploadedByUserId = userId
        };
    }
}