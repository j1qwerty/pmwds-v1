using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class SeedConstants
{
    internal const string SeedUser = "system-seed";
    internal const string DefaultAiProvider = "OpenRouter";

    /// <summary>
    /// Password given to every account the seeder creates. There is deliberately no default:
    /// the value only ever comes from the environment, so a deployment cannot accidentally ship
    /// a well-known credential. Seeding fails with an explicit message when it is missing.
    /// </summary>
    internal static string DefaultPassword
    {
        get
        {
            var value = Environment.GetEnvironmentVariable("Seed__DefaultPassword");
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException(
                    "Seed__DefaultPassword is not set. Set it in the environment (.env locally, " +
                    "/etc/pmwds/pmwds.env on the server) to the password the seeded accounts should use. " +
                    "Seeding is aborted rather than falling back to a built-in password.");
            }

            return value;
        }
    }

    internal sealed record DepartmentSpec(string OrganizationName, string Name, string Code, string Description, int Capacity);
    internal sealed record AlertRuleSpec(string Name, string ConditionType, string Expression, string ActionType, object Parameters);
    internal sealed record IntegrationSpec(string Type, string Name, object Configuration, bool Enabled);
    internal sealed record AIProviderCredentialSpec(string Provider, string DisplayName, bool Enabled, string BaseUrl, string DefaultModel);
    internal sealed record RoleSpec(string Key, string Name, string Description, int Level, IReadOnlyCollection<string> PermissionCodes);
    internal sealed record UserSpec(string Email, string FirstName, string LastName, string EmployeeCode, string JobTitle, string Role, Guid? DepartmentId, AvailabilityStatus Availability, double AvailabilityPercent, double Performance, double Workload, double Burnout);
    internal sealed record ProjectSpec(string Name, string Description, string Category, ProjectPriority Priority, Guid DepartmentId, Guid ManagerId, DateTime Start, DateTime End, decimal Budget, decimal ActualCost, string Client, double Progress, double Health, double DelayRisk, double BudgetRisk, string Insight, string ProjectCode = "");
    internal sealed record TaskSpec(Guid ProjectId, Guid? MilestoneId, Guid? ParentTaskId, string Title, string Description, TaskPriority Priority, DateTime Start, DateTime Due, int EstimatedHours, Guid AssigneeId, Guid AssignedById, PMWDS.Domain.Enums.TaskStatus Status, double Progress, double DelayProbability, int ExpectedDelayDays, string Notes);
}
