using PMWDS.Domain.Common;

namespace PMWDS.Domain.Entities;

public class WebhookDelivery : AuditableEntity
{
    public Guid WebhookId { get; private set; }
    public DateTime AttemptedAt { get; private set; }
    public int StatusCode { get; private set; }
    public string ResponseBody { get; private set; } = string.Empty;
    public bool Success { get; private set; }
    public string? ErrorMessage { get; private set; }

    public Webhook? Webhook { get; private set; }

    protected WebhookDelivery() { }

    public static WebhookDelivery Create(
        Guid webhookId,
        int statusCode,
        string responseBody,
        bool success,
        string? errorMessage)
    {
        return new WebhookDelivery
        {
            WebhookId = webhookId,
            AttemptedAt = DateTime.UtcNow,
            StatusCode = statusCode,
            ResponseBody = responseBody,
            Success = success,
            ErrorMessage = errorMessage
        };
    }
}
