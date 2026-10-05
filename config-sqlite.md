# SQLite Development Configuration & Issue Guide

This document combines the SQLite development setup notes and the root-cause issue report, verified against the current implementation (as of June 2026).

---

## 1. Why SQLite

PMWDS targets SQL Server in production. Local development falls back to SQLite because SQL Server is unavailable on the development laptop. The solution uses a bootstrap flow that bypasses EF migrations for SQLite — this keeps the project runnable but introduces schema lifecycle inconsistencies.

---

## 2. Current Implementation (Verified)

### 2.1 Provider Selection

File: `PMWDS.API/Services/DatabaseConnectionService.cs`

Selection priority at startup:

```
1. ForceSqlite: true (Development only) —→ SQLite
2. SQL Server reachable                   —→ SQL Server
3. Development mode                        —→ SQLite fallback after one SQL Server probe
4. Otherwise                              —→ throw
```

**Config (`PMWDS.API/appsettings.Development.json`):**
```json
"Database": {
  "ForceSqlite": true,
  "SqliteConnectionString": "Data Source=App_Data/pmwds-dev.sqlite"
}
```

### 2.2 SQLite Bootstrap Flow

When SQLite is active, `PrepareDatabaseAsync()` calls `EnsureSqliteDevelopmentDatabaseAsync()`:

```
1. Check connectivity
2. Check expected tables exist (20+ tables verified via sqlite_master)
3. Check for a marker index (IX_Departments_Code absence = stale schema)
4. If missing/stale → database deleted (EnsureDeleted) + recreated (EnsureCreated)
5. Patch missing compatibility columns (PasswordResetTokenExpiresAt, OrganizationId, etc.)
6. Seed data runs (SeedData.SeedAsync)
```

This is NOT `db.Database.MigrateAsync()` — it bypasses EF migrations entirely.

### 2.3 Compatibility Columns

After `EnsureCreated`, the following ALTER TABLE statements are applied if columns are missing:

| Table | Column | Type |
|-------|--------|------|
| Users | PasswordResetTokenExpiresAt | TEXT NULL |
| Users | PasswordResetTokenHash | TEXT NULL |
| Users | OrganizationId | TEXT NULL |
| Skills | OrganizationId | TEXT NULL |
| Roles | PaginationPageSize | INTEGER NOT NULL DEFAULT 10 |

### 2.4 Design-Time DbContext Factory

File: `PMWDS.Persistence/Context/ApplicationDbContextFactory.cs`

- Reads `PMWDS_SQLITE_CONNECTION_STRING` env var
- Falls back to resolving solution root → `PMWDS.API/App_Data/pmwds-dev.sqlite`
- Always uses SQLite for EF tooling (migrations add, etc.)

### 2.5 Seed Data

File: `PMWDS.Persistence/Migrations/SeedData.cs`

Ordered seeders run after schema bootstrap:

1. OrganizationsSeeder
2. DepartmentsSeeder
3. RolesAndPermissionsSeeder
4. UsersSeeder
5. ProfilesSeeder
6. ProjectsSeeder
7. MilestonesSeeder
8. TasksSeeder
9. NotificationsSeeder
10. ActivityLogsSeeder
11. MiscSeeder (integrations, knowledge articles, lessons learned, AI data, etc.)

Default password: `Pmwds@123`

### 2.6 Hangfire

Hangfire is enabled only when SQL Server is active (line 130-138 of Program.cs). Disabled for SQLite.

---

## 3. The Problem: Schema Lifecycle Inconsistency

### 3.1 What Works

- `dotnet build PMWDS.slnx`
- API startup on SQLite (auto-creates/recreates schema)
- Swagger at `http://localhost:5177/swagger/v1/swagger.json`
- EF migration creation (`dotnet ef migrations add ...`)
- Full local development workflow

### 3.2 What Fails

```powershell
dotnet ef database update --project PMWDS.Persistence --startup-project PMWDS.API
```

**Error:** `SQLite Error 1: 'table "AuditLogs" already exists'`

### 3.3 Root Cause

Three-way mismatch:

| Layer | Schema Mechanism | State |
|-------|-----------------|-------|
| Historical migrations | SQL Server-oriented migration chain | Assumes migration-driven lifecycle |
| Current SQLite file | `EnsureCreated` bootstrap | Schema exists, but no migration history |
| EF tooling expectation | `__EFMigrationsHistory` table | Expects clean replay from migration zero |

The project uses two competing schema strategies (`EnsureCreated` + migrations) against the same database file. `EnsureCreated` bypasses migrations, so EF tooling doesn't recognize the existing schema and tries to replay migrations that collide with existing objects.

---

## 4. Remediation Options

### Option 1: Keep SQL Server Authoritative, SQLite Disposable

**Best for:** Production stays on SQL Server; SQLite is just dev convenience.

- Treat SQL Server as the only authoritative migration target
- Keep SQLite recreate-on-start behavior
- Document SQLite as disposable
- Validate migrations only against SQL Server in CI

### Option 2: Make SQLite First-Class via Clean Baseline

**Best for:** SQLite must be durable and trustworthy.

- Stop using `EnsureCreated` for long-lived SQLite databases
- Delete drifted SQLite file
- Rebuild from fresh `dotnet ef database update` replay
- Add CI validation for SQLite migration replay

### Option 3: Re-Baseline Migrations

**Best for:** Clean architectural reset.

- Freeze current model as new baseline
- Archive old migrations
- Generate single new baseline migration
- Apply consistently going forward

### Option 4: Maintain Separate Migration Sets

**Best for:** Both SQL Server and SQLite as real supported targets.

- Keep independent migration sets per provider
- Generate and validate each separately

### Option 5: Use Local SQL Server (Docker/LocalDB)

**Best for:** Full production parity.

- Run SQL Server locally via Docker or LocalDB
- Remove or reduce SQLite fallback to emergency-only

---

## 5. Recommended Path

1. **Short term** — Keep current SQLite fallback for development convenience. SQLite is disposable.
2. **Medium term** — Make SQL Server the authoritative migration path. Use Docker SQL Server for production-parity testing.
3. **If SQLite must be durable** — Establish a clean migration-driven baseline; remove `EnsureCreated` for persistent databases.

---

## 6. Files Involved

| File | Role |
|------|------|
| `PMWDS.API/Program.cs` | Startup, Hangfire conditional registration, database preparation |
| `PMWDS.API/Services/DatabaseConnectionService.cs` | Provider selection, SQLite bootstrap, schema validation, compatibility columns |
| `PMWDS.Persistence/Context/ApplicationDbContextFactory.cs` | Design-time factory (SQLite for EF tooling) |
| `PMWDS.Persistence/Migrations/SeedData.cs` | Seed orchestration |
| `PMWDS.Infrastructure/Settings/AppSettings.cs` | `DatabaseSettings` class (ForceSqlite, SqliteConnectionString) |
| `PMWDS.API/appsettings.Development.json` | Development override (ForceSqlite: true) |
| `PMWDS.API/appsettings.json` | Base configuration (SQL Server connection strings) |

---

## 7. Quick Reference

```powershell
# Run API locally (SQLite auto-bootstrap)
dotnet run --project PMWDS.API --urls http://localhost:5177

# Add a migration
dotnet ef migrations add MigrationName --project PMWDS.Persistence --startup-project PMWDS.API --context ApplicationDbContext

# Apply migrations to SQL Server (NOT to SQLite dev DB)
dotnet ef database update --project PMWDS.Persistence --startup-project PMWDS.API --context ApplicationDbContext

# Build everything
dotnet build PMWDS.slnx
cd Client
npm install && npm run build
```
