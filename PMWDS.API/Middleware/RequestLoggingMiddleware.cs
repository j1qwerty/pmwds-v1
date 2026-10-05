using System.Diagnostics;
using System.Security.Claims;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Domain.Entities;
namespace PMWDS.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;
    public RequestLoggingMiddleware(
    RequestDelegate next,
    ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }
    public async Task InvokeAsync(HttpContext ctx, IUnitOfWork uow)
    {
        var sw = Stopwatch.StartNew();
        await _next(ctx);
        sw.Stop();
        _logger.LogInformation(
        "{Method} {Path} responded {StatusCode} " +
        "in {Elapsed}ms | User: {User}",
        ctx.Request.Method,
        ctx.Request.Path,
        ctx.Response.StatusCode,
        sw.ElapsedMilliseconds,
        ctx.User.Identity?.Name ?? "Anonymous");

        if (ctx.User.Identity?.IsAuthenticated == true
            && ctx.Request.Method != HttpMethods.Get
            && ctx.Response.StatusCode < 400
            && Guid.TryParse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            // Check if the controller already prepared a rich activity log
            if (ctx.Items["ActivityLog"] is ActivityLogContext logCtx)
            {
                var log = ActivityLog.Create(
                    userId,
                    logCtx.ActivityType,
                    logCtx.Description,
                    logCtx.Metadata,
                    logCtx.ProjectId);
                log.SetCreatedBy(userId.ToString());
                await uow.ActivityLogs.AddAsync(log, ctx.RequestAborted);
                await uow.SaveChangesAsync(ctx.RequestAborted);
            }
            else
            {
                // Fallback: generic request-level logging
                var log = ActivityLog.Create(
                    userId,
                    $"{ctx.Request.Method} {ctx.Request.Path}",
                    BuildDescription(ctx.Request.Method, ctx.Request.Path),
                    new
                    {
                        path = ctx.Request.Path.ToString(),
                        method = ctx.Request.Method,
                        statusCode = ctx.Response.StatusCode,
                        elapsedMs = sw.ElapsedMilliseconds
                    });
                log.SetCreatedBy(userId.ToString());
                await uow.ActivityLogs.AddAsync(log, ctx.RequestAborted);
                await uow.SaveChangesAsync(ctx.RequestAborted);
            }
        }
    }

    private static string BuildDescription(string method, PathString path)
        => method switch
        {
            "POST" => $"Created or submitted data at {path}.",
            "PUT" => $"Updated data at {path}.",
            "PATCH" => $"Changed data at {path}.",
            "DELETE" => $"Removed or deactivated data at {path}.",
            _ => $"Performed {method} at {path}."
        };
}
