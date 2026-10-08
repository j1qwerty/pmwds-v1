# PMWDS Tests

All test-related instructions live here. `README.md` only links to this file.

There are two suites:

| Suite | Where | What it covers |
|---|---|---|
| .NET integration tests | `PMWDS.Tests/` | API controllers, auth, CRUD, cascades, realtime — in-process via `WebApplicationFactory` |
| Browser E2E tests | `browser-tests/` (Playwright + real Chromium) | Full business lifecycle through the **client2** UI in a real browser |

## 1. .NET integration tests (`PMWDS.Tests`)

They boot the real API in-process through `WebApplicationFactory<PMWDS.API.TestHost>`
and talk to it over HTTP, so they exercise the genuine startup path — database
creation, migrations, seeding, authorization — rather than mocks.

```powershell
# Everything (default)
dotnet test PMWDS.slnx

# Just the API suite
dotnet test PMWDS.Tests\PMWDS.Tests.csproj

# One class
dotnet test PMWDS.Tests\PMWDS.Tests.csproj --filter "FullyQualifiedName~CascadeTests"

# One test
dotnet test PMWDS.Tests\PMWDS.Tests.csproj --filter "FullyQualifiedName~RealtimeTests.Deleting_a_task_broadcasts"

# With coverage
dotnet test PMWDS.Tests\PMWDS.Tests.csproj --collect:"XPlat Code Coverage"
```

No setup is required. Each run creates a throwaway SQLite database and storage
directory under `%TEMP%\pmwds-tests\`, seeds it, and deletes both afterwards.
**Your `PMWDS.API/App_Data/pmwds-v1.sqlite` is never touched**, and no `.env` or
`appsettings` value from your machine leaks in — the test host is configured
entirely from code.

Tests require the seeded accounts (default password `Pmwds@123`).

### Running against a real server

Set `PMWDS_TEST_BASE_URL` to run the same suite against an already-running
instance instead of the in-process host:

```powershell
# local
dotnet run --project .\PMWDS.API
$env:PMWDS_TEST_BASE_URL = "http://localhost:5179"
dotnet test PMWDS.Tests\PMWDS.Tests.csproj

# the VPS
$env:PMWDS_TEST_BASE_URL = "https://pmwds.dharmaatribe.app"
dotnet test PMWDS.Tests\PMWDS.Tests.csproj
```

This is the only way to cover the SQL Server and Hangfire branches, since
Hangfire is registered solely when the provider is SQL Server.

> **Warning:** the suite creates and deletes real data. Never point it at
> production without a backup.

### What is covered

| Area | File |
|---|---|
| Login, tokens, anonymous access, per-role permission sets | `AuthenticationTests.cs` |
| The full "New Project" wizard flow — project, milestones, dependencies, tasks — in the same order the React wizard issues them | `WizardFlowTests.cs` |
| Create / read / update / delete for projects, milestones, milestone dependencies, tasks, subtasks, task dependencies, plus validation bounds | `CrudTests.cs` |
| What deleting a project, milestone or task does to everything below it, including recursive subtask removal and certificate unlinking | `CascadeTests.cs` |
| Document upload / list / download, utilization certificates, and the certificate-to-task link on task and milestone deletion | `DocumentsAndCertificatesTests.cs` |
| Departments, users, roles, duplicates, deactivation, and the authorization boundary on each | `OrganizationTests.cs` |
| The live-update path: every mutation must broadcast `DataChanged`, and rejected or forbidden requests must not | `RealtimeTests.cs` |

`CascadeTests` and `RealtimeTests` are the highest-value suites here. Cascade
behaviour had no coverage at all before, and the realtime tests immediately
found two mutating endpoints that never announced themselves.

### Adding a test

Use the helpers in `PMWDS.Tests/Infrastructure`:

- `ApiFixture` — the collection fixture. Exposes a logged-in `Session` per seeded
  role (`SuperAdmin`, `Admin`, `DepartmentHead`, `ProjectManager`, `TeamMember`,
  `Viewer`) and `CreateAnonymousClient()` for negative tests. Put your class in
  `[Collection(ApiCollection.Name)]` so it shares the one booted host.
- `ApiClient` — typed GET/POST/PUT/PATCH/DELETE that unwraps the
  `{ success, data, error }` envelope, plus `PostFormAsync` for multipart uploads
  and `DownloadAsync` for binaries.
- `WizardBuilder` — reproduces the client wizard's exact call sequence.
- `TestProject` — creates and disposes a throwaway project so tests cannot collide.
- `HubListener` — opens a real SignalR connection and waits for `DataChanged` by scope.

**One `HttpClient` per session, never a shared one.** `ApiClient.UseToken` writes
to `HttpClient.DefaultRequestHeaders`, so sessions that share a client overwrite
each other's bearer token and every authorization test silently runs as whichever
identity logged in last. The fixture gives each session its own client for this reason.

```powershell
dotnet build PMWDS.slnx
dotnet test PMWDS.slnx
cd client2
npm run build
npm run lint
```

## 2. Browser E2E tests (`browser-tests/` + `client2/`)

The browser suite lives in `browser-tests` and uses Playwright with real
Chromium. It is separate from the .NET API integration tests above.

**Target UI is `client2`.** Both `Client/vite.config.ts` and
`client2/vite.config.ts` pin the dev server to port `5175`, so only one of them
can run at a time. For E2E and demos, run **client2**:

```powershell
# terminal 1 - API (required)
dotnet run --project PMWDS.API --urls http://localhost:5179

# terminal 2 - client2 UI under test (required)
cd client2
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Default URLs:

```text
API:     http://localhost:5179
client2: http://localhost:5175
Swagger: http://localhost:5179/swagger
```

### Quick start

One command from the repository root does everything — it reads the seeded
password from `.env`, installs dependencies and Chromium if they are missing,
checks client2 is reachable, and runs the suite.

```powershell
cd D:\code\pmwds-v1

# client2 and the API must already be running (see above)
pnpm btest
```

The password is read from `Seed__DefaultPassword` in the repository `.env` — the
same value the database seeder assigns to every seeded account. It is never
printed or written anywhere, and `.env` is gitignored. Set `E2E_PASSWORD` in the
shell to override it.

| Command | What it does |
| --- | --- |
| `pnpm btest` | Run the full business lifecycle, headless |
| `pnpm btest:headed` | Run it with a visible browser window |
| `pnpm btest:list` | List the tests without running anything |
| `pnpm btest:discover` | Read-only UI discovery pass, no writes |
| `pnpm btest:setup` | Install dependencies and Chromium only |
| `pnpm btest:report` | Open the last Playwright HTML report |

Extra arguments are forwarded to Playwright:

```powershell
pnpm btest -- --headed --grep "login"
```

### Pointing at a different target

The default target is `http://localhost:5175`, matching the pinned Vite port in
`client2/vite.config.ts`. Override it when client2 runs elsewhere — this is how
the suite is pointed at staging or a deployed environment.

```powershell
$env:E2E_BASE_URL = "https://your-host"
pnpm btest
```

If client2 is not reachable the runner warns before launching, rather than
failing deep inside Playwright with a navigation timeout.

### Running the runner script directly

The root `pnpm` scripts are a thin wrapper. The underlying script can also be
invoked directly, and understands `--dry-run`, which resolves the password and
target and then exits without installing anything or launching a browser.

```powershell
node scripts\run-browser-tests.mjs --dry-run   # verify configuration only
node scripts\run-browser-tests.mjs --headed     # visible browser
```

### Browser-test setup

The browser suite connects to an already-running client2 instance. The API used
by client2 can therefore be local, staging, or deployed.

```powershell
cd browser-tests
pnpm install
pnpm install:browsers
```

`pnpm btest:setup` from the repository root performs both steps, but only when
`browser-tests/node_modules` is absent.

The current seeded test identities are defined in `browser-tests/src/config.ts`.
Do not hard-code a production password into the repository.

### Discover the browser UI

Discovery walks selected authenticated routes, opens the New Project wizard when
available, detects visible inputs/buttons/links, groups them by nearby
form/dialog/section heading, and writes text inventories under
`browser-tests/ui-map`.

```powershell
# From the repository root (recommended)
pnpm btest:discover
```

```powershell
# Or from browser-tests directly
cd browser-tests

# Headless discovery
$env:E2E_BROWSER = "headless"
pnpm e2e:discover

# Visible Chromium discovery
$env:E2E_BROWSER = "headed"
pnpm e2e:discover
```

Discovery only logs in and reads pages, so it is safe against a real database.
Run it first when the full flow fails — it surfaces seed or credential
mismatches without writing anything.

The inventories are intended to be consumed by the browser flow runner. They
contain semantic attributes such as role, label, placeholder, name, id, type,
aria-label, href, and disabled state.

### Browser flow runner

The browser runner has two browser modes and two execution modes.

```powershell
cd browser-tests

# Interactive mode. It asks for browser visibility and pauses after each logical step.
pnpm e2e:interactive

# Automatic mode. Select the flows to run at startup.
pnpm e2e
```

Browser mode:

- headless Chromium is the default
- headed mode opens a real visible Chromium window

In headed mode every logical step records a before/after screenshot and prints
the output path. Each run also records network request/response metadata, and
failures retain the screenshot/trace/video artifacts.

The full seeded-role business lifecycle is executable through the runner and the
Playwright test (`src/specs/full-business-flow.spec.ts`). It uses isolated
browser contexts for each role so login state does not leak between users. Flow
order: Project Manager creates the project → SuperAdmin / Director verify →
Director creates milestones, tasks, dependency → Department Heads do scoped work
→ Team Members update subtasks + upload documents → Chief Engineer + Viewer
verify → task deletion → project edits → SuperAdmin deletes the project.

### Browser test artifacts

Browser runs are written below `browser-tests/runs/` and are gitignored.
Playwright reports are written below `browser-tests/reports/`.

Never point the destructive full-flow tests at production. The flow creates,
edits, uploads to, and finally deletes real application data.

### Static checks (no running app needed)

```powershell
cd browser-tests
pnpm exec tsc --noEmit
```

### Troubleshooting

- `Warning: http://localhost:5175 is not reachable` — client2 is not running.
  Start it with `cd client2; npm run dev` and retry. Only one of `Client/` /
  `client2/` can hold port 5175 at a time; stop the other one first.
- `No seeded password found` — set `Seed__DefaultPassword` in the repository
  `.env` (the seeder requires it too), or set `E2E_PASSWORD` for the shell.
- Leftover `Browser E2E <timestamp>` projects in dev SQLite after a failed run
  are safe to delete.
- A failing run leaves step artefacts under
  `browser-tests/runs/playwright-<id>/` (`ui/*-before.txt`,
  `ui/*-failure.txt`, `screenshots/`) plus `test-results/*/trace.zip`
  (open with `npx playwright show-trace trace.zip`) and the HTML report
  (`pnpm btest:report`).
- `test-todo.md` tracks the last known E2E progress and the defects the suite
  has exposed.
