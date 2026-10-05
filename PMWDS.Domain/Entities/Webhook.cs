using PMWDS.Domain.Common;
using System.Text.Json;

namespace PMWDS.Domain.Entities;

public class Webhook : AuditableEntity
{
    public Guid? IntegrationId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public string CallbackUrl { get; private set; } = string.Empty;
    public string Secret { get; private set; } = string.Empty;
    public string HeadersJson { get; private set; } = "[]";

    public Integration? Integration { get; private set; }

    protected Webhook() { }

    public static Webhook Create(
        Guid? integrationId,
        string eventType,
        string callbackUrl,
        string secret,
        IEnumerable<string>? headers,
        bool isActive)
    {
        var webhook = new Webhook
        {
            IntegrationId = integrationId,
            EventType = eventType.Trim(),
            CallbackUrl = callbackUrl.Trim(),
            Secret = secret,
            HeadersJson = JsonSerializer.Serialize(headers ?? Enumerable.Empty<string>())
        };

        if (!isActive)
        {
            webhook.Deactivate();
        }

        return webhook;
    }

    public void Update(
        Guid? integrationId,
        string eventType,
        string callbackUrl,
        string secret,
        IEnumerable<string>? headers,
        bool isActive)
    {
        IntegrationId = integrationId;
        EventType = eventType.Trim();
        CallbackUrl = callbackUrl.Trim();
        Secret = secret;
        HeadersJson = JsonSerializer.Serialize(headers ?? Enumerable.Empty<string>());
        if (isActive)
        {
            Activate();
        }
        else
        {
            Deactivate();
        }
    }
}
