using Microsoft.EntityFrameworkCore;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
using PMWDS.Infrastructure.Services;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Services;

public sealed class DocumentArchiveCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DocumentArchiveCleanupService> _logger;

    public DocumentArchiveCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<DocumentArchiveCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredDocumentsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Failed to purge expired archived documents.");
            }

            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }

    private async Task PurgeExpiredDocumentsAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var files = scope.ServiceProvider.GetRequiredService<ILocalFileStorageService>();
        var notifier = scope.ServiceProvider.GetRequiredService<IDataChangeNotifier>();
        var retentionDays = await db.AIGlobalSettings.AsNoTracking()
            .Select(setting => (int?)setting.DocumentArchiveRetentionDays)
            .FirstOrDefaultAsync(ct) ?? 30;
        var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
        var expired = await db.ProjectDocuments.IgnoreQueryFilters()
            .Where(document => document.IsDeleted && document.DeletedDate.HasValue && document.DeletedDate <= cutoff)
            .ToListAsync(ct);

        if (expired.Count == 0)
            return;

        foreach (var document in expired)
        {
            await files.DeleteFileAsync(document.FilePath, ct);
            db.ProjectDocuments.Remove(document);
        }

        await db.SaveChangesAsync(ct);
        foreach (var projectId in expired.Select(document => document.ProjectId).Distinct())
            await notifier.NotifyAsync(DataChangeScopes.Documents, null, projectId, ct);

        _logger.LogInformation("Purged {DocumentCount} archived documents past the {RetentionDays}-day retention period.", expired.Count, retentionDays);
    }
}
