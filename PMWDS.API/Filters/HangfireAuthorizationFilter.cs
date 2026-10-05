using Hangfire.Dashboard;
using PMWDS.Application.Security;
namespace PMWDS.API.Filters;

public class HangfireAuthorizationFilter
 : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        return http.User.Identity?.IsAuthenticated == true
        && http.User.IsInRole(RoleKeys.SuperAdmin);


    }
}
