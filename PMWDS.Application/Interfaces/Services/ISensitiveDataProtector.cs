namespace PMWDS.Application.Interfaces.Services;

public interface ISensitiveDataProtector
{
    string Protect(string? value);
    string? Unprotect(string? value);
    string ProtectJson(object? value);
    T? UnprotectJson<T>(string? value);
    bool IsProtected(string? value);
}
