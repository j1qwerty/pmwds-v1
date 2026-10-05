# PMWDS Project - SQLite Configuration & Overview

## Project Overview

PMWDS (Project Management & Workflow Documentation System) is a multi-project .NET solution designed for project management with AI-powered features.

### Solution Structure

```
PMWDS.S/
├── PMWDS.API/           # Main Web API entry point (runs on port 5177)
├── PMWDS.Application/  # Application layer (CQRS, MediatR handlers)
├── PMWDS.Domain/       # Domain entities, enums, events
├── PMWDS.Persistence/  # EF Core, DbContext, repositories, migrations
├── PMWDS.Infrastructure/# Services, settings, background jobs
├── PMWDS.AI/           # AI features (ML, chat engines)
├── PMWDS.AI.Tests/     # AI-related tests
└── Client/             # Frontend (Angular)
```

---

## SQLite Configuration

### Configuration Files

**1. appsettings.Development.json** (`PMWDS.API/`)
```json
{
  "ConnectionStrings": {
    "Default": "Server=.;Database=PMWDS_Dev;Trusted_Connection=True;...",
    "Redis": "localhost:6379",
    "Hangfire": "Server=.;Database=PMWDS_Hangfire_Dev;..."
  },
  "Database": {
    "ForceSqlite": true,           // Force SQLite always in dev
    "SqliteConnectionString": "Data Source=App_Data/pmwds-dev.sqlite"
  }
}
```

**2. appsettings.Development.Sqlite.json** (alternative config)
```json
{
  "Database": {
    "ForceSqlite": false,
    "SqliteConnectionString": "Data Source=App_Data/pmwds-dev.sqlite"
  }
}
```

**3. appsettings.json** (production - uses MSSQL)
```json
{
  "ConnectionStrings": {
    "Default": "Server=.;Database=PMWDS;Trusted_Connection=True;..."
  }
}
```

### Database Settings Class

**Location:** `PMWDS.Infrastructure/Settings/AppSettings.cs`

```csharp
public class DatabaseSettings
{
    public bool ForceSqlite { get; set; } = false;
    public string SqliteConnectionString { get; set; } = "Data Source=App_Data/pmwds-dev.sqlite";
}
```

### SQLite Fallback Logic

**Location:** `PMWDS.API/Program.cs` (lines 47-80)

The SQLite fallback is determined at startup:

```csharp
var useSqlite = builder.Environment.IsDevelopment() &&
    (databaseSettings.ForceSqlite ||
     !CanConnectToSqlServer(sqlServerConnection));
```

- **ForceSqlite = true**: Always use SQLite (ignores SQL Server)
- **ForceSqlite = false**: Tries SQL Server first, then switches to SQLite in Development if connection fails
- **CanConnectToSqlServer()**: Tests SQL Server with 2-second timeout

### DbContext Registration

**Location:** `PMWDS.API/Program.cs` (lines 66-80)

```csharp
builder.Services.AddDbContext<ApplicationDbContext>(opt =>
{
    if (useSqlite)
    {
        opt.UseSqlite(sqliteConnection, sql => sql.MigrationsAssembly("PMWDS.Persistence"));
    }
    else
    {
        opt.UseSqlServer(sqlServerConnection, sql => sql.MigrationsAssembly("PMWDS.Persistence"));
    }
});
```

### Database Initialization (SQLite)

**Location:** `PMWDS.API/Program.cs` (lines 218-243)

```csharp
if (useSqlite)
{
    try { await db.Database.MigrateAsync(); }
    catch { await db.Database.EnsureCreatedAsync(); }
}
```

When using SQLite:
- Tries migrations first (`MigrateAsync`)
- Falls back to `EnsureCreatedAsync` if migrations fail (creates schema from scratch)

### SQLite Database File

- **Location:** `PMWDS.API/App_Data/pmwds-dev.sqlite`
- **Size:** ~299KB
- **Created:** April 21, 2026

---

## Database Schema

### ApplicationDbContext

**Location:** `PMWDS.Persistence/Context/ApplicationDbContext.cs`

**Entity Sets:**
- `Departments`, `Projects`, `Milestones`, `ProjectTasks`
- `TaskDependencies`, `TaskAssignments`, `TaskComments`, `TaskAttachments`
- `ProjectDocuments`
- `Skills`, `UserSkills`
- `Notifications`, `AuditLogs`

**Soft Delete Filter:** All entities inheriting from `BaseEntity` have a global query filter that automatically filters out deleted records (`IsDeleted = false`).

### Core Entities

**1. Project** (`PMWDS.Domain/Entities/Project.cs`)
- ProjectCode, Name, Description, Category
- Priority, Status, ProgressPercentage
- PlannedStartDate, PlannedEndDate, BaselineEndDate
- PlannedBudget, ActualCost
- AI fields: AIHealthScore, AIDelayRiskScore, AIBudgetRiskScore

**2. ProjectTask** (`PMWDS.Domain/Entities/ProjectTask.cs`)
- Title, Description, Status, Priority
- StartDate, DueDate, CompletedDate
- EstimatedHours, ProgressPercentage
- Assignment: AssignedToUserId, AssignedByUserId, AssignedDate
- AI fields: AIDelayProbability, AIPredictedCompletionDate

**3. ApplicationUser** (`PMWDS.Domain/Entities/ApplicationUser.cs`)
- Email, FirstName, LastName
- DepartmentId, JobTitle, EmployeeCode
- PasswordHash (SHA256-based)
- AI fields: AIPerformanceScore, AIWorkloadScore, AIBurnoutRiskScore

---

## API Endpoints

### Controllers (in PMWDS.API/Controllers/)

| Controller | Purpose |
|------------|---------|
| `AuthController` | Login, change password, refresh token |
| `UsersController` | User management |
| `ProjectsController` | Project CRUD, dashboard |
| `TasksController` | Task management, assignment |
| `MilestonesController` | Milestone management |
| `DepartmentsController` | Department management |
| `NotificationsController` | User notifications |
| `ReportsController` | Reports generation |
| `AIController` | AI chat, training triggers |

### Authentication

**Location:** `PMWDS.API/Controllers/AuthController.cs`

**Login:** `POST /api/auth/login`
```json
Request:  { "email": "user@pmwds.com", "password": "xxx" }
Response: { "token": "jwt...", "expiry": "...", "userId": "...", "fullName": "...", "roles": [...] }
```

**Password Validation:**
1. ASP.NET Core `PasswordHasher<ApplicationUser>` against `PasswordHash`.
2. A user with no `PasswordHash` can never authenticate; there is no fallback password.

**Roles (auto-resolved from JobTitle):**
- "SuperAdmin" → SuperAdmin role
- Contains "ProjectManager" or "Manager" → ProjectManager role
- Contains "DepartmentHead" or "Head" → DepartmentHead role
- Contains "Director" → Director role
- Default → TeamMember role

**JWT Settings:**
- Secret: supplied by the environment as `Jwt__Secret` (no default; startup fails when unset or shorter than 32 characters)
- Issuer: `PMWDS`
- Audience: `PMWDS_Users`
- Expiry: 480 minutes (8 hours)

---

## Key Features

### 1. Domain-Driven Design
- Entities with domain events (`ProjectCreatedEvent`, `TaskAssignedEvent`, etc.)
- Value objects and enums for status, priority, availability
- Soft delete support via `BaseEntity`

### 2. CQRS with MediatR
- Commands: CreateProject, CreateTask, AssignTask, UpdateTaskProgress, EscalateTask
- Queries: GetProjectDashboard, GetProjectDetails, GetProjectHealth, GetBurnoutRisk

### 3. AI Features
- Task delay prediction using ML model
- Assignee recommendation based on skills/workload
- Burnout risk scoring
- Project health analysis

### 4. SignalR Hubs
- `NotificationHub` (`/hubs/notifications`) - Real-time notifications
- `DashboardHub` (`/hubs/dashboard`) - Live dashboard updates

### 5. Background Jobs (Hangfire)
- Disabled when using SQLite (SQLite doesn't support Hangfire)
- `deadline-checker` - hourly
- `escalation-checker` - hourly at :30
- `ai-model-training` - daily at 2 AM
- `scheduled-reports` - weekly Monday 7 AM

---

## File Upload (Local Fallback)

**Location:** `PMWDS.Infrastructure/Services/FileStorageService.cs`

The `AzureBlobStorageService` detects local storage mode when the connection string contains `UseDevelopmentStorage` or `UseLocal` or is empty.

When in local mode, files are saved to:
```
PMWDS.API/App_Data/Files/pmwds-files/<first-4-chars-of-guid>/<guid><ext>
```

Example uploaded file path stored in DB:
```
/files/pmwds-files/ab12/76b1bcb2-f9e3-4db3-bc77-289343d3d118.pdf
```

Full local path:
```
PMWDS.API/App_Data/Files/pmwds-files/ab12/76b1bcb2-f9e3-4db3-bc77-289343d3d118.pdf
```

**Configuration** (in AzureStorageSettings):
```json
{
  "AzureStorage": {
    "ConnectionString": "UseDevelopmentStorage=true",
    "ContainerName": "pmwds-files",
    "LocalUploadPath": "App_Data/Files",
    "LocalBaseUrl": "/files"
  }
}
```

---

## Development Notes

### Running the API

```bash
cd PMWDS.API
dotnet run
# Opens on http://localhost:5177
```

### SQLite Limitations with Hangfire

- Hangfire requires SQL Server (not supported on SQLite)
- When `useSqlite = true`, Hangfire is disabled in `Program.cs` lines 159-167
- Recurring jobs are only registered when using SQL Server

### Migration Commands

When using SQLite for migrations:
```bash
# Add migration
dotnet ef migrations add InitialCreate --project PMWDS.Persistence --startup-project PMWDS.API -c ApplicationDbContext

# The Design Time Factory uses SQL Server by default (see ApplicationDbContextFactory.cs)
# Set environment variable before running:
$env:PMWDS_CONNECTION_STRING = "Data Source=App_Data/pmwds-dev.sqlite"
dotnet ef migrations add InitialCreate ...
```

### Test Users (Seeded)

Check `PMWDS.Persistence/Migrations/Seeders/UsersSeeder.cs` for the seeded accounts.
Every seeded user gets the same password, supplied by `Seed__DefaultPassword` in the
environment. Seeding fails with an explicit message when that variable is missing.

---

## Configuration Priority

1. **Environment Variables** - Highest priority
2. **appsettings.{Environment}.json** - Environment-specific
3. **appsettings.json** - Default/fallback
4. **Code defaults** - In `DatabaseSettings` class

For SQLite-only development:
```json
// appsettings.Development.json
{
  "Database": {
    "ForceSqlite": true,
    "SqliteConnectionString": "Data Source=App_Data/pmwds-dev.sqlite"
  }
}
```

---

## File Locations Reference

| Component | Path |
|-----------|------|
| Program.cs | `PMWDS.API/Program.cs` |
| DbContext | `PMWDS.Persistence/Context/ApplicationDbContext.cs` |
| DbSettings | `PMWDS.Infrastructure/Settings/AppSettings.cs` |
| SQLite DB | `PMWDS.API/App_Data/pmwds-dev.sqlite` |
| Auth Controller | `PMWDS.API/Controllers/AuthController.cs` |
| Seed Data | `PMWDS.Persistence/Migrations/SeedData.cs` |
| Domain Entities | `PMWDS.Domain/Entities/*.cs` |
| File Storage | `PMWDS.Infrastructure/Services/FileStorageService.cs` |

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| SQLite file not found | Ensure `App_Data` folder exists; file is auto-created on first run |
| Migration fails | Delete existing migrations, run `EnsureCreatedAsync` instead |
| Hangfire errors | Expected - disabled when using SQLite |
| Login fails | Check SeedData.cs for seeded users; verify PasswordHash logic |
| EF Core Design Time | Set `PMWDS_CONNECTION_STRING` env var for SQLite |
| File upload hangs | Local file storage is now supported - restart API |
| UploadDocument 500 (0 rows) | EfRepository.UpdateAsync was using _dbSet.Update() which marks the entire entity graph as modified; changed to Entry().State = Modified |
| GetProjectDetails 500 | GetProjectDetailsQueryHandler used AutoMapper without a mapping profile; changed to FromEntity() |

---

## Summary

This is a DDD-based project management system with:
- **Multi-project solution** (7 projects total)
- **SQLite fallback** for development without SQL Server
- **Domain-driven design** with entities, events, and soft deletes
- **MediatR CQRS** pattern for commands/queries
- **SignalR** for real-time features
- **AI/ML integration** for task allocation, delay prediction, burnout risk
- **Local file storage fallback** when Azure Blob Storage is unavailable

The SQLite configuration is controlled via `appsettings.Development.json` with `ForceSqlite: true` ensures SQLite is used for local development.
