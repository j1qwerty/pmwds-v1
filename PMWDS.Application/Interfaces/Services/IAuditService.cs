namespace PMWDS.Application.Interfaces.Services;
public interface IAuditService
{
 Task LogAsync(
 string userId,
 string action,
 string entityType,
 string entityId,
 object? oldValues = null,
 object? newValues = null,
 string? ip = null,
 string? userAgent = null,
 bool isAI = false,
 string? aiModel = null,
 CancellationToken ct = default);
}
