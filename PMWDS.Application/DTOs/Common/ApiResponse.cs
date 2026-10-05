namespace PMWDS.Application.DTOs.Common;

public sealed record ApiError(
    string Code,
    string Message,
    IReadOnlyDictionary<string, string[]>? Details = null);

public sealed record ApiResponse<T>(
    bool Success,
    T? Data,
    ApiError? Error,
    string TraceId,
    DateTime Timestamp)
{
    public static ApiResponse<T> Ok(T? data, string traceId)
        => new(true, data, null, traceId, DateTime.UtcNow);

    public static ApiResponse<T> Fail(ApiError error, string traceId)
        => new(false, default, error, traceId, DateTime.UtcNow);
}
