using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

public class DashboardsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly IDataChangeNotifier _changes;

    public DashboardsController(IMediator mediator, IUnitOfWork uow, ICurrentUserService currentUser, IDataChangeNotifier changes) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _changes = changes;
    }

    [HttpGet]
    public async Task<IActionResult> GetMine(CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
        {
            return Unauthorized();
        }

        var dashboards = await _uow.Dashboards.FindAsync(d => d.UserId == userId, ct);
        var widgets = await _uow.DashboardWidgets.GetAllAsync(ct);
        return Ok(dashboards.Select(d => MapDashboard(d, widgets.Where(w => w.DashboardId == d.Id).ToList())));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var dashboard = await _uow.Dashboards.GetByIdAsync(id, ct);
        if (dashboard == null)
        {
            return NotFound();
        }

        var widgets = (await _uow.DashboardWidgets.FindAsync(w => w.DashboardId == id, ct)).OrderBy(w => w.DisplayOrder).ToList();
        return Ok(MapDashboard(dashboard, widgets));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertDashboardRequest req, CancellationToken ct)
    {
        if (!Guid.TryParse(_currentUser.UserId, out var userId))
        {
            return Unauthorized();
        }

        var dashboard = Dashboard.Create(userId, req.Name, req.LayoutType, req.IsDefault);
        dashboard.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.Dashboards.AddAsync(dashboard, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return CreatedAtAction(nameof(GetById), new { id = dashboard.Id }, MapDashboard(dashboard, new List<DashboardWidget>()));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertDashboardRequest req, CancellationToken ct)
    {
        var dashboard = await _uow.Dashboards.GetByIdAsync(id, ct);
        if (dashboard == null)
        {
            return NotFound();
        }

        dashboard.Update(req.Name, req.LayoutType, req.IsDefault);
        await _uow.Dashboards.UpdateAsync(dashboard, ct);
        await _uow.SaveChangesAsync(ct);

        var widgets = (await _uow.DashboardWidgets.FindAsync(w => w.DashboardId == id, ct)).OrderBy(w => w.DisplayOrder).ToList();
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return Ok(MapDashboard(dashboard, widgets));
    }

    [HttpPost("{id:guid}/widgets")]
    public async Task<IActionResult> AddWidget(Guid id, [FromBody] UpsertDashboardWidgetRequest req, CancellationToken ct)
    {
        var dashboard = await _uow.Dashboards.GetByIdAsync(id, ct);
        if (dashboard == null)
        {
            return NotFound();
        }

        var widget = DashboardWidget.Create(id, req.WidgetType, req.Title, req.Configuration, req.RefreshInterval, req.RequiredPermissions, req.DisplayOrder);
        widget.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.DashboardWidgets.AddAsync(widget, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return CreatedAtAction(nameof(GetById), new { id }, MapWidget(widget));
    }

    [HttpPut("widgets/{widgetId:guid}")]
    public async Task<IActionResult> UpdateWidget(Guid widgetId, [FromBody] UpsertDashboardWidgetRequest req, CancellationToken ct)
    {
        var widget = await _uow.DashboardWidgets.GetByIdAsync(widgetId, ct);
        if (widget == null)
        {
            return NotFound();
        }

        widget.Update(req.WidgetType, req.Title, req.Configuration, req.RefreshInterval, req.RequiredPermissions);
        widget.SetDisplayOrder(req.DisplayOrder);
        await _uow.DashboardWidgets.UpdateAsync(widget, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return Ok(MapWidget(widget));
    }

    [HttpPatch("{id:guid}/widgets/reorder")]
    public async Task<IActionResult> ReorderWidgets(Guid id, [FromBody] ReorderDashboardWidgetsRequest req, CancellationToken ct)
    {
        var widgets = (await _uow.DashboardWidgets.FindAsync(w => w.DashboardId == id, ct)).ToList();
        var positions = req.WidgetIds.Select((widgetId, index) => new { widgetId, index }).ToDictionary(x => x.widgetId, x => x.index);
        foreach (var widget in widgets)
        {
            if (positions.TryGetValue(widget.Id, out var order))
            {
                widget.SetDisplayOrder(order);
                await _uow.DashboardWidgets.UpdateAsync(widget, ct);
            }
        }

        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return NoContent();
    }

    [HttpDelete("widgets/{widgetId:guid}")]
    public async Task<IActionResult> DeleteWidget(Guid widgetId, CancellationToken ct)
    {
        await _uow.DashboardWidgets.DeleteAsync(widgetId, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _uow.Dashboards.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        await _changes.NotifyAsync(DataChangeScopes.Dashboards, null, null, ct);
        return NoContent();
    }

    private static DashboardResponse MapDashboard(Dashboard dashboard, List<DashboardWidget> widgets)
        => new(
            dashboard.Id,
            dashboard.UserId,
            dashboard.Name,
            dashboard.LayoutType,
            dashboard.IsDefault,
            dashboard.LastAccessed,
            widgets.OrderBy(w => w.DisplayOrder).Select(MapWidget).ToList());

    private static DashboardWidgetResponse MapWidget(DashboardWidget widget)
        => new(
            widget.Id,
            widget.DashboardId,
            widget.WidgetType,
            widget.Title,
            JsonSerializer.Deserialize<Dictionary<string, object>>(widget.ConfigurationJson) ?? new(),
            widget.RefreshInterval,
            widget.LastRefreshed,
            JsonSerializer.Deserialize<List<string>>(widget.RequiredPermissionsJson) ?? new(),
            widget.DisplayOrder);
}
