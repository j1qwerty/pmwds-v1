namespace PMWDS.Application.Exceptions;

/// <summary>
/// Thrown when an AI-backed operation cannot be completed because the upstream
/// provider is missing, misconfigured, or rejected the request.
///
/// This is deliberately distinct from a generic server error: it maps to 502
/// Bad Gateway and carries an actionable, user-facing message, so the client
/// can tell the user what to fix instead of reporting a success that contains
/// an error report.
/// </summary>
public class AiProviderException : Exception
{
    public string Reason { get; }

    /// <summary>
    /// The HTTP status the upstream provider returned, when there was one.
    ///
    /// Needed because "429 rate limited" and "401 bad API key" need different
    /// answers. Both were previously reported as an opaque 500 with the message
    /// "An unexpected error occurred", which told the user nothing about whether
    /// to wait, add credits, or fix their settings.
    /// </summary>
    public int? UpstreamStatusCode { get; }

    public AiProviderException(
        string message,
        string reason,
        Exception? inner = null,
        int? upstreamStatusCode = null)
        : base(message, inner)
    {
        Reason = reason;
        UpstreamStatusCode = upstreamStatusCode;
    }
}
