using AspNetCoreRateLimit;
using AutoMapper;
using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Hangfire.Dashboard;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PMWDS.API.Auth;
using PMWDS.API.Conventions;
using PMWDS.API.Hubs;
using PMWDS.API.Middleware;
using PMWDS.API.Services;
using PMWDS.API.Filters;
using PMWDS.AI.Services;
using PMWDS.Application.Interfaces.Services;
using PMWDS.Infrastructure.Jobs;
using PMWDS.Infrastructure.Services;
using PMWDS.Infrastructure.Settings;
using PMWDS.Persistence.Context;
using PMWDS.Persistence.Migrations;
using PMWDS.Persistence.Repositories;
using Serilog;
using System.Security.Claims;
using System.Text;
using Scalar.AspNetCore;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;


var builder = WebApplication.CreateBuilder(args);
EnvFileLoader.Load(builder.Environment.ContentRootPath);
builder.Configuration.AddEnvironmentVariables();

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();
builder.Host.UseSerilog();

builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<EmailSettings>(
    builder.Configuration.GetSection("Email"));
builder.Services.Configure<AzureStorageSettings>(
    builder.Configuration.GetSection("AzureStorage"));
builder.Services.Configure<AISettings>(
    builder.Configuration.GetSection("AI"));
builder.Services.Configure<HangfireSettings>(
    builder.Configuration.GetSection("Hangfire"));
builder.Services.Configure<DatabaseSettings>(
    builder.Configuration.GetSection("Database"));
builder.Services.Configure<LocalFileStorageSettings>(
    builder.Configuration.GetSection("FileStorage"));

// Rate limiting — IP-based, using Redis when available, in-memory otherwise
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.Configure<IpRateLimitPolicies>(
    builder.Configuration.GetSection("IpRateLimitPolicies"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddMemoryCache(); // Required by AspNetCoreRateLimit
builder.Services.AddResponseCompression();
builder.Services.AddDataProtection();
builder.Services.AddScoped<ILoginLockoutService, LoginLockoutService>();

var databaseStatus = builder.Services.AddApplicationDatabase(builder.Configuration, builder.Environment);

var jwt = builder.Configuration
    .GetSection("Jwt")
    .Get<JwtSettings>() ?? new JwtSettings();

var jwtSecretBytes = Encoding.UTF8.GetBytes(jwt.Secret ?? string.Empty);

// Fail fast if JWT secret is missing or weaker than 256 bits.
if (jwtSecretBytes.Length < 32)
{
    Console.WriteLine("[PMWDS] FATAL: Jwt:Secret must be a random secret with at least 32 bytes. Set it via environment variable, User Secrets, or .env file.");
    return;
}

if (jwt.ExpiryMinutes is < 15 or > 1440)
{
    Console.WriteLine("[PMWDS] FATAL: Jwt:ExpiryMinutes must be between 15 minutes and 24 hours (1440 minutes).");
    return;
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(jwtSecretBytes),
            ClockSkew = TimeSpan.Zero
        };
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(token) && path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = async ctx =>
            {
                var userIdClaim = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var tokenVersionClaim = ctx.Principal?.FindFirstValue("token_version");
                if (!Guid.TryParse(userIdClaim, out var userId) ||
                    !int.TryParse(tokenVersionClaim, out var tokenVersion))
                {
                    ctx.Fail("Invalid token claims.");
                    return;
                }

                var cache = ctx.HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                var cacheKey = $"pmwds:jwt-validation:{userId:N}:{tokenVersion}";

                if (!cache.TryGetValue(cacheKey, out bool isTokenValid))
                {
                    var db = ctx.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
                    var user = await db.Users
                        .AsNoTracking()
                        .Where(u => u.Id == userId)
                        .Select(u => new { u.IsActive, u.AccessTokenVersion })
                        .FirstOrDefaultAsync(ctx.HttpContext.RequestAborted);

                    isTokenValid = user != null &&
                        user.IsActive &&
                        user.AccessTokenVersion == tokenVersion;

                    cache.Set(cacheKey, isTokenValid, TimeSpan.FromSeconds(5));
                }

                if (!isTokenValid)
                {
                    ctx.Fail("Token has been revoked.");
                }
            }
        };
    });

builder.Services.AddAuthorization(PermissionPolicyRegistry.AddPolicies);
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(PMWDS.Application.Interfaces.Repositories.IRepository<>), typeof(EfRepository<>));
builder.Services.AddScoped<PMWDS.Application.Interfaces.Repositories.IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Repositories.ITaskRepository, TaskRepository>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Repositories.IUserRepository, UserRepository>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<RoleScopeService>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.ITaskWorkflowService, TaskWorkflowService>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.INotificationService, NotificationService>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IEmailService, EmailService>();
builder.Services.AddSingleton<ISensitiveDataProtector, SensitiveDataProtector>();
builder.Services.AddScoped<PMWDS.Infrastructure.Services.IFileStorageService, AzureBlobStorageService>();
builder.Services.AddScoped<PMWDS.Infrastructure.Services.ILocalFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<PMWDS.Infrastructure.Services.AuditService>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IAuditService>(sp =>
    sp.GetRequiredService<PMWDS.Infrastructure.Services.AuditService>());
builder.Services.AddScoped<IDataChangeNotifier, DataChangeNotifier>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IReportService, ReportService>();
builder.Services.AddSingleton<PMWDS.Infrastructure.Services.IReportPdfRenderer, PMWDS.Infrastructure.Services.ReportPdfRenderer>();
builder.Services.AddSingleton<PMWDS.Infrastructure.Services.IReportExcelRenderer, PMWDS.Infrastructure.Services.ReportExcelRenderer>();
builder.Services.AddSingleton<PMWDS.Infrastructure.Services.RedisCacheService>();
builder.Services.AddSingleton<PMWDS.Application.Interfaces.Services.ICacheService>(sp =>
    sp.GetRequiredService<PMWDS.Infrastructure.Services.RedisCacheService>());

builder.Services.AddScoped<ITaskAllocationEngine, MLTaskAllocationEngine>();
builder.Services.AddScoped<IDelayPredictionEngine, MLDelayPredictionEngine>();
builder.Services.AddHttpClient<IChatEngine, OpenAICompatibleChatEngine>((sp, client) =>
{
    // The default HttpClient timeout is 100s, which is too short for large
    // structured report completions on slower models.
    var aiSettings = sp.GetRequiredService<IOptions<AISettings>>().Value;
    client.Timeout = TimeSpan.FromSeconds(Math.Clamp(aiSettings.RequestTimeoutSeconds, 30, 900));
});
builder.Services.AddScoped<AIService>();
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IRecommendationService>(sp =>
    sp.GetRequiredService<AIService>());
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IPredictionService>(sp =>
    sp.GetRequiredService<AIService>());
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IProjectHealthService>(sp =>
    sp.GetRequiredService<AIService>());
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IModelManagementService>(sp =>
    sp.GetRequiredService<AIService>());
builder.Services.AddScoped<PMWDS.Application.Interfaces.Services.IChatService>(sp =>
    sp.GetRequiredService<AIService>());

builder.Services.AddScoped<IDeadlineCheckerJob, DeadlineCheckerJob>();
builder.Services.AddScoped<IEscalationCheckerJob, EscalationCheckerJob>();
builder.Services.AddScoped<IAIModelTrainingJob, AIModelTrainingJob>();
builder.Services.AddScoped<IScheduledReportJob, ScheduledReportJob>();

builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssemblyContaining<
        PMWDS.Application.Features.Projects.Commands.CreateProjectCommand>());
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<
    PMWDS.Application.Validators.LoginRequestValidator>();
builder.Services.AddAutoMapper(cfg =>
    cfg.AddMaps(AppDomain.CurrentDomain.GetAssemblies()));

// Probe Redis first and register the cache that actually matches the outcome. Previously
// AddStackExchangeRedisCache was called unconditionally, so the "falls back to in-memory"
// warning below was a lie: with Redis down, every IDistributedCache call threw and a page
// load turned into a 500. See docs/realtime-sync-and-data-durability.md step 3c.
var redisConnectionString = builder.Configuration.GetConnectionString("Redis");
var redisAvailable = false;

if (!string.IsNullOrWhiteSpace(redisConnectionString))
{
    try
    {
        using var redis = await StackExchange.Redis.ConnectionMultiplexer.ConnectAsync(redisConnectionString);
        redisAvailable = redis.IsConnected;
        Console.WriteLine(redisAvailable
            ? $"[PMWDS] Redis connected ({redisConnectionString})."
            : $"[PMWDS] WARNING: Redis at {redisConnectionString} is not reachable. Caching falls back to in-memory.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[PMWDS] WARNING: Redis connection failed ({redisConnectionString}): {ex.Message}. Caching falls back to in-memory.");
    }
}

if (redisAvailable)
{
    builder.Services.AddStackExchangeRedisCache(opt =>
    {
        opt.Configuration = redisConnectionString;
        opt.InstanceName = "PMWDS:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

if (databaseStatus.Provider == ActiveDatabaseProvider.SqlServer)
{
    builder.Services.AddHangfire(cfg =>
        cfg.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
           .UseSimpleAssemblyNameTypeSerializer()
           .UseRecommendedSerializerSettings()
           .UseSqlServerStorage(builder.Configuration.GetConnectionString("Hangfire")));
    // Hangfire defaults to 20 worker threads. There are only four jobs here, two hourly
    // and two daily, so 20 workers buys nothing and costs a lot: they contend with HTTP
    // requests for both the thread pool and SQL Server connections. On a small machine
    // that contention is visible as page-load latency, so scale with the core count and
    // stay well below it to leave headroom for serving requests. Override with
    // Hangfire:WorkerCount if a deployment genuinely needs more.
    var hangfireWorkerCount = builder.Configuration.GetValue("Hangfire:WorkerCount", 0);
    if (hangfireWorkerCount <= 0)
    {
        hangfireWorkerCount = Math.Clamp(Environment.ProcessorCount / 2, 2, 8);
    }

    builder.Services.AddHangfireServer(options => options.WorkerCount = hangfireWorkerCount);
}

builder.Services.AddSignalR();
builder.Services.AddHttpContextAccessor();
builder.Services
    .AddControllers(options =>
    {
        options.Filters.Add<ApiResponseEnvelopeFilter>();
        options.Conventions.Add(new ProducesResponseTypeConvention());
    })
    .AddJsonOptions(opt =>
    {
        opt.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        opt.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        opt.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var details = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .ToDictionary(
                entry => entry.Key,
                entry => entry.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

        var response = PMWDS.Application.DTOs.Common.ApiResponse<object>.Fail(
            new PMWDS.Application.DTOs.Common.ApiError("validation_failed", "Validation failed.", details),
            context.HttpContext.TraceIdentifier);

        return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
    };
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

});
builder.Services.AddCors(opt =>
    opt.AddPolicy("PMWDSCors", p =>
        p.WithOrigins(builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? Array.Empty<string>())
         .AllowAnyMethod()
         .AllowAnyHeader()
         .AllowCredentials()));

// Resolve the single local storage root before Build(), so LocalFileStorageService can be
// pinned to the very same directory the static file providers and the seeder use.
//
// These used to resolve to two different places. The /files static root came from
// AzureStorage:LocalUploadPath (default "Data") while LocalFileStorageService and the
// /avatars root came from FileStorage:BasePath (default "App_Data"). Files were therefore
// written to one directory and served from another - uploaded avatars 404'd in
// development - and seeded profile images were written to App_Data but advertised as
// /files/... URLs served out of Data. In production both happened to be configured to
// /var/lib/pmwds/data, which is the only reason it was not visible there.
//
// Precedence: FileStorage:BasePath, then AzureStorage:LocalUploadPath, then "App_Data".
//
// Relative values bind to the content root, never the process working directory and never
// AppContext.BaseDirectory. This matters: under `dotnet run` the base directory is
// PMWDS.API/bin/Debug/net10.0, so resolving "App_Data" against it put uploads inside bin/,
// where every rebuild deleted the files while their ProjectDocuments rows survived in the
// database and downloads 404'd. The content root is PMWDS.API itself in development and
// the publish folder in production. Production configures absolute paths
// (/var/lib/pmwds/data), so this only affects relative defaults. This matches how
// DatabaseConnectionService already resolves the SQLite data source.
var azureStorageSettings = builder.Configuration.GetSection("AzureStorage").Get<AzureStorageSettings>()
    ?? new AzureStorageSettings();
var fileStorageSettings = builder.Configuration.GetSection("FileStorage").Get<LocalFileStorageSettings>()
    ?? new LocalFileStorageSettings();

var configuredStorageRoot = !string.IsNullOrWhiteSpace(fileStorageSettings.BasePath)
    ? fileStorageSettings.BasePath
    : azureStorageSettings.LocalUploadPath;
var storageRoot = StoragePathResolver.Resolve(
    configuredStorageRoot,
    builder.Environment.ContentRootPath,
    "App_Data");

// Pin the injected settings to the resolved root so the service cannot disagree with the
// host about where files live.
builder.Services.PostConfigure<LocalFileStorageSettings>(opts => opts.BasePath = storageRoot);

var app = builder.Build();

// nginx terminates TLS and proxies over loopback HTTP. Trust its forwarded headers so
// UseHttpsRedirection and absolute URL generation see the original scheme instead of looping.
app.UseResponseCompression();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseIpRateLimiting();

var exposeApiDocs = app.Environment.IsDevelopment() ||
                    app.Environment.IsStaging() ||
                    builder.Configuration.GetValue("Swagger:Enabled", false);

if (exposeApiDocs)
{
    app.UseSwagger();
    app.MapScalarApiReference(options => options.WithOpenApiRoutePattern("/swagger/v1/swagger.json"));
}

app.UseHttpsRedirection();
// Serve everything under the one resolved root: /files exposes the documents and seeded
// profile images the seeder writes, /avatars exposes uploaded avatars. Both are served from
// storageRoot so what was written is always what is served.
//
// storageRoot, azureStorageSettings and fileStorageSettings are resolved once, before
// builder.Build(), at line ~339, and PostConfigure pins FileStorage:BasePath to it. That
// single resolution is deliberate: resolving the root again per consumer is how the two halves
// end up disagreeing about where uploads are written versus where they are served from.
var filesRequestPath = azureStorageSettings.LocalBaseUrl ?? "/files";
Directory.CreateDirectory(storageRoot);
Directory.CreateDirectory(Path.Combine(storageRoot, fileStorageSettings.DocumentsPath));
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storageRoot),
    RequestPath = filesRequestPath
});

var avatarsRoot = Path.Combine(storageRoot, fileStorageSettings.AvatarsPath);
Directory.CreateDirectory(avatarsRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(avatarsRoot),
    RequestPath = "/avatars"
});
app.UseSerilogRequestLogging();
app.UseCors("PMWDSCors");
app.UseAuthentication();
app.UseAuthorization();
if (databaseStatus.Provider == ActiveDatabaseProvider.SqlServer)
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireAuthorizationFilter() }
    });
}

app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHub<DashboardHub>("/hubs/dashboard");
app.MapControllers();

// Logged on every start. When an upload 404s or a seeded avatar is missing, the first
// question is always "which directory is this actually using" - and the answer is not
// guessable, because it depends on the environment and on which config key won.
Console.WriteLine($"[PMWDS] Storage root: {storageRoot}");
Console.WriteLine($"[PMWDS]   documents/avatars served at {filesRequestPath}/... and /avatars/...");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await DatabaseConnectionService.PrepareDatabaseAsync(db, databaseStatus, builder.Environment);

    // The .env key is the final key for AI providers; pass it to seeding so the
    // provider credentials and default provider reflect real configuration.
    var aiSettings = scope.ServiceProvider.GetRequiredService<IOptions<AISettings>>().Value;
    var aiProviderKeys = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
    {
        ["OpenAI"] = string.IsNullOrWhiteSpace(aiSettings.OpenAI?.ApiKey)
            ? aiSettings.OpenAIApiKey
            : aiSettings.OpenAI?.ApiKey,
        ["OpenRouter"] = aiSettings.OpenRouter?.ApiKey
    };

    await SeedData.SeedAsync(db, aiProviderKeys: aiProviderKeys, storageBasePath: storageRoot);
    await SensitiveDataMigrationService.ProtectExistingAsync(
        db,
        scope.ServiceProvider.GetRequiredService<ISensitiveDataProtector>());

    if (databaseStatus.Provider == ActiveDatabaseProvider.SqlServer)
    {
        RecurringJob.AddOrUpdate<IDeadlineCheckerJob>(
            "deadline-checker",
            j => j.ExecuteAsync(CancellationToken.None),
            Cron.Hourly);
        RecurringJob.AddOrUpdate<IEscalationCheckerJob>(
            "escalation-checker",
            j => j.ExecuteAsync(CancellationToken.None),
            Cron.Hourly(30));
        RecurringJob.AddOrUpdate<IAIModelTrainingJob>(
            "ai-model-training",
            j => j.ExecuteAsync(CancellationToken.None),
            Cron.Daily(2));
        RecurringJob.AddOrUpdate<IScheduledReportJob>(
            "scheduled-reports",
            j => j.ExecuteAsync(CancellationToken.None),
            Cron.Weekly(DayOfWeek.Monday, 7));
    }
}

app.Run();
