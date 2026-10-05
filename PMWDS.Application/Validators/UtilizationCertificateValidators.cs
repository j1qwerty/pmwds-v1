using FluentValidation;
using PMWDS.Application.DTOs.Documents;

namespace PMWDS.Application.Validators;

/// <summary>
/// A Utilization Certificate must prove money was spent as intended, so the amounts
/// and the accounting period are validated strictly rather than merely being present.
/// </summary>
public sealed class SubmitUtilizationCertificateDtoValidator : AbstractValidator<SubmitUtilizationCertificateDto>
{
    public SubmitUtilizationCertificateDtoValidator()
    {
        RuleFor(x => x.CertificateNumber)
            .NotEmpty().WithMessage("Certificate number is required.")
            .MaximumLength(100);

        RuleFor(x => x.FundingSource)
            .NotEmpty().WithMessage("Funding source is required.")
            .MaximumLength(200);

        RuleFor(x => x.AmountClaimed)
            .GreaterThan(0).WithMessage("Amount claimed must be greater than zero.");

        RuleFor(x => x.AmountUtilized)
            .GreaterThanOrEqualTo(0).WithMessage("Amount utilized cannot be negative.")
            .LessThanOrEqualTo(x => x.AmountClaimed)
            .WithMessage("Amount utilized cannot exceed the amount claimed.");

        RuleFor(x => x.PeriodStart)
            .NotEqual(default(DateTime)).WithMessage("Period start is required.");

        RuleFor(x => x.PeriodEnd)
            .NotEqual(default(DateTime)).WithMessage("Period end is required.")
            .GreaterThanOrEqualTo(x => x.PeriodStart)
            .WithMessage("Period end cannot be before period start.");

        RuleFor(x => x.Purpose)
            .MaximumLength(2000);

        RuleFor(x => x.Title)
            .MaximumLength(300);

        RuleFor(x => x.Description)
            .MaximumLength(2000);

        // A certificate should be traceable to the work it pays for, but only one link is needed.
        RuleFor(x => x)
            .Must(x => !x.MilestoneId.HasValue || !x.TaskId.HasValue)
            .WithMessage("Link the certificate to either a milestone or a task, not both.");
    }
}

public sealed class UpdateUtilizationCertificateDtoValidator : AbstractValidator<UpdateUtilizationCertificateDto>
{
    public UpdateUtilizationCertificateDtoValidator()
    {
        RuleFor(x => x.CertificateNumber)
            .NotEmpty().WithMessage("Certificate number is required.")
            .MaximumLength(100);

        RuleFor(x => x.FundingSource)
            .NotEmpty().WithMessage("Funding source is required.")
            .MaximumLength(200);

        RuleFor(x => x.AmountClaimed)
            .GreaterThan(0).WithMessage("Amount claimed must be greater than zero.");

        RuleFor(x => x.AmountUtilized)
            .GreaterThanOrEqualTo(0).WithMessage("Amount utilized cannot be negative.")
            .LessThanOrEqualTo(x => x.AmountClaimed)
            .WithMessage("Amount utilized cannot exceed the amount claimed.");

        RuleFor(x => x.PeriodStart)
            .NotEqual(default(DateTime)).WithMessage("Period start is required.");

        RuleFor(x => x.PeriodEnd)
            .NotEqual(default(DateTime)).WithMessage("Period end is required.")
            .GreaterThanOrEqualTo(x => x.PeriodStart)
            .WithMessage("Period end cannot be before period start.");

        RuleFor(x => x.Purpose).MaximumLength(2000);
        RuleFor(x => x.Title).MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(2000);

        RuleFor(x => x)
            .Must(x => !x.MilestoneId.HasValue || !x.TaskId.HasValue)
            .WithMessage("Link the certificate to either a milestone or a task, not both.");
    }
}

public sealed class ReviewUtilizationCertificateDtoValidator : AbstractValidator<ReviewUtilizationCertificateDto>
{
    public ReviewUtilizationCertificateDtoValidator()
    {
        // Rejection without a reason is useless to the person who has to fix it.
        RuleFor(x => x)
            .Must(x => x.Approve || !string.IsNullOrWhiteSpace(x.Notes))
            .WithMessage("A reason is required when rejecting a utilization certificate.");

        RuleFor(x => x.Notes)
            .MaximumLength(2000);
    }
}