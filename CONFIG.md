# PMWDS Configuration Guide

This guide describes the configuration required to build, run, and deploy PMWDS. The API entry point is `PMWDS.API`; the React client is in `Client`.

## Related Docs

| File | Purpose |
|------|---------|
| [README.md](README.md) | Project overview, local setup, credentials, and operational notes |
| [config-sqlite.md](config-sqlite.md) | Combined SQLite config guide with verified implementation and remediation paths |
| [mssql-issue.md](mssql-issue.md) | Why SQL Server made requests take 25 seconds, and the two settings that fixed it |
| [vps-mssqlserver.md](vps-mssqlserver.md) | SQL Server and Redis on the VPS, and connecting SSMS to it |

## Configuration File Order

ASP.NET Core configuration is loaded from standard sources. Use this priority when diagnosing values:

1. Environment variables and command-line arguments.
2. `PMWDS.API/appsettings.{Environment}.json`.
3. `PMWDS.API/appsettings.json`.
4. Code defaults in settings classes such as `DatabaseSettings` and `AISettings`.

## Required Local Tooling

- .NET SDK compatible with `net10.0`.
- Node.js and npm for the React client.
- SQL Server for production-style local runs, optional for development because SQLite fallback is automatic in Development.
- Redis if testing distributed cache behavior.
- Azure Storage Emulator or real Azure Blob Storage if testing file storage.

## Build Commands

```powershell
dotnet restore PMWDS.slnx
dotnet build PMWDS.slnx
```

```powershell
cd Client
npm install
npm run build
```

## Run Commands

API:

```powershell
dotnet run --project PMWDS.API --urls http://localhost:5179
```

Client:

```powershell
cd Client
npm run dev -- --host 127.0.0.1 --port 5175
```

## Core Configuration Files

| File | Purpose |
|------|---------|
| `PMWDS.API/appsettings.json` | Base configuration for connection strings, JWT, email, storage, AI, CORS, Hangfire, and logging |
| `PMWDS.API/appsettings.Development.json` | Development override; currently forces SQLite |
| `PMWDS.API/Properties/launchSettings.json` | Local launch profiles and development URLs |
| `Client/.env` or shell env | Optional Vite client overrides such as `VITE_API_BASE_URL` |

## Database Configuration

### SQL Server

SQL Server is the production target.

File: `PMWDS.API/appsettings.json`

```json
"ConnectionStrings": {
  "Default": "Server=127.0.0.1,1433;Database=PMWDS;User Id=sa;Password=CHANGE_ME_Strong_Passw0rd;TrustServerCertificate=True",
  "Redis": "localhost:6379",
  "Hangfire": "Server=127.0.0.1,1433;Database=PMWDS_Hangfire;User Id=sa;Password=CHANGE_ME_Strong_Passw0rd;TrustServerCertificate=True"
}
```

**Use SQL Server authentication, never `Trusted_Connection=True`.** Windows
authentication (Integrated Security) is a Windows-only mechanism and does not exist on
Linux. A connection string carrying `Trusted_Connection=True` or
`Integrated Security=True` works on a Windows development box and fails on the Ubuntu
VPS. Every deployed environment must supply `User Id` and `Password`.

Other notes:

- Use `127.0.0.1` rather than `localhost`. Some SQL Server instances - including the
  official Linux container - do not answer on `::1`, and the connection hangs until it
  times out rather than failing fast.
- Do **not** set `MultipleActiveResultSets=true`. `DatabaseConnectionService` enables
  EF Core's retry strategy for SQL Server, and that strategy depends on savepoints.
  MARS disables savepoints, so EF logs *"Savepoints are disabled because Multiple Active
  Result Sets is enabled"* on every `SaveChanges` and cannot roll a failed transaction
  back to a known clean state before retrying. EF Core does not require MARS.
- `TrustServerCertificate=True` is required when the instance uses a self-signed
  certificate, which is what the official container generates on first run.
- Production runs SQL Server in a container (`mcr.microsoft.com/mssql/server:2022-latest`).
  The Windows service cannot be installed on Ubuntu. Needs roughly 2 GB of RAM.
- Prefer a dedicated least-privilege login over `sa` for the application. `sa` is
  sysadmin, and Hangfire additionally needs rights to create its own schema objects on
  first run.

Production changes:

- Replace `Default` with the production SQL Server connection string.
- Replace `Hangfire` with a dedicated production Hangfire database connection.
- Set `Database__ForceSqlite=false` and `Database__AllowSqliteInProduction=false` so a
  bad connection string fails loudly instead of silently starting on an empty SQLite file.
- Keep `TrustServerCertificate=True` only when the deployment model requires it.

### SQLite Development Fallback

SQLite is the automatic fallback in Development when SQL Server cannot be reached. It is
never used in Production unless explicitly opted in.

File: `PMWDS.API/appsettings.Development.json`

```json
"Database": {
  "ForceSqlite": false,
  "SqliteConnectionString": "Data Source=App_Data/pmwds-dev.sqlite"
}
```

Behavior:

- `ForceSqlite: true` makes Development use SQLite without trying SQL Server.
- If `ForceSqlite` is false and SQL Server cannot be reached, Development falls back to SQLite automatically.
- The database file is `PMWDS.API/App_Data/pmwds-dev.sqlite`.
- The API startup path creates the directory, validates the expected SQLite schema, rebuilds stale development schema when needed, and runs seed data.
- Hangfire is disabled while SQLite is active.

Note: there is no `Database:EnableSqliteFallback` setting. Some `.env` copies contain
`Database__EnableSqliteFallback=true`, which is read by nothing. The real control is
`Database:AllowSqliteInProduction`, which permits SQLite outside Development.

See [config-sqlite.md](config-sqlite.md) and [mssql-issue.md](mssql-issue.md) before changing this flow.

### Database Settings Class

File: `PMWDS.Infrastructure/Settings/AppSettings.cs`

```csharp
public class DatabaseSettings
{
    public bool ForceSqlite { get; set; } = false;
    public string SqliteConnectionString { get; set; } = "Data Source=App_Data/pmwds-dev.sqlite";
}
```

### EF Core Commands

Add a migration:

```powershell
dotnet ef migrations add MigrationName --project PMWDS.Persistence --startup-project PMWDS.API --context ApplicationDbContext
```

Apply migrations to SQL Server:

```powershell
dotnet ef database update --project PMWDS.Persistence --startup-project PMWDS.API --context ApplicationDbContext
```

SQLite note:

```powershell
# Do not rely on direct database update against the existing dev SQLite file.
# Use the API startup path for local SQLite schema bootstrap and seed data.
dotnet run --project PMWDS.API --urls http://localhost:5179
```

## JWT Authentication

File: `PMWDS.API/appsettings.json`

```json
"Jwt": {
  "Secret": "",
  "Issuer": "PMWDS",
  "Audience": "PMWDS_Users",
  "ExpiryMinutes": 480
}
```

The secret is never stored in a tracked file. Set it in the environment (`.env` locally,
`/etc/pmwds/pmwds.env` on the server) as:

```text
Jwt__Secret=<at least 32 random characters>
```

The API refuses to start when `Jwt:Secret` is shorter than 32 bytes. There is no development
fallback value.

Production changes:

- Generate a fresh random `Jwt__Secret` and keep it outside source control.
- Keep issuer and audience stable across API and clients.
- Review expiry duration for production security requirements.

## Seeded Credentials

Default seeded password:

```text
Pmwds@123
```

Seeded users include:

```text
admin@pmwds.com
manager@pmwds.com
head@pmwds.com
lead@pmwds.com
member@pmwds.com
viewer@pmwds.com
ava.patel@pmwds.com
noah.chen@northwind-labs.example
mia.roberts@contoso-transform.example
```

Production changes:

- Remove or rotate seeded accounts.
- Replace the current development hash strategy with a production-grade password hasher.
- Require password reset or credential rotation after first deployment.

## Email Configuration

File: `PMWDS.API/appsettings.json`

```json
"Email": {
  "Host": "smtp.gmail.com",
  "Port": 587,
  "Username": "noreply@pmwds.com",
  "Password": "your-smtp-password",
  "SenderEmail": "noreply@pmwds.com",
  "SenderName": "PMWDS System",
  "UseSsl": true
}
```

Production changes:

- Store SMTP credentials in a secret manager.
- Use an approved sender domain.
- Configure SPF, DKIM, and DMARC for deliverability.

## File Storage

File: `PMWDS.API/appsettings.json`

```json
"AzureStorage": {
  "ConnectionString": "UseDevelopmentStorage=true",
  "ContainerName": "pmwds-files"
}
```

Production changes:

- Replace `UseDevelopmentStorage=true` with an Azure Storage connection string or managed identity flow.
- Use private containers unless public access is intentionally required.
- Add lifecycle and retention policies for uploaded project/task files.

## AI Configuration

PMWDS currently exposes only OpenAI and OpenRouter provider configuration in the API and client.

File: `PMWDS.API/appsettings.json`

```json
"AI": {
  "OpenAIApiKey": "your-openai-api-key",
  "OpenAIModel": "gpt-4o",
  "DefaultProvider": "OpenRouter",
  "DefaultModel": "openai/gpt-oss-120b:free",
  "AppName": "PMWDS",
  "AppUrl": "http://localhost:5179",
  "OpenAI": {
    "Enabled": true,
    "BaseUrl": "https://api.openai.com/v1",
    "ApiKey": "your-openai-api-key",
    "DefaultModel": "gpt-4o",
    "ModelsPath": "/models"
  },
  "OpenRouter": {
    "Enabled": true,
    "BaseUrl": "https://openrouter.ai/api/v1",
    "ApiKey": "your-openrouter-api-key",
    "DefaultModel": "openai/gpt-oss-120b:free",
    "ModelsPath": "/models",
    "Headers": {
      "HTTP-Referer": "http://localhost:5179",
      "X-OpenRouter-Title": "PMWDS"
    }
  },
  "MLModelPath": "Models/delay-prediction.zip",
  "UseLocalModel": false,
  "RiskThreshold": 0.7,
  "TrainingCronHour": 2
}
```

Production changes:

- Remove API keys from committed JSON.
- Store OpenAI/OpenRouter keys in environment variables or a secret manager.
- Set `AppUrl` and OpenRouter headers to production URLs.
- Review `RiskThreshold` with real delivery data.
- Persist and monitor model-training artifacts before relying on automated decisions.

## Hangfire

File: `PMWDS.API/appsettings.json`

```json
"Hangfire": {
  "DashboardPath": "/hangfire"
}
```

Runtime behavior:

- Hangfire is enabled only when SQL Server is active.
- Hangfire is disabled when SQLite fallback is active.

Recurring jobs:

| Job | Cron | Meaning |
|-----|------|---------|
| `deadline-checker` | `0 * * * *` | hourly |
| `escalation-checker` | `30 * * * *` | hourly at :30 |
| `ai-model-training` | `0 2 * * *` | daily 02:00 |
| `scheduled-reports` | `0 7 * * 1` | Mondays 07:00 |

All four have been verified running against SQL Server. Note that `escalation-checker`
calls the AI provider, so it makes real outbound API calls once per run.

Production changes:

- Use a SQL Server-backed Hangfire database. Hangfire creates its own schema objects on
  first run, so the login needs permission to create tables there.
- Restrict dashboard access to administrators.
- Monitor failed jobs and retry queues.

## Redis Cache

Connection string:

```json
"ConnectionStrings": {
  "Redis": "localhost:6379"
}
```

Production changes:

- Use a managed Redis instance where possible.
- Require TLS/authentication when supported.
- Size cache memory for dashboard, notification, and session workloads.

## CORS

File: `PMWDS.API/appsettings.json`

```json
"AllowedOrigins": [
  "http://localhost:3002",
  "http://localhost:4200",
  "http://localhost:5179",
  "http://localhost:5175",
  "https://pmwds.yourdomain.com"
]
```

Production changes:

- Remove unused localhost origins.
- Add only the deployed client origins.
- Keep credentials enabled only for trusted origins.

## Logging

File: `PMWDS.API/appsettings.json`

```json
"Serilog": {
  "MinimumLevel": {
    "Default": "Information",
    "Override": {
      "Microsoft.AspNetCore": "Information",
      "Microsoft.EntityFrameworkCore": "Warning",
      "System": "Warning"
    }
  }
}
```

Optional Seq endpoint:

```json
"Seq": {
  "ServerUrl": "http://localhost:5341"
}
```

Production changes:

- Send structured logs to a central sink.
- Avoid logging secrets, tokens, passwords, or full AI prompts if they can contain sensitive data.
- Add request correlation IDs.

## Client Configuration

The React client defaults to:

```text
http://localhost:5179/api/v1
```

Override with Vite environment variable:

```powershell
$env:VITE_API_BASE_URL = "https://api.yourdomain.com/api/v1"
npm run build
```

Local development:

```powershell
cd Client
npm run dev -- --host 127.0.0.1 --port 5175
```

Production build:

```powershell
cd Client
npm run build
```

Deploy the generated `Client/dist` folder to a static web host or serve it behind the same reverse proxy as the API.

## Deployment Checklist

1. Build and test the API.
2. Build and test the client.
3. Configure production SQL Server connection strings.
4. Configure Redis if distributed caching is required.
5. Configure Azure Storage or equivalent file storage.
6. Configure JWT secret, email credentials, AI keys, and all secrets outside source control.
7. Configure CORS with production origins only.
8. Apply EF migrations to SQL Server.
9. Start the API and verify Swagger/health endpoints.
10. Start Hangfire workers with SQL Server-backed storage.
11. Deploy the React client with `VITE_API_BASE_URL` pointing to the production API.
12. Rotate seeded credentials or disable seeded users.

## Common Issues

| Issue | Cause | Fix |
|------|-------|-----|
| API uses SQLite unexpectedly | Development config has `ForceSqlite: true` | Set `ForceSqlite` to `false` and verify SQL Server connectivity |
| Hangfire dashboard missing | SQLite is active | Use SQL Server for Hangfire-enabled runs |
| SQLite migration update fails | SQL Server-shaped migration history is not fully portable | Use API startup SQLite bootstrap or implement provider-specific migrations |
| Client cannot call API | Wrong API base URL or CORS origin | Set `VITE_API_BASE_URL` and add the client origin to `AllowedOrigins` |
| Login fails | Wrong seeded password or stale database | Use `Pmwds@123`; restart API to rebuild stale SQLite schema if needed |
| AI provider test fails | Missing API key, disabled provider, or wrong model | Enable provider and configure key/model in settings |

## Production Hardening

- Move every secret out of committed JSON.
- Replace development seeded credentials.
- Replace development password hashing.
- Split provider-specific migrations for SQL Server and SQLite if SQLite remains a supported runtime database.
- Add API health checks and readiness probes.
- Add automated smoke tests for seeded workflows.
- Add Playwright coverage for critical client pages.
- Add backup, restore, and retention policies for SQL Server and file storage.
