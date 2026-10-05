using PMWDS.Application.Interfaces.Repositories;
namespace PMWDS.Application.Interfaces.Services;

public interface IUnitOfWork : IDisposable
{
    IProjectRepository Projects { get; }
    ITaskRepository Tasks { get; }
    IUserRepository Users { get; }
    IRepository<Domain.Entities.Department> Departments { get; }
    IRepository<Domain.Entities.Milestone> Milestones { get; }
    IRepository<Domain.Entities.Notification> Notifications { get; }
    IRepository<Domain.Entities.NotificationTemplate> NotificationTemplates { get; }
    IRepository<Domain.Entities.AlertRule> AlertRules { get; }
    IRepository<Domain.Entities.Dashboard> Dashboards { get; }
    IRepository<Domain.Entities.DashboardWidget> DashboardWidgets { get; }
    IRepository<Domain.Entities.Report> Reports { get; }
    IRepository<Domain.Entities.ReportSchedule> ReportSchedules { get; }
    IRepository<Domain.Entities.Integration> Integrations { get; }
    IRepository<Domain.Entities.Webhook> Webhooks { get; }
    IRepository<Domain.Entities.WebhookDelivery> WebhookDeliveries { get; }
    IRepository<Domain.Entities.KnowledgeArticle> KnowledgeArticles { get; }
    IRepository<Domain.Entities.LessonLearned> LessonsLearned { get; }
    IRepository<Domain.Entities.ActivityLog> ActivityLogs { get; }
    IRepository<Domain.Entities.AuditLog> AuditLogs { get; }
    IRepository<Domain.Entities.Skill> Skills { get; }
    IRepository<Domain.Entities.Role> Roles { get; }
    IRepository<Domain.Entities.Permission> Permissions { get; }
    IRepository<Domain.Entities.UserProfile> UserProfiles { get; }
    IRepository<Domain.Entities.Organization> Organizations { get; }
    IRepository<Domain.Entities.AIModel> AIModels { get; }
    IRepository<Domain.Entities.PredictionResult> PredictionResults { get; }
    IRepository<Domain.Entities.TrainingDataPoint> TrainingDataPoints { get; }
    IRepository<Domain.Entities.AllocationRecommendation> AllocationRecommendations { get; }
    IRepository<Domain.Entities.DelayPrediction> DelayPredictions { get; }
    IRepository<Domain.Entities.ProjectDocument> ProjectDocuments { get; }
    IRepository<Domain.Entities.UtilizationCertificate> UtilizationCertificates { get; }
    IRepository<Domain.Entities.UserSkill> UserSkills { get; }
    IRepository<Domain.Entities.TaskAssignment> TaskAssignments { get; }
    IRepository<Domain.Entities.TaskComment> TaskComments { get; }
    IRepository<Domain.Entities.TaskAttachment> TaskAttachments { get; }
    IRepository<Domain.Entities.TaskDependency> TaskDependencies { get; }
    IRepository<Domain.Entities.MilestoneDependency> MilestoneDependencies { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitTransactionAsync(CancellationToken ct = default);
    Task RollbackTransactionAsync(CancellationToken ct = default);
}
