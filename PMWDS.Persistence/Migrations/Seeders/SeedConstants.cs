using PMWDS.Domain.Entities;
using PMWDS.Domain.Enums;

namespace PMWDS.Persistence.Migrations.Seeders;

internal static class SeedConstants
{
    internal const string SeedUser = "system-seed";
    internal const string DefaultPassword = "Pmwds@123";
    internal const string DefaultAiProvider = "OpenRouter";

    internal sealed record DepartmentSpec(string OrganizationName, string Name, string Code, string Description, int Capacity);
    internal sealed record AlertRuleSpec(string Name, string ConditionType, string Expression, string ActionType, object Parameters);
    internal sealed record IntegrationSpec(string Type, string Name, object Configuration, bool Enabled);
    internal sealed record AIProviderCredentialSpec(string Provider, string DisplayName, bool Enabled, string BaseUrl, string DefaultModel);
    internal sealed record RoleSpec(string Key, string Name, string Description, int Level, IReadOnlyCollection<string> PermissionCodes);
    internal sealed record UserSpec(string Email, string FirstName, string LastName, string EmployeeCode, string JobTitle, string Role, Guid? DepartmentId, AvailabilityStatus Availability, double AvailabilityPercent, double Performance, double Workload, double Burnout);
    internal sealed record ProjectSpec(string Name, string Description, string Category, ProjectPriority Priority, Guid DepartmentId, Guid ManagerId, DateTime Start, DateTime End, decimal Budget, decimal ActualCost, string Client, double Progress, double Health, double DelayRisk, double BudgetRisk, string Insight, string ProjectCode = "");
    internal sealed record TaskSpec(Guid ProjectId, Guid? MilestoneId, Guid? ParentTaskId, string Title, string Description, TaskPriority Priority, DateTime Start, DateTime Due, int EstimatedHours, Guid AssigneeId, Guid AssignedById, PMWDS.Domain.Enums.TaskStatus Status, double Progress, double DelayProbability, int ExpectedDelayDays, string Notes);
}
