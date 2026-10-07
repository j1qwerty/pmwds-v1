using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text.Json;
using PMWDS.Application.DTOs.Common;
using PMWDS.Application.Exceptions;
namespace PMWDS.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    public ExceptionMiddleware(
    RequestDelegate next,
    ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
        {
            // The client went away (navigated off, closed the tab, or a timeout cancelled the
            // fetch). Nothing failed server-side, so this must not be logged as an unhandled
            // exception or answered with a 500 - the connection is already gone anyway.
        }
        catch (AiProviderException ex)
        {
            // Handled separately from the catch-all below. An exhausted provider
            // quota or a rejected key is an expected upstream condition, not a fault
            // in this application, so it is logged as a warning without a stack
            // trace and answered with its own actionable message.
            _logger.LogWarning(
            "AI provider call failed ({Reason}): {Message}",
            ex.Reason,
            ex.Message);
            await HandleExceptionAsync(ctx, ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
            "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(ctx, ex);
        }
    }
    private static async Task HandleExceptionAsync(
    HttpContext ctx, Exception ex)
    {
        ctx.Response.ContentType = "application/json";
        HttpStatusCode statusCode;
        string message;
        if (ex is NotFoundException)
        {
            statusCode = HttpStatusCode.NotFound;
            message = ex.Message;
        }
        else if (ex is ValidationException)
        {
            statusCode = HttpStatusCode.BadRequest;
            message = ex.Message;
        }
        else if (ex is UnauthorizedAccessException)
        {
            statusCode = HttpStatusCode.Unauthorized;
            message = ex.Message;
        }
        else if (ex is ConflictException)
        {
            statusCode = HttpStatusCode.Conflict;
            message = ex.Message;
        }
        else if (ex is AiProviderException aiFailure)
        {
            // The failure is upstream, so 502 by default rather than 500 - a 500
            // reads as "this application is broken" and sends people to the logs.
            //
            // A 429 is passed through unchanged: it is a quota limit that clears on
            // its own, so reporting it as 502 would tell the user to retry
            // immediately against a limit that has not reset.
            statusCode = aiFailure.UpstreamStatusCode == 429
            ? (HttpStatusCode)429
            : HttpStatusCode.BadGateway;
            message = aiFailure.Message;
        }
        else
        {
            statusCode = HttpStatusCode.InternalServerError;
            message = "An unexpected error occurred.";
        }
        ctx.Response.StatusCode = (int)statusCode;
        var response = ApiResponse<object>.Fail(
            new ApiError(StatusCodeToCode((int)statusCode), message),
            ctx.TraceIdentifier);
        await ctx.Response.WriteAsync(
        JsonSerializer.Serialize(response,
        new JsonSerializerOptions
        {
            PropertyNamingPolicy =
        JsonNamingPolicy.CamelCase
        }));
    }

    private static string StatusCodeToCode(int statusCode)
        => statusCode switch
        {
            StatusCodes.Status400BadRequest => "bad_request",
            StatusCodes.Status401Unauthorized => "unauthorized",
            StatusCodes.Status404NotFound => "not_found",
StatusCodes.Status409Conflict => "conflict",
        StatusCodes.Status429TooManyRequests => "ai_provider_rate_limited",
        StatusCodes.Status502BadGateway => "ai_provider_unavailable",
        _ => "server_error"
        };
}
