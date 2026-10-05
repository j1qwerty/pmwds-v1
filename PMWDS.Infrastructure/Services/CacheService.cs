using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using PMWDS.Application.Interfaces.Services;

namespace PMWDS.Infrastructure.Services;

public interface ICacheService : PMWDS.Application.Interfaces.Services.ICacheService
{
}

/// <summary>
/// Distributed cache over whatever <see cref="IDistributedCache"/> is registered
/// (Redis when reachable, in-memory otherwise - see the probe in Program.cs).
/// </summary>
/// <remarks>
/// Every operation degrades to a miss on failure. The cache is an optimisation, so a
/// cache outage must slow the app down at worst - it must never turn a page load into a
/// 500. See docs/realtime-sync-and-data-durability.md step 3c.
/// </remarks>
public class RedisCacheService : PMWDS.Application.Interfaces.Services.ICacheService
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisCacheService> _logger;

    private static readonly TimeSpan _defaultExpiry = TimeSpan.FromMinutes(30);

    public RedisCacheService(IDistributedCache cache, ILogger<RedisCacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        try
        {
            var data = await _cache.GetStringAsync(key, ct);
            return data is null ? default : JsonSerializer.Deserialize<T>(data);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Cache] Get failed for {Key}; treating as a miss.", key);
            return default;
        }
    }

    public async Task SetAsync<T>(
        string key, T value,
        TimeSpan? expiration = null,
        CancellationToken ct = default)
    {
        try
        {
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiration ?? _defaultExpiry
            };
            var json = JsonSerializer.Serialize(value);
            await _cache.SetStringAsync(key, json, options, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Cache] Set failed for {Key}; continuing without caching.", key);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _cache.RemoveAsync(key, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Cache] Remove failed for {Key}.", key);
        }
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        try
        {
            return await _cache.GetAsync(key, ct) is not null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Cache] Exists failed for {Key}; reporting false.", key);
            return false;
        }
    }
}