# PMWDS

PMWDS is a project management and workflow decision support system. It combines portfolio planning, organization and department management, task and milestone execution, notification workflows, reporting and AI-assisted delivery signals such as task allocation, delay prediction, burnout risk, and project health.

The API entry point is `PMWDS.API`. The frontend lives in `Client`.
`client2/` is the UI under active development and the target of the browser E2E
suite and the human demo — see [demo.md](demo.md).

## Documentation

| File | Purpose |
|------|---------|
| [CONFIG.md](CONFIG.md) | Full setup, configuration, build, deployment, and operations guide |
| [tests.md](tests.md) | All test instructions — .NET integration suite and Playwright browser E2E (client2) |
| [demo.md](demo.md) | Human demo walkthrough of the client2 UI, step by step |
| [config-sqlite.md](config-sqlite.md) | Combined SQLite config guide with verified implementation and remediation |
| [responsive.md](responsive.md) | Responsive design properties by category - layout, breakpoints, and clamp values |
| [mssql-issue.md](mssql-issue.md) | The 25-second SQL Server latency problem, its root cause, and the fix |
| [vps-mssqlserver.md](vps-mssqlserver.md) | Installing SQL Server and Redis on the VPS, and connecting SSMS to it |
| [vps.md](vps.md) | What is installed on the Contabo VPS and where |


## Tech Stack

- Backend: `.NET 10`, ASP.NET Core Web API, EF Core, MediatR, AutoMapper, FluentValidation.
- Persistence: SQL Server for production, SQLite fallback for local development.
- Background jobs: Hangfire on SQL Server only.
- Realtime: SignalR hubs for notifications and dashboard updates.
- AI: OpenAI-compatible provider support for OpenAI and OpenRouter, plus local ML/heuristic services for allocation and delay signals.
- Client: React, TypeScript, Vite.
- Auth: JWT bearer tokens with role-based policies.
- Containerization: Docker Compose (SQL Server 2022 + Redis) for local development.

## Solution Layout

```text
PMWDS.API/             API entry point, controllers, middleware, SignalR hubs
PMWDS.Application/     DTOs, CQRS commands/queries, service interfaces
PMWDS.Domain/          Entities, enums, domain events, core rules
PMWDS.Persistence/     EF Core DbContext, repositories, migrations, seed data
PMWDS.Infrastructure/  Email, cache, audit, file storage, reports, background jobs
PMWDS.AI/              AI services, chat engine, recommendation and prediction logic
PMWDS.Tests/          xUnit integration tests (see "Running the tests")
Client/                React client application
```

## Local Development

The app supports two database modes:

| Mode | Setup | Features |
|------|-------|----------|
| **SQLite** (default) | No setup required | Quick start, no Hangfire, no cache |
| **SQL Server + Redis** (Docker) | Docker Desktop required | Full features including Hangfire + cache |

### SQLite Mode (No Setup)

```powershell
dotnet build PMWDS.slnx
dotnet run --project PMWDS.API --urls http://localhost:5179
```

The SQLite database is at `PMWDS.API/App_Data/pmwds-v1.sqlite`. The API automatically uses SQLite because `appsettings.Development.json` has `Database:ForceSqlite: true`.

### Docker Mode (SQL Server + Redis)

Run the full stack (SQL Server 2022 + Redis) with docker-compose:

```powershell
docker-compose up -d
```

The stack uses 2GB RAM for SQL Server and minimal memory for Redis. Data persists in Docker volumes across restarts.

Run the API pointing to Docker SQL Server:

```powershell
dotnet build PMWDS.slnx
dotnet run --project PMWDS.API --urls http://localhost:5179
```

The API checks SQL Server once and uses it when reachable. Hangfire and Redis cache are active in this mode.

Reset to SQLite anytime:

```powershell
docker-compose down
```

Then run the API normally in Development — it falls back to SQLite automatically.

Run the client (use `client2` — it is the UI under test and the demo UI):

```powershell
cd client2
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Default URLs:

```text
API:     http://localhost:5179
client2: http://127.0.0.1:5175
Swagger: http://localhost:5179/swagger
Scalar:  http://localhost:5179/scalar
```

## Docker Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows (WSL2 backend).

### Images

Pull the required images manually if not using docker-compose:

```powershell
docker pull mcr.microsoft.com/mssql/server:2022-latest
docker pull redis:alpine
```

### docker-compose

The project includes a `docker-compose.yml` at the root that defines both services:

| Service | Port | Image | Memory |
|---------|------|-------|--------|
| mssql-server | `1433` | `mcr.microsoft.com/mssql/server:2022-latest` | 2GB |
| redis | `6379` | `redis:alpine` | ~5MB idle |

Start the stack:

```powershell
docker-compose up -d
```

Stop without losing data:

```powershell
docker-compose down
```

Stop and delete volumes (wipes databases):

```powershell
docker-compose down -v
```

View logs:

```powershell
docker-compose logs -f
```

### Connection Strings

The Docker SQL Server uses SQL authentication. `appsettings.Development.json` is pre-configured with these defaults:

```json
"Default": "Server=localhost,1433;Database=pmwds-v1_Dev;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True;MultipleActiveResultSets=true"
```

The SA password is set in `.env` (gitignored). Change it before any non-local use.

### Managing Containers from GUI

Open Docker Desktop → **Containers** tab to start, stop, restart, or inspect the running services.

### Creating Databases for Other Projects

The Docker SQL Server can serve multiple projects. Connect from any app:

```
Server=localhost,1433;Database=YourAppDb;User Id=sa;Password=YourStrong!Passw0rd;...
```

Create a new database via sqlcmd:

```powershell
docker exec mssql-server sqlcmd -S localhost -U sa -P "YourStrong!Passw0rd" -Q "CREATE DATABASE YourAppDb"
```

### Storage Location

Docker images and containers are stored in a WSL2 virtual disk. To relocate to a different drive:

```powershell
wsl --shutdown
wsl --export docker-desktop-data D:\docker\docker-desktop-data.tar
wsl --unregister docker-desktop-data
wsl --import docker-desktop-data D:\docker\wsl\ D:\docker\docker-desktop-data.tar --version 2
```

## Default Credentials

All seeded accounts use this default password:

```text
Pmwds@123
```

| Email | Role | Notes |
|-------|------|-------|
| `admin@pmwds.com` | SuperAdmin | Full access |
| `manager@pmwds.com` | ProjectManager | Project and report management |
| `head@pmwds.com` | DepartmentHead | Department and capacity management |
| `lead@pmwds.com` | TeamLead | Team execution workflows |
| `member@pmwds.com` | TeamMember | Task execution workflows |
| `viewer@pmwds.com` | Viewer | Read-only style access |
| `ava.patel@pmwds.com` | TeamMember | Seeded engineering user |
| `noah.chen@northwind-labs.example` | TeamLead | Seeded operations user |
| `mia.roberts@contoso-transform.example` | TeamMember | Seeded strategy user |

Change these passwords before using the project outside local development.

## Seed Data

On first run, the API seeds representative data across the full product surface:

- Organizations and departments.
- Roles, permissions, users, profiles, and skills.
- Projects, milestones, standalone tasks, milestone tasks, subtasks, dependencies, comments, assignments, and time entries.
- Notifications, templates, alert rules, dashboards, widgets, reports, schedules.
- Integrations, webhooks, webhook deliveries.
- Knowledge articles, lessons learned, activity logs.
- AI models, training data, prediction results, allocation recommendations, and delay predictions.

## Important Runtime Notes

- SQL Server remains the production database target.
- SQLite is a development fallback and is bootstrapped with `EnsureCreated` style schema creation because older SQL Server migrations are not fully portable to SQLite.
- Hangfire is disabled when SQLite is active.
- The API startup path creates or rebuilds the SQLite development database if the expected schema is missing or stale.
- Direct `dotnet ef database update` against the existing SQLite file is not the recommended flow for this repo. See [config-sqlite.md](config-sqlite.md).
- When running with Docker SQL Server, EF Core migrations (`database.MigrateAsync`) run automatically on startup.
- The app auto-detects the database provider in order: SQL Server → SQLite fallback in Development. Run `docker-compose up -d` before starting the API to use SQL Server.

## Tests

All test-related instructions live in [tests.md](tests.md):

- **.NET integration tests** (`PMWDS.Tests/`) — API controllers, auth, CRUD, cascades, realtime via `WebApplicationFactory`: `dotnet test PMWDS.slnx`.
- **Map-driven E2E tests** (`tests/e2e/` + `client2/`, primary UI suite) — 7 core flows through the client2 UI in real Chromium, driven by editable text maps. The API (`:5179`) and client2 (`:5175`) must already be running.
- **Browser E2E tests** (`browser-tests/` + `client2/`) — full seeded-role business lifecycle: `pnpm btest` (headless) or `pnpm btest:headed` (visible).

The human demo walkthrough is in [demo.md](demo.md).

### E2E quick start (`tests/e2e`)

```powershell
cd tests/e2e
npm install
npx playwright install chromium      # one-time browser download
npm run smoke                        # offline check: maps parse, keys resolve
```

```powershell
npm run e2e                          # interactive: asks display mode + flows, then prompts before each step (Y/n/s/q)
npm run e2e -- --auto                # automatic: all 7 flows, no step prompts
npm run e2e:auto:headless            # automatic, headless (no window)
npm run e2e:auto:visible             # automatic, visible window, screenshot before/after every step
```

Display mode (asked at startup in both run modes, or passed explicitly):

```powershell
npm run e2e -- --mode visible        # watch it run (slowed to 250ms, per-step screenshots)
npm run e2e -- --mode headless       # no window (default, fastest)
npm run e2e:visible                  # interactive + visible shortcut
npm run e2e:headless                 # interactive + headless shortcut
npm run e2e -- --no-shots            # visible window without per-step screenshots
npm run e2e -- --slowmo 500          # slower actions for watching
```

Run a subset, point elsewhere, or pre-pick the first user:

```powershell
npm run e2e -- --auto --flows 1,3             # only flows 1 and 3
npm run e2e -- --auto --flows project-create  # or by flow id
npm run e2e -- --url http://localhost:5175    # default target (E2E_BASE_URL also works)
npm run e2e -- --user pm                      # pre-pick the first user
```

Screenshots go to `tests/e2e/e2e-artifacts/screenshots` (`NN-<step>-before/after/-FAILED.png`),
uploads to `tests/e2e/e2e-artifacts/uploads`. Flows build on each other, so run
flow 1 first (or `--flows all`). Destructive — disposable database only.

## Future Improvements

- Replace development password hashing with ASP.NET Core Identity password hashing or another production-grade password hasher.
- Soft-delete a project's milestones, departments and documents when the project is deleted. Today the project row is only marked deleted, so the `NoAction` foreign keys never cascade and milestone rows are left attached to a project that no longer appears anywhere. `CascadeTests.Deleting_a_project_leaves_its_milestones_undeleted_today` pins the current behaviour.
- Split SQL Server and SQLite migrations into provider-specific migration sets.
- Persist AI chat/session history instead of keeping transient in-memory context.
- Extend browser coverage beyond the core lifecycle into deeper notifications, reports, live-update, and negative authorization scenarios.
- Move secrets to environment variables, user secrets, Azure Key Vault, or another managed secret store.
- Add production deployment scripts for API, client, SQL Server, Redis, storage, and background workers.
