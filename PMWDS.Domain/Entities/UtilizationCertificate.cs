using PMWDS.Domain.Common;
using PMWDS.Domain.Enums;

namespace PMWDS.Domain.Entities;

/// <summary>
/// Finance metadata that qualifies an uploaded <see cref="ProjectDocument"/> as a
/// Utilization Certificate (UC). A UC is the formal proof that grant money,
/// government funds or a corporate contribution was spent strictly for its
/// intended purpose. It always points at the document row that carries the
/// actual file, and optionally at the milestone or task the spend relates to.
/// </summary>
public class UtilizationCertificate : BaseEntity
{
    public Guid ProjectId { get; private set; }
    public Guid DocumentId { get; private set; }

    /// <summary>Official certificate/reference number issued by the funding body.</summary>
    public string CertificateNumber { get; private set; } = string.Empty;

    /// <summary>Where the money came from, e.g. "Government Grant", "Client retainer".</summary>
    public string FundingSource { get; private set; } = string.Empty;

    /// <summary>Money sanctioned and released for this period.</summary>
    public decimal AmountClaimed { get; private set; }

    /// <summary>Money actually spent against <see cref="AmountClaimed"/>.</summary>
    public decimal AmountUtilized { get; private set; }

    /// <summary>Start of the accounting period the certificate covers.</summary>
    public DateTime PeriodStart { get; private set; }

    /// <summary>End of the accounting period the certificate covers.</summary>
    public DateTime PeriodEnd { get; private set; }

    public UtilizationCertificateStatus Status { get; private set; } = UtilizationCertificateStatus.Draft;

    /// <summary>Optional link to the milestone whose delivery this spend certifies.</summary>
    public Guid? MilestoneId { get; private set; }

    /// <summary>Optional link to the task whose delivery this spend certifies.</summary>
    public Guid? TaskId { get; private set; }

    public string? Purpose { get; private set; }

    public string SubmittedByUserId { get; private set; } = string.Empty;
    public DateTime? SubmittedOn { get; private set; }

    public string? ReviewedByUserId { get; private set; }
    public DateTime? ReviewedOn { get; private set; }

    /// <summary>Reviewer verdict, required when rejecting and optional when approving.</summary>
    public string? ReviewNotes { get; private set; }

    // ── Navigation ──
    /// <summary>The uploaded file this certificate describes.</summary>
    public ProjectDocument? Document { get; private set; }

    public Milestone? Milestone { get; private set; }

    public ProjectTask? Task { get; private set; }

    protected UtilizationCertificate() { }

    public static UtilizationCertificate Create(
        Guid projectId,
        Guid documentId,
        string certificateNumber,
        string fundingSource,
        decimal amountClaimed,
        decimal amountUtilized,
        DateTime periodStart,
        DateTime periodEnd,
        string submittedByUserId,
        Guid? milestoneId = null,
        Guid? taskId = null,
        string? purpose = null)
    {
        return new UtilizationCertificate
        {
            ProjectId = projectId,
            DocumentId = documentId,
            CertificateNumber = certificateNumber,
            FundingSource = fundingSource,
            AmountClaimed = amountClaimed,
            AmountUtilized = amountUtilized,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            SubmittedByUserId = submittedByUserId,
            MilestoneId = milestoneId,
            TaskId = taskId,
            Purpose = purpose,
            Status = UtilizationCertificateStatus.Draft
        };
    }

    /// <summary>Money left unspent in the period. Never goes below zero.</summary>
    public decimal GetUnutilizedAmount() => AmountClaimed - AmountUtilized < 0 ? 0 : AmountClaimed - AmountUtilized;

    /// <summary>Share of the claim actually spent, as a percentage rounded to 2 decimals.</summary>
    public decimal GetUtilizationPercentage()
        => AmountClaimed <= 0 ? 0 : Math.Round(AmountUtilized / AmountClaimed * 100m, 2);

    public void UpdateDetails(
        string certificateNumber,
        string fundingSource,
        decimal amountClaimed,
        decimal amountUtilized,
        DateTime periodStart,
        DateTime periodEnd,
        Guid? milestoneId = null,
        Guid? taskId = null,
        string? purpose = null)
    {
        CertificateNumber = certificateNumber;
        FundingSource = fundingSource;
        AmountClaimed = amountClaimed;
        AmountUtilized = amountUtilized;
        PeriodStart = periodStart;
        PeriodEnd = periodEnd;
        MilestoneId = milestoneId;
        TaskId = taskId;
        Purpose = purpose;
    }

    /// <summary>Only a draft or a rejected certificate can be edited or resubmitted.</summary>
    public bool IsEditable() =>
        Status == UtilizationCertificateStatus.Draft ||
        Status == UtilizationCertificateStatus.Rejected;

    /// <summary>
    /// Detaches the certificate from a task that is being deleted.
    /// </summary>
    /// <remarks>
    /// The <c>TaskId</c> foreign key cannot be <c>ON DELETE SET NULL</c> on SQL Server.
    /// Tasks cascade from Projects, and Projects already reaches this table through
    /// ProjectDocuments, so SQL Server sees a second cascading path and refuses the
    /// table - it permits only one cascade path per table. SQLite has no such limit, so
    /// the two providers cannot share one FK definition.
    ///
    /// The unlink is therefore performed in the application instead, in
    /// <c>TaskRepository.DeleteTaskGraphsByIdsAsync</c>, which every task-deletion path
    /// funnels through. This keeps behaviour identical on both providers: the certificate
    /// survives with a null <c>TaskId</c> rather than being deleted or blocking the
    /// delete.
    /// </remarks>
    public void UnlinkTask()
    {
        TaskId = null;
    }

    public void MarkAsSubmitted(DateTime submittedOn)
    {
        Status = UtilizationCertificateStatus.Submitted;
        SubmittedOn = submittedOn;
        ReviewNotes = null;
    }

    public void StartReview()
    {
        if (Status == UtilizationCertificateStatus.Approved) return;
        Status = UtilizationCertificateStatus.UnderReview;
    }

    public void Approve(string reviewerUserId, DateTime reviewedOn, string? notes)
    {
        Status = UtilizationCertificateStatus.Approved;
        ReviewedByUserId = reviewerUserId;
        ReviewedOn = reviewedOn;
        ReviewNotes = notes;
    }

    public void Reject(string reviewerUserId, DateTime reviewedOn, string? notes)
    {
        Status = UtilizationCertificateStatus.Rejected;
        ReviewedByUserId = reviewerUserId;
        ReviewedOn = reviewedOn;
        ReviewNotes = notes;
    }
}