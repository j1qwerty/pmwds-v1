using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

namespace PMWDS.Application.DTOs.Documents;

/// <summary>
/// Upload request for a Utilization Certificate. The file itself is the formal
/// proof document; the remaining fields capture the money and period it certifies.
/// </summary>
public record SubmitUtilizationCertificateDto(
    Guid ProjectId,
    string CertificateNumber,
    string FundingSource,
    decimal AmountClaimed,
    decimal AmountUtilized,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    Guid? MilestoneId = null,
    Guid? TaskId = null,
    string? Purpose = null,
    string? Title = null,
    string? Description = null);

/// <summary>Metadata edit for an existing draft / rejected certificate. The file is immutable.</summary>
public record UpdateUtilizationCertificateDto(
    string CertificateNumber,
    string FundingSource,
    decimal AmountClaimed,
    decimal AmountUtilized,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    Guid? MilestoneId = null,
    Guid? TaskId = null,
    string? Purpose = null,
    string? Title = null,
    string? Description = null);

public record ReviewUtilizationCertificateDto(
    bool Approve,
    string? Notes = null);

/// <summary>
/// What the signed-in user may do with one specific certificate, resolved on the
/// server. The UI renders straight from these flags so a stale JWT can never show
/// an action the API would reject (or hide one it would allow).
/// </summary>
public record UtilizationCertificateCapabilities(
    bool CanEdit,
    bool CanSubmitForReview,
    bool CanReview,
    bool CanDelete,
    bool IsOwner);

public record UtilizationCertificateDto(
    Guid Id,
    Guid ProjectId,
    Guid DocumentId,
    string CertificateNumber,
    string FundingSource,
    decimal AmountClaimed,
    decimal AmountUtilized,
    decimal UnutilizedAmount,
    decimal UtilizationPercentage,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    UtilizationCertificateStatus Status,
    Guid? MilestoneId,
    Guid? TaskId,
    string? MilestoneTitle,
    string? TaskTitle,
    string? Purpose,
    string SubmittedByUserId,
    DateTime? SubmittedOn,
    string? ReviewedByUserId,
    DateTime? ReviewedOn,
    string? ReviewNotes,
    DateTime CreatedDate,
    // Denormalized document info so the list can render without a second round-trip.
    string Title,
    string FilePath,
    string ContentType,
    long FileSizeBytes,
    UtilizationCertificateCapabilities Capabilities)
{
    public static UtilizationCertificateDto FromEntity(
        UtilizationCertificate certificate,
        UtilizationCertificateCapabilities capabilities,
        ProjectDocument? document = null,
        string? milestoneTitle = null,
        string? taskTitle = null) => new(
        certificate.Id,
        certificate.ProjectId,
        certificate.DocumentId,
        certificate.CertificateNumber,
        certificate.FundingSource,
        certificate.AmountClaimed,
        certificate.AmountUtilized,
        certificate.GetUnutilizedAmount(),
        certificate.GetUtilizationPercentage(),
        certificate.PeriodStart,
        certificate.PeriodEnd,
        certificate.Status,
        certificate.MilestoneId,
        certificate.TaskId,
        milestoneTitle,
        taskTitle,
        certificate.Purpose,
        certificate.SubmittedByUserId,
        certificate.SubmittedOn,
        certificate.ReviewedByUserId,
        certificate.ReviewedOn,
        certificate.ReviewNotes,
        certificate.CreatedDate,
        document?.Title ?? string.Empty,
        document?.FilePath ?? string.Empty,
        document?.ContentType ?? "application/octet-stream",
        document?.FileSizeBytes ?? 0,
        capabilities);
}
public record UtilizationCertificateUploadCapabilitiesDto(
    bool CanUploadProject,
    bool CanUploadMilestone,
    bool CanUploadTask);
