using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PMWDS.AI.Services;
using PMWDS.Infrastructure.Settings;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AISettings>(
    builder.Configuration.GetSection("AI"));

builder.Services.AddSingleton<ITaskAllocationEngine, MLTaskAllocationEngine>();
builder.Services.AddSingleton<IDelayPredictionEngine, MLDelayPredictionEngine>();
builder.Services.AddHttpClient<IChatEngine, OpenAICompatibleChatEngine>((sp, client) =>
{
    // The default HttpClient timeout is 100s, which is too short for large
    // structured report completions on slower models.
    var settings = sp.GetRequiredService<IOptions<AISettings>>().Value;
    client.Timeout = TimeSpan.FromSeconds(Math.Clamp(settings.RequestTimeoutSeconds, 30, 900));
});
builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapHealthChecks("/health");
app.MapGet("/", () => "PMWDS.AI Service is running.");

app.Run();
