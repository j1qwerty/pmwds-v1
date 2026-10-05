using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

public class IntegrationsController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly ISensitiveDataProtector _sensitiveData;

    public IntegrationsController(IMediator mediator, IUnitOfWork uow, ICurrentUserService currentUser, ISensitiveDataProtector sensitiveData) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _sensitiveData = sensitiveData;
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok((await _uow.Integrations.GetAllAsync(ct)).Select(MapIntegration));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var integration = await _uow.Integrations.GetByIdAsync(id, ct);
        if (integration == null)
        {
            return NotFound();
        }

        var webhooks = (await _uow.Webhooks.FindAsync(w => w.IntegrationId == id, ct)).Select(WebhooksController.MapWebhook).ToList();
        return Ok(new IntegrationDetailResponse(MapIntegration(integration), webhooks));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Create([FromBody] UpsertIntegrationRequest req, CancellationToken ct)
    {
        var integration = Integration.CreateWithConfigurationJson(req.IntegrationType, req.Name, _sensitiveData.ProtectJson(req.Configuration), req.IsEnabled);
        integration.SetCreatedBy(_currentUser.UserId ?? "system");
        integration.MarkSynced(req.Status);
        await _uow.Integrations.AddAsync(integration, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = integration.Id }, MapIntegration(integration));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertIntegrationRequest req, CancellationToken ct)
    {
        var integration = await _uow.Integrations.GetByIdAsync(id, ct);
        if (integration == null)
        {
            return NotFound();
        }

        integration.UpdateConfigurationJson(req.IntegrationType, req.Name, _sensitiveData.ProtectJson(req.Configuration), req.IsEnabled, req.Status);
        await _uow.Integrations.UpdateAsync(integration, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapIntegration(integration));
    }

    [HttpPatch("{id:guid}/sync")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Sync(Guid id, [FromBody] SyncIntegrationRequest req, CancellationToken ct)
    {
        var integration = await _uow.Integrations.GetByIdAsync(id, ct);
        if (integration == null)
        {
            return NotFound();
        }

        integration.MarkSynced(req.Status);
        await _uow.Integrations.UpdateAsync(integration, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapIntegration(integration));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _uow.Integrations.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    private IntegrationResponse MapIntegration(Integration integration)
        => new(
            integration.Id,
            integration.IntegrationType,
            integration.Name,
            _sensitiveData.UnprotectJson<Dictionary<string, object>>(integration.ConfigurationJson) ?? new(),
            integration.IsActive,
            integration.LastSync,
            integration.Status);
}
