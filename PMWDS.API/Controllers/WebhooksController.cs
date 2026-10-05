using PMWDS.Application.DTOs.Controllers;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Application.Security;
using PMWDS.Domain.Entities;

namespace PMWDS.API.Controllers;

public class WebhooksController : BaseApiController
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly ISensitiveDataProtector _sensitiveData;

    public WebhooksController(IMediator mediator, IUnitOfWork uow, ICurrentUserService currentUser, ISensitiveDataProtector sensitiveData) : base(mediator)
    {
        _uow = uow;
        _currentUser = currentUser;
        _sensitiveData = sensitiveData;
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetAll([FromQuery] Guid? integrationId, CancellationToken ct)
    {
        var webhooks = integrationId.HasValue
            ? await _uow.Webhooks.FindAsync(w => w.IntegrationId == integrationId, ct)
            : await _uow.Webhooks.GetAllAsync(ct);

        return Ok(webhooks.Select(MapWebhook));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.Manager)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var webhook = await _uow.Webhooks.GetByIdAsync(id, ct);
        if (webhook == null)
        {
            return NotFound();
        }

        var deliveries = (await _uow.WebhookDeliveries.FindAsync(d => d.WebhookId == id, ct))
            .OrderByDescending(d => d.AttemptedAt)
            .Select(MapDelivery)
            .ToList();
        return Ok(new WebhookDetailResponse(MapWebhook(webhook), deliveries));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Create([FromBody] UpsertWebhookRequest req, CancellationToken ct)
    {
        if (!OutboundUrlGuard.IsSafeWebhookCallbackUrl(req.CallbackUrl, out var callbackUrlError))
        {
            return BadRequest(new { message = callbackUrlError });
        }

        var webhook = Webhook.Create(req.IntegrationId, req.EventType, req.CallbackUrl, _sensitiveData.Protect(req.Secret), req.Headers, req.IsActive);
        webhook.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.Webhooks.AddAsync(webhook, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = webhook.Id }, MapWebhook(webhook));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertWebhookRequest req, CancellationToken ct)
    {
        var webhook = await _uow.Webhooks.GetByIdAsync(id, ct);
        if (webhook == null)
        {
            return NotFound();
        }

        if (!OutboundUrlGuard.IsSafeWebhookCallbackUrl(req.CallbackUrl, out var callbackUrlError))
        {
            return BadRequest(new { message = callbackUrlError });
        }

        webhook.Update(req.IntegrationId, req.EventType, req.CallbackUrl, _sensitiveData.Protect(req.Secret), req.Headers, req.IsActive);
        await _uow.Webhooks.UpdateAsync(webhook, ct);
        await _uow.SaveChangesAsync(ct);
        return Ok(MapWebhook(webhook));
    }

    [HttpPost("{id:guid}/deliveries")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> LogDelivery(Guid id, [FromBody] CreateWebhookDeliveryRequest req, CancellationToken ct)
    {
        var webhook = await _uow.Webhooks.GetByIdAsync(id, ct);
        if (webhook == null)
        {
            return NotFound();
        }

        var delivery = WebhookDelivery.Create(id, req.StatusCode, req.ResponseBody, req.Success, req.ErrorMessage);
        delivery.SetCreatedBy(_currentUser.UserId ?? "system");
        await _uow.WebhookDeliveries.AddAsync(delivery, ct);
        await _uow.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id }, MapDelivery(delivery));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.SuperAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _uow.Webhooks.DeleteAsync(id, ct);
        await _uow.SaveChangesAsync(ct);
        return NoContent();
    }

    internal static WebhookResponse MapWebhook(Webhook webhook)
        => new(
            webhook.Id,
            webhook.IntegrationId,
            webhook.EventType,
            webhook.CallbackUrl,
            JsonSerializer.Deserialize<List<string>>(webhook.HeadersJson) ?? new(),
            webhook.IsActive);

    private static WebhookDeliveryResponse MapDelivery(WebhookDelivery delivery)
        => new(
            delivery.Id,
            delivery.WebhookId,
            delivery.AttemptedAt,
            delivery.StatusCode,
            delivery.ResponseBody,
            delivery.Success,
            delivery.ErrorMessage);
}
