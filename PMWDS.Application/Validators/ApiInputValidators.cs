using FluentValidation;
using PMWDS.Application.DTOs.Controllers;
using PMWDS.Application.DTOs.Projects;
using PMWDS.Application.DTOs.Tasks;
using PMWDS.Application.DTOs.Users;

namespace PMWDS.Application.Validators;

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class SignupRequestValidator : AbstractValidator<SignupRequest>
{
    public SignupRequestValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.OldPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
        => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public sealed class CreateProjectDtoValidator : AbstractValidator<CreateProjectDto>
{
    public CreateProjectDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DepartmentId).NotEmpty();
        RuleFor(x => x.PlannedStartDate).LessThanOrEqualTo(x => x.PlannedEndDate);
        RuleFor(x => x.PlannedBudget).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateProjectDtoValidator : AbstractValidator<UpdateProjectDto>
{
    public UpdateProjectDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DepartmentId).NotEmpty();
        RuleFor(x => x.PlannedStartDate).LessThanOrEqualTo(x => x.PlannedEndDate);
        RuleFor(x => x.PlannedBudget).GreaterThanOrEqualTo(0);
    }
}

public sealed class CreateTaskDtoValidator : AbstractValidator<CreateTaskDto>
{
    public CreateTaskDtoValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.StartDate).LessThanOrEqualTo(x => x.DueDate);
        RuleFor(x => x.EstimatedHours).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateTaskDtoValidator : AbstractValidator<UpdateTaskDto>
{
    public UpdateTaskDtoValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.StartDate).LessThanOrEqualTo(x => x.DueDate);
        RuleFor(x => x.EstimatedHours).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateTaskProgressDtoValidator : AbstractValidator<UpdateTaskProgressDto>
{
    public UpdateTaskProgressDtoValidator()
        => RuleFor(x => x.ProgressPercentage).InclusiveBetween(0, 100);
}

public sealed class AssignTaskRequestValidator : AbstractValidator<AssignTaskRequest>
{
    public AssignTaskRequestValidator()
    {
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.AssigneeId) || (x.AssigneeIds?.Count > 0))
            .WithMessage("At least one assignee is required.");
    }
}

public sealed class AddCommentRequestValidator : AbstractValidator<AddCommentRequest>
{
    public AddCommentRequestValidator()
        => RuleFor(x => x.Comment).NotEmpty().MaximumLength(4000);
}

public sealed class StartTimerRequestValidator : AbstractValidator<StartTimerRequest>
{
    public StartTimerRequestValidator()
        => RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
}

public sealed class CreateDepartmentDtoValidator : AbstractValidator<CreateDepartmentDto>
{
    public CreateDepartmentDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.MaxCapacity).GreaterThan(0).When(x => x.MaxCapacity.HasValue);
    }
}

public sealed class UpdateDepartmentDtoValidator : AbstractValidator<UpdateDepartmentDto>
{
    public UpdateDepartmentDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.MaxCapacity).GreaterThan(0).When(x => x.MaxCapacity.HasValue);
    }
}

public sealed class UpsertOrganizationRequestValidator : AbstractValidator<UpsertOrganizationRequest>
{
    public UpsertOrganizationRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.ContactEmail));
    }
}

public sealed class UpsertKnowledgeArticleRequestValidator : AbstractValidator<UpsertKnowledgeArticleRequest>
{
    public UpsertKnowledgeArticleRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Content).NotEmpty();
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.RelevanceScore).InclusiveBetween(0, 1);
    }
}

public sealed class UpsertLessonLearnedRequestValidator : AbstractValidator<UpsertLessonLearnedRequest>
{
    public UpsertLessonLearnedRequestValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Description).NotEmpty();
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
    }
}

public sealed class ChatRequestValidator : AbstractValidator<ChatRequest>
{
    public ChatRequestValidator()
        => RuleFor(x => x.Message).NotEmpty().MaximumLength(8000);
}

public sealed class AddUserSkillRequestValidator : AbstractValidator<AddUserSkillRequest>
{
    public AddUserSkillRequestValidator()
    {
        RuleFor(x => x.SkillId).NotEmpty();
        RuleFor(x => x.ProficiencyLevel).InclusiveBetween(1, 5);
        RuleFor(x => x.ExperienceMonths).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateUserSkillRequestValidator : AbstractValidator<UpdateUserSkillRequest>
{
    public UpdateUserSkillRequestValidator()
    {
        RuleFor(x => x.ProficiencyLevel).InclusiveBetween(1, 5);
        RuleFor(x => x.ExperienceMonths).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateAvailabilityRequestValidator : AbstractValidator<UpdateAvailabilityRequest>
{
    public UpdateAvailabilityRequestValidator()
        => RuleFor(x => x.AvailabilityPercentage).InclusiveBetween(0, 100);
}

public sealed class CreateSkillDtoValidator : AbstractValidator<CreateSkillDto>
{
    public CreateSkillDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
    }
}

public sealed class UpdateSkillDtoValidator : AbstractValidator<UpdateSkillDto>
{
    public UpdateSkillDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
    }
}
