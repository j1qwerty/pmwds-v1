using MediatR;
using PMWDS.Application.Common;
using Microsoft.EntityFrameworkCore.Storage;
using PMWDS.Application.Interfaces.Repositories;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Common;
using PMWDS.Domain.Entities;
using PMWDS.Persistence.Context;

namespace PMWDS.Persistence.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;
    private readonly IPublisher _publisher;
    private IDbContextTransaction? _transaction;

    public IProjectRepository Projects { get; }
    public ITaskRepository Tasks { get; }
    public IUserRepository Users { get; }

    public IRepository<Department> Departments { get; }
    public IRepository<Milestone> Milestones { get; }
    public IRepository<Notification> Notifications { get; }
    public IRepository<NotificationTemplate> NotificationTemplates { get; }
    public IRepository<AlertRule> AlertRules { get; }
    public IRepository<Dashboard> Dashboards { get; }
    public IRepository<DashboardWidget> DashboardWidgets { get; }
    public IRepository<Report> Reports { get; }
    public IRepository<ReportSchedule> ReportSchedules { get; }
    public IRepository<Integration> Integrations { get; }
    public IRepository<Webhook> Webhooks { get; }
    public IRepository<WebhookDelivery> WebhookDeliveries { get; }
    public IRepository<KnowledgeArticle> KnowledgeArticles { get; }
    public IRepository<LessonLearned> LessonsLearned { get; }
    public IRepository<ActivityLog> ActivityLogs { get; }
    public IRepository<AuditLog> AuditLogs { get; }
    public IRepository<Skill> Skills { get; }
    public IRepository<Role> Roles { get; }
    public IRepository<Permission> Permissions { get; }
    public IRepository<UserProfile> UserProfiles { get; }
    public IRepository<Organization> Organizations { get; }
    public IRepository<AIModel> AIModels { get; }
    public IRepository<PredictionResult> PredictionResults { get; }
    public IRepository<TrainingDataPoint> TrainingDataPoints { get; }
    public IRepository<AllocationRecommendation> AllocationRecommendations { get; }
    public IRepository<DelayPrediction> DelayPredictions { get; }
    public IRepository<ProjectDocument> ProjectDocuments { get; }
    public IRepository<UtilizationCertificate> UtilizationCertificates { get; }
    public IRepository<UserSkill> UserSkills { get; }
    public IRepository<TaskAssignment> TaskAssignments { get; }
    public IRepository<TaskComment> TaskComments { get; }
    public IRepository<TaskAttachment> TaskAttachments { get; }
    public IRepository<TaskDependency> TaskDependencies { get; }
    public IRepository<MilestoneDependency> MilestoneDependencies { get; }
    public IRepository<TimeEntry> TimeEntries { get; }

    public UnitOfWork(ApplicationDbContext context, IPublisher publisher)
    {
        _context = context;
        _publisher = publisher;

        Projects = new ProjectRepository(context);
        Tasks = new TaskRepository(context);
        Users = new UserRepository(context);

        Departments = new EfRepository<Department>(context);
        Milestones = new EfRepository<Milestone>(context);
        Notifications = new EfRepository<Notification>(context);
        NotificationTemplates = new EfRepository<NotificationTemplate>(context);
        AlertRules = new EfRepository<AlertRule>(context);
        Dashboards = new EfRepository<Dashboard>(context);
        DashboardWidgets = new EfRepository<DashboardWidget>(context);
        Reports = new EfRepository<Report>(context);
        ReportSchedules = new EfRepository<ReportSchedule>(context);
        Integrations = new EfRepository<Integration>(context);
        Webhooks = new EfRepository<Webhook>(context);
        WebhookDeliveries = new EfRepository<WebhookDelivery>(context);
        KnowledgeArticles = new EfRepository<KnowledgeArticle>(context);
        LessonsLearned = new EfRepository<LessonLearned>(context);
        ActivityLogs = new EfRepository<ActivityLog>(context);
        AuditLogs = new EfRepository<AuditLog>(context);
        Skills = new EfRepository<Skill>(context);
        Roles = new EfRepository<Role>(context);
        Permissions = new EfRepository<Permission>(context);
        UserProfiles = new EfRepository<UserProfile>(context);
        Organizations = new EfRepository<Organization>(context);
        AIModels = new EfRepository<AIModel>(context);
        PredictionResults = new EfRepository<PredictionResult>(context);
        TrainingDataPoints = new EfRepository<TrainingDataPoint>(context);
        AllocationRecommendations = new EfRepository<AllocationRecommendation>(context);
        DelayPredictions = new EfRepository<DelayPrediction>(context);
        ProjectDocuments = new EfRepository<ProjectDocument>(context);
        UtilizationCertificates = new EfRepository<UtilizationCertificate>(context);
        UserSkills = new EfRepository<UserSkill>(context);
        TaskAssignments = new EfRepository<TaskAssignment>(context);
        TaskComments = new EfRepository<TaskComment>(context);
        TaskAttachments = new EfRepository<TaskAttachment>(context);
        TaskDependencies = new EfRepository<TaskDependency>(context);
        MilestoneDependencies = new EfRepository<MilestoneDependency>(context);
        TimeEntries = new EfRepository<TimeEntry>(context);
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var result = await _context.SaveChangesAsync(ct);

        var domainEventEntities = _context.ChangeTracker
            .Entries<IHasDomainEvents>()
            .Select(entry => entry.Entity)
            .Where(entity => entity.DomainEvents.Count > 0)
            .ToList();

        var domainEvents = domainEventEntities
            .SelectMany(entity => entity.DomainEvents)
            .ToList();

        foreach (var entity in domainEventEntities)
        {
            entity.ClearDomainEvents();
        }

        foreach (var domainEvent in domainEvents)
        {
            var notificationType = typeof(DomainEventNotification<>).MakeGenericType(domainEvent.GetType());
            var notification = Activator.CreateInstance(notificationType, domainEvent);
            await _publisher.Publish(notification!, ct);
        }

        return result;
    }

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction != null)
        {
            return;
        }

        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task CommitTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction == null)
        {
            return;
        }

        await _transaction.CommitAsync(ct);
        await _transaction.DisposeAsync();
        _transaction = null;
    }

    public async Task RollbackTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction == null)
        {
            return;
        }

        await _transaction.RollbackAsync(ct);
        await _transaction.DisposeAsync();
        _transaction = null;
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
