using System.Net;
using System.Net.Sockets;

namespace PMWDS.Application.Security;

public static class OutboundUrlGuard
{
    private static readonly IReadOnlyDictionary<string, string[]> AiProviderHosts =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["OpenAI"] = ["api.openai.com"],
            ["OpenRouter"] = ["openrouter.ai"]
        };

    public static bool IsAllowedAiProviderBaseUrl(string provider, string url, out string error)
    {
        if (!TryValidateHttpsUrl(url, out var uri, out error))
        {
            return false;
        }

        if (!AiProviderHosts.TryGetValue(provider, out var allowedHosts))
        {
            error = $"AI provider '{provider}' is not supported.";
            return false;
        }

        if (!allowedHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase))
        {
            error = $"AI provider '{provider}' must use one of: {string.Join(", ", allowedHosts)}.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    public static bool IsSafeWebhookCallbackUrl(string url, out string error)
    {
        if (!TryValidateHttpsUrl(url, out var uri, out error))
        {
            return false;
        }

        if (IsUnsafeHost(uri.Host))
        {
            error = "Webhook callback URL cannot target localhost, private, loopback, or link-local addresses.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool TryValidateHttpsUrl(string url, out Uri uri, out string error)
    {
        uri = null!;
        if (string.IsNullOrWhiteSpace(url) ||
            !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var parsedUri))
        {
            error = "URL must be an absolute URL.";
            return false;
        }

        uri = parsedUri;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            error = "URL must use HTTPS.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            error = "URL cannot include user info.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool IsUnsafeHost(string host)
    {
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!IPAddress.TryParse(host, out var address))
        {
            return false;
        }

        if (IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (address.Equals(IPAddress.Any) ||
            address.Equals(IPAddress.IPv6Any))
        {
            return true;
        }

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = address.GetAddressBytes();
            return bytes[0] == 10 ||
                bytes[0] == 127 ||
                (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) ||
                (bytes[0] == 192 && bytes[1] == 168) ||
                (bytes[0] == 169 && bytes[1] == 254) ||
                (bytes[0] >= 224 && bytes[0] <= 239);
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var bytes = address.GetAddressBytes();
            return address.IsIPv6LinkLocal ||
                address.IsIPv6SiteLocal ||
                address.IsIPv6Multicast ||
                address.Equals(IPAddress.IPv6Loopback) ||
                (bytes[0] & 0xfe) == 0xfc;
        }

        return true;
    }
}
