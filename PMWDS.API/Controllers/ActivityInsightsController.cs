using MediatR;
using Microsoft.AspNetCore.Mvc;
using PMWDS.API.Services;
using PMWDS.Application.DTOs.Insights;
using PMWDS.Persistence.Context;

namespace PMWDS.API.Controllers;

/// <summary>
/// Pre-aggregated team activity. Shares the /api/v1/activitylogs prefix with
/// ActivityLogsController; "team/summary" does not overlap with its existing routes.
/// </summary>
[ApiController]
[Route("api/v1/activitylogs")]
public class ActivityInsightsController : BaseApiController
{
    private readonly ApplicationDbContext _db;
    private readonly RoleScopeService _scope;

    public ActivityInsightsController(
        IMediator mediator,
        ApplicationDbContext db,
        RoleScopeService scope) : base(mediator)
    {
        _db = db;
        _scope = scope;
    }

    /// <summary>
    /// GET /api/v1/activitylogs/team/summary?days=7
    /// Event counts per UTC day (and the top five event types per day) for the same set of
    /// users GET activitylogs/team returns. Every day in the range is present.
    /// </summary>
    [HttpGet("team/summary")]
    public async Task<IActionResult> GetTeamSummary(
        [FromQuery] int days = 7,
        CancellationToken ct = default)
    {
        var dayCount = Math.Clamp(days, 1, 31);
        var items = await InsightsQueries.LoadTeamActivityAsync(_db, _scope, dayCount, ct);
        return Ok(new ActivitySummaryDto(dayCount, items.Sum(item => item.Total), items));
    }
}
