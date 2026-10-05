using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using PMWDS.Application.DTOs.Common;

namespace PMWDS.API.Conventions;

public sealed class ProducesResponseTypeConvention : IApplicationModelConvention
{
    public void Apply(ApplicationModel application)
    {
        foreach (var controller in application.Controllers)
        {
            foreach (var action in controller.Actions)
            {
                AddIfMissing(action, StatusCodes.Status200OK);
                AddIfMissing(action, StatusCodes.Status400BadRequest);
                AddIfMissing(action, StatusCodes.Status401Unauthorized);
                AddIfMissing(action, StatusCodes.Status403Forbidden);
                AddIfMissing(action, StatusCodes.Status404NotFound);
                AddIfMissing(action, StatusCodes.Status500InternalServerError);

                // No blanket ResponseCache here. Every endpoint is auth-scoped, so a shared or
                // browser cache would serve one user's workspace data to another. Clients are
                // kept up to date by the DataChanged hub event plus a focus/poll safety net,
                // not by a TTL. See docs/realtime-sync-and-data-durability.md step 3a.
            }
        }
    }

    private static void AddIfMissing(ActionModel action, int statusCode)
    {
        if (action.Filters.OfType<ProducesResponseTypeAttribute>().Any(filter => filter.StatusCode == statusCode))
        {
            return;
        }

        action.Filters.Add(new ProducesResponseTypeAttribute(typeof(ApiResponse<object>), statusCode));
    }
}
