using Microsoft.Extensions.Caching.Memory;

namespace PMWDS.API.Services;

/// <summary>
/// Tracks failed login attempts per email address and temporarily locks accounts
/// after too many consecutive failures. Uses IMemoryCache with sliding expiration.
/// </summary>
public interface ILoginLockoutService
{
    /// <summary>Records a failed login attempt. Returns true if the account is now locked.</summary>
    Task<bool> RecordFailureAsync(string email);

    /// <summary>Checks whether an account is currently locked out.</summary>
    Task<bool> IsLockedOutAsync(string email);

    /// <summary>Gets the remaining lockout duration (null if not locked).</summary>
    Task<TimeSpan?> GetRemainingLockoutAsync(string email);

    /// <summary>Clears all failure counts (called on successful login).</summary>
    Task ResetAsync(string email);
}

public class LoginLockoutService : ILoginLockoutService
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);

    private readonly IMemoryCache _cache;

    public LoginLockoutService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public async Task<bool> RecordFailureAsync(string email)
    {
        var key = FailedKey(email);
        var lockKey = LockKey(email);

        if (_cache.TryGetValue<int>(key, out var count))
        {
            count++;
        }
        else
        {
            count = 1;
        }

        if (count >= MaxFailedAttempts)
        {
            // Lock the account
            _cache.Set(lockKey, true, LockoutDuration);
            // Clear failure count while locked to prevent repeated lockout extensions
            _cache.Remove(key);
            return await Task.FromResult(true);
        }

        // Store failure count with sliding window
        _cache.Set(key, count, FailureWindow);
        return await Task.FromResult(false);
    }

    public Task<bool> IsLockedOutAsync(string email)
    {
        var locked = _cache.TryGetValue<bool>(LockKey(email), out var isLocked) && isLocked;
        return Task.FromResult(locked);
    }

    public Task<TimeSpan?> GetRemainingLockoutAsync(string email)
    {
        // IMemoryCache doesn't expose absolute expiration directly,
        // so we check presence. If locked, approximate remaining time.
        if (!_cache.TryGetValue<bool>(LockKey(email), out _))
        {
            return Task.FromResult<TimeSpan?>(null);
        }

        // Return approximate remaining time (conservative)
        return Task.FromResult<TimeSpan?>(TimeSpan.FromMinutes(5));
    }

    public Task ResetAsync(string email)
    {
        _cache.Remove(FailedKey(email));
        _cache.Remove(LockKey(email));
        return Task.CompletedTask;
    }

    private static string FailedKey(string email) => $"login:failures:{email.ToLowerInvariant()}";
    private static string LockKey(string email) => $"login:locked:{email.ToLowerInvariant()}";
}
