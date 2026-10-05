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
            _ => "server_error"
        };
}
