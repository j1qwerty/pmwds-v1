using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using PMWDS.Application.Interfaces.Services;

namespace PMWDS.Infrastructure.Services;

public sealed class SensitiveDataProtector : ISensitiveDataProtector
{
    private const string Prefix = "dp:v1:";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IDataProtector _protector;

    public SensitiveDataProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("PMWDS.SensitiveData.v1");
    }

    public string Protect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        return IsProtected(trimmed) ? trimmed : Prefix + _protector.Protect(trimmed);
    }

    public string? Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (!IsProtected(value))
        {
            return value;
        }

        return _protector.Unprotect(value[Prefix.Length..]);
    }

    public string ProtectJson(object? value)
        => Protect(JsonSerializer.Serialize(value ?? new Dictionary<string, object>(), JsonOptions));

    public T? UnprotectJson<T>(string? value)
    {
        var json = Unprotect(value);
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        return JsonSerializer.Deserialize<T>(json, JsonOptions);
    }

    public bool IsProtected(string? value)
        => value?.StartsWith(Prefix, StringComparison.Ordinal) == true;
}
