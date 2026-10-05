using System.Text.Json;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
namespace PMWDS.Infrastructure.Services;

public interface IAuditService : PMWDS.Application.Interfaces.Services.IAuditService
{
}
public class AuditService : PMWDS.Application.Interfaces.Services.IAuditService
{
    private readonly IUnitOfWork _uow;
    public AuditService(IUnitOfWork uow)
    => _uow = uow;
    public async Task LogAsync(
    string userId, string action,
    string entityType, string entityId,
    object? oldValues = null,
    object? newValues = null,
    string? ip = null,
    string? userAgent = null,
    bool isAI = false,
    string? aiModel = null,
    CancellationToken ct = default)
    {
        var log = AuditLog.Create(
        userId, action, entityType, entityId,
        oldValues is null ? null
        : JsonSerializer.Serialize(oldValues),
        newValues is null ? null
        : JsonSerializer.Serialize(newValues),
        ip, userAgent, isAI, aiModel);
        await _uow.AuditLogs.AddAsync(log, ct);
        await _uow.SaveChangesAsync(ct);
    }
}
