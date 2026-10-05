using Microsoft.EntityFrameworkCore;
using PMWDS.Domain.Common;
using PMWDS.Domain.Entities;

namespace PMWDS.Persistence.Context;

public class ApplicationDbContext : DbContext
{
    public DbSet<Department> Departments { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<ProjectDepartment> ProjectDepartments { get; set; }
    public DbSet<Milestone> Milestones { get; set; }
    public DbSet<MilestoneDependency> MilestoneDependencies { get; set; }
    public DbSet<ProjectTask> Tasks { get; set; }
    public DbSet<TaskDependency> TaskDependencies { get; set; }
    public DbSet<TaskAssignment> TaskAssignments { get; set; }
    public DbSet<TaskComment> TaskComments { get; set; }
    public DbSet<TaskAttachment> TaskAttachments { get; set; }
    public DbSet<TimeEntry> TimeEntries { get; set; }
    public DbSet<ProjectDocument> ProjectDocuments { get; set; }
    public DbSet<UtilizationCertificate> UtilizationCertificates { get; set; }
    public DbSet<ApplicationUser> Users { get; set; }
    public DbSet<Skill> Skills { get; set; }
    public DbSet<UserSkill> UserSkills { get; set; }
    public DbSet<UserDepartment> UserDepartments { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<UserProfile> UserProfiles { get; set; }
    public DbSet<Organization> Organizations { get; set; }
    public DbSet<AIModel> AIModels { get; set; }
    public DbSet<TaskAllocationModel> TaskAllocationModels { get; set; }
    public DbSet<DelayPredictionModel> DelayPredictionModels { get; set; }
    public DbSet<PredictionResult> PredictionResults { get; set; }
    public DbSet<TrainingDataPoint> TrainingDataPoints { get; set; }
    public DbSet<AllocationRecommendation> AllocationRecommendations { get; set; }
    public DbSet<DelayPrediction> DelayPredictions { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<NotificationTemplate> NotificationTemplates { get; set; }
    public DbSet<AlertRule> AlertRules { get; set; }
    public DbSet<Dashboard> Dashboards { get; set; }
    public DbSet<DashboardWidget> DashboardWidgets { get; set; }
    public DbSet<Report> Reports { get; set; }
    public DbSet<ReportSchedule> ReportSchedules { get; set; }
    public DbSet<Integration> Integrations { get; set; }
    public DbSet<Webhook> Webhooks { get; set; }
    public DbSet<WebhookDelivery> WebhookDeliveries { get; set; }
    public DbSet<KnowledgeArticle> KnowledgeArticles { get; set; }
    public DbSet<LessonLearned> LessonsLearned { get; set; }
    public DbSet<ActivityLog> ActivityLogs { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<AIProviderCredential> AIProviderCredentials { get; set; }
    public DbSet<AIGlobalSetting> AIGlobalSettings { get; set; }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType) &&
                entityType.BaseType == null)
            {
                var entity = builder.Entity(entityType.ClrType);

                entity.HasQueryFilter(GetSoftDeleteFilter(entityType.ClrType));
                entity.Property(nameof(BaseEntity.RowVersion))
                    .IsConcurrencyToken();
            }
        }
    }

    private static System.Linq.Expressions.LambdaExpression GetSoftDeleteFilter(Type type)
    {
        var param = System.Linq.Expressions.Expression.Parameter(type, "e");
        var prop = System.Linq.Expressions.Expression.Property(param, "IsDeleted");
        var cond = System.Linq.Expressions.Expression.Equal(
            prop,
            System.Linq.Expressions.Expression.Constant(false));

        return System.Linq.Expressions.Expression.Lambda(cond, param);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.SetModified(entry.Entity.ModifiedBy ?? "system");
            }
        }

        return await base.SaveChangesAsync(ct);
    }
}
