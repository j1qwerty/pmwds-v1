using System.Security.Claims;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
namespace PMWDS.API.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _http;
    public CurrentUserService(
    IHttpContextAccessor http)
    => _http = http;
    public string? UserId =>
    _http.HttpContext?.User
    .FindFirstValue(ClaimTypes.NameIdentifier);
    public string? UserName =>
    _http.HttpContext?.User
    .FindFirstValue(ClaimTypes.Name);
    public string? FullName => UserName;
    public string? Email =>
    _http.HttpContext?.User
    .FindFirstValue(ClaimTypes.Email);
    public Guid? DepartmentId
    {
        get
        {
            var val = _http.HttpContext?.User
            .FindFirstValue("DepartmentId");
            return Guid.TryParse(val, out var id)
            ? id : null;
        }
    }
    public bool IsAuthenticated =>
    _http.HttpContext?.User
    .Identity?.IsAuthenticated == true;
    public bool IsInRole(string role) =>
    _http.HttpContext?.User.IsInRole(role) == true ||
    _http.HttpContext?.User
    .FindAll(RoleKeys.RoleClaimType)
    .Any(claim => claim.Value.Equals(role, StringComparison.OrdinalIgnoreCase)) == true;
    public IEnumerable<string> Roles =>
    _http.HttpContext?.User
    .FindAll(RoleKeys.RoleClaimType)
    .Select(c => c.Value)
    ?? Enumerable.Empty<string>();
}
