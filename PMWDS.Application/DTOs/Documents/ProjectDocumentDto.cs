using PMWDS.Domain.Enums;

namespace PMWDS.Application.DTOs.Documents;

public record ProjectDocumentDto(
    Guid Id,
    Guid ProjectId,
    string? ProjectName,
    Guid? MilestoneId,
    string? MilestoneName,
    Guid? TaskId,
    string? TaskTitle,
    DocumentLevel Level,
    string Title,
    string FilePath,
    string ContentType,
    long FileSizeBytes,
    string UploadedByUserId,
    string? Description,
    string Version,
    DocumentCategory Category,
    DateTime CreatedDate);
