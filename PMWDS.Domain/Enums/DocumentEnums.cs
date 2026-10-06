namespace PMWDS.Domain.Enums;

public enum DocumentLevel
{
    Project = 0,
    Milestone = 1,
    Task = 2
}

namespace PMWDS.Domain.Enums;

/// <summary>
/// Classifies a project document so the UI can group, filter and badge documents.
/// A Utilization Certificate carries extra finance metadata and an approval lifecycle,
/// while every other category behaves like a plain uploaded file.
/// </summary>
public enum DocumentCategory
{
    General = 0,
    Plan = 1,
    Report = 2,
    Contract = 3,
    Compliance = 4,
    Financial = 5,
    UtilizationCertificate = 6
}

/// <summary>
/// Review lifecycle for a Utilization Certificate.
/// A UC is a formal proof that grant, government or corporate funds were spent
/// for their intended purpose, so it must be verified before it is accepted.
/// </summary>
public enum UtilizationCertificateStatus
{
    Draft = 0,
    Submitted = 1,
    UnderReview = 2,
    Approved = 3,
    Rejected = 4
}