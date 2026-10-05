using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using PMWDS.Application.DTOs.Common;

namespace PMWDS.API.Filters;

public sealed class ApiResponseEnvelopeFilter : IAsyncResultFilter
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult objectResult &&
            objectResult.Value is not null &&
            !IsApiResponse(objectResult.Value))
        {
            var statusCode = objectResult.StatusCode ?? StatusCodes.Status200OK;
            objectResult.Value = statusCode >= StatusCodes.Status400BadRequest
                ? ApiResponse<object>.Fail(CreateError(statusCode, objectResult.Value), context.HttpContext.TraceIdentifier)
                : ApiResponse<object>.Ok(objectResult.Value, context.HttpContext.TraceIdentifier);
        }

        await next();
    }

    private static bool IsApiResponse(object value)
        => value.GetType().IsGenericType &&
           value.GetType().GetGenericTypeDefinition() == typeof(ApiResponse<>);

    private static ApiError CreateError(int statusCode, object value)
    {
        var message = value switch
        {
            ValidationProblemDetails problem => problem.Detail ?? problem.Title ?? "Validation failed.",
            ProblemDetails problem => problem.Detail ?? problem.Title ?? "Request failed.",
            string text => text,
            _ => "Request failed."
        };

        IReadOnlyDictionary<string, string[]>? details = value is ValidationProblemDetails validation
            ? validation.Errors.ToDictionary(entry => entry.Key, entry => entry.Value)
            : null;

        return new ApiError(StatusCodeToCode(statusCode), message, details);
    }

    private static string StatusCodeToCode(int statusCode)
        => statusCode switch
        {
            StatusCodes.Status400BadRequest => "bad_request",
            StatusCodes.Status401Unauthorized => "unauthorized",
            StatusCodes.Status403Forbidden => "forbidden",
            StatusCodes.Status404NotFound => "not_found",
            StatusCodes.Status409Conflict => "conflict",
            _ => "error"
        };
}
