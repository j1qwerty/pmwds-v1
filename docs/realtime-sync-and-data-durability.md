# Real-time Sync + Data Durability Plan (PMWDS)

> **Status: implemented.** See [Implementation notes](#implementation-notes) at the end for
> deviations from the plan and the verification that was actually run.

## Problem being solved

Two browsers signed into the same VPS instance do not see each other's edits until a
manual page reload. Confirmed root causes, in order of impact:

1. **No refresh mechanism exists in the client.** `Client/src/appData.tsx:254-304`
   fetches `/workspace/bootstrap` + `/pages` once, inside a `useEffect` keyed on
   `[auth, logout]`. Same for `Client/src/pages/nested/nestedShared.ts:21-97`
   (`useProjectWorkspace`) and `Client/src/pages/projectsK/components/DocumentsSection.tsx:41-43`.
   The only `refresh()` callers are the code that just mutated in the same tab.
   There is no polling, no refetch-on-focus, no `visibilitychange`, no socket.
2. **Server caches `/api/v1/pages` for 30s and never invalidates.**
   `PMWDS.API/Controllers/PagesController.cs:57-58` (read) and `:185` (write, 30s TTL).
   `ICacheService.RemoveAsync` is defined in
   `PMWDS.Application/Interfaces/Services/ICacheService.cs:10` and
   `PMWDS.Infrastructure/Services/CacheService.cs:38-41` but has **zero call sites**.
3. **Blanket `Cache-Control: public, max-age=30` on every GET.**
   `PMWDS.API/Conventions/ProducesResponseTypeConvention.cs:22-31`. Only two
   endpoints opt out via `[ResponseCache(NoStore = true)]`.
4. **Redis degrades badly.** `Program.cs:228-232` calls `AddStackExchangeRedisCache`
   unconditionally. When Redis is down (it is down locally; port 6379 refuses),
   `GetStringAsync`/`SetStringAsync` throw, so `/pages` can 500. The log message at
   `Program.cs:220-226` claims "fall back to in-memory" but no in-memory
   `IDistributedCache` is ever registered.

SignalR is already scaffolded but completely inert: `Program.cs:244,356-357` map
`/hubs/notifications` and `/hubs/dashboard`, JWT-from-query-string is handled at
`Program.cs:109-120`, and `DashboardHub` already has `SubscribeToProject` /
`UnsubscribeFromProject`. But there are **zero `IHubContext<>` usages** in the
solution and `@microsoft/signalr` is not in `Client/package.json`.

Hangfire does **not** help here and is out of scope for this plan. It is a background
job scheduler and cannot push data to a browser.

## Out of scope (separately discussed, not in this plan)

- Standing up SQL Server / Redis locally and enabling Hangfire.
- Hangfire storage, dashboard, recurring jobs.
- Redis-backed rate limiting / horizontal scaling.

---

## Step 1 — Server: data-change notifier

**New files**

- `PMWDS.Application/Interfaces/Services/IDataChangeNotifier.cs`
- `PMWDS.Infrastructure/Services/DataChangeNotifier.cs`

`IDataChangeNotifier` exposes `NotifyAsync(string scope, string? entityId = null,
Guid? projectId = null, CancellationToken ct = default)`.

`DataChangeNotifier` injects `IHubContext<DashboardHub>` and sends a single event
`"DataChanged"` to `Clients.All`. Every connected client holds every group membership
it needs, and authorization is still enforced per-request when the client refetches,
so broadcasting the invalidation hint is safe and avoids per-project fan-out bookkeeping.

Payload:

```csharp
public sealed record DataChangedNotification(string Scope, string? EntityId, Guid? ProjectId, DateTime OccurredAt);
```

Scopes: `projects`, `milestones`, `tasks`, `users`, `documents`, `departments`,
`organizations`, `roles`, `notifications`, `dashboards`, `reports`, `integrations`,
`knowledge`, `skills`, `utilization-certificates`.

**Registration** — `Program.cs`, next to the other scoped services (~line 162):
`builder.Services.AddScoped<IDataChangeNotifier, DataChangeNotifier>();`

## Step 2 — Server: publish from mutations

Inject `IDataChangeNotifier` into the controllers that own mutable data and call
`NotifyAsync` after `SaveChangesAsync` succeeds. Target only the endpoints the client
actually lists.

| Controller | File | Scopes |
|---|---|---|
| Projects | `Controllers/ProjectsController.cs` | `projects` (CRUD, `:211,:253,:290,:479`); `documents` (`:376`) |
| Milestones | `Controllers/MilestonesController.cs` | `milestones` (`:302,:338,:401,:468,:546`), `milestones` for dependency CRUD (`:67,:145,:190`) |
| Tasks | `Controllers/TasksController.cs` | `tasks` (`:243,:283,:344,:372,:406,:538,:1029`), `documents` (`:585`), `tasks` for subtasks (`:817,:882,:927,:941,:959,:982`) and dependencies (`:1082,:1130,:1149`) |
| Users | `Controllers/UsersController.cs` | `users` (`:107,:244,:338,:373,:419,:447,:504,:553,:638,:680`) |
| Departments | `Controllers/DepartmentsController.cs` | `departments` (`:98,:169,:255`) |
| Organizations | `Controllers/OrganizationsController.cs` | `organizations` (`:76,:98,:132,:162,:195`) |
| Roles | `Controllers/RolesController.cs` | `roles` (`:61,:112,:170,:208,:236,:264`) |
| Notifications | `Controllers/NotificationsController.cs` | `notifications` (`:79,:99,:119`) |
| Dashboards | `Controllers/DashboardsController.cs` | `dashboards` (`:48,:63,:80,:96,:112,:130,:138`) |
| Utilization certs | `Controllers/UtilizationCertificatesController.cs` | `utilization-certificates`, `documents` (`:66,:196,:237,:265,:310`) |

Notes:
- `AuthController` is deliberately excluded — login/logout/refresh change only the
  caller's own session, and the client already reacts to those.
- `AIController` mutations that write predictions/allocations are excluded unless a
  page visibly lists them; revisit if AI results appear stale.
- Notification publication must not be blocked by notifier failure — wrap each call in
  try/catch and log, so a SignalR hiccup can never fail a user's save.
- Pass `projectId` where the route provides it so a future optimization can narrow
  delivery to `project-{id}` groups already supported by `DashboardHub`.

## Step 3 — Server: kill the stale caching

### 3a. Remove the blanket client cache

`PMWDS.API/Conventions/ProducesResponseTypeConvention.cs` — delete the
`ResponseCacheAttribute` block (lines 22-31) entirely. All app data is
auth-scoped and must never be browser-cached.

`PMWDS.API/Program.cs` — remove `builder.Services.AddResponseCaching();` (~line 69)
and `app.UseResponseCaching();` (line 345). The middleware is already inert for
Bearer-auth requests (`ResponseCachingMiddleware` refuses to cache requests carrying
an `Authorization` header) while `UseResponseCaching` sits before `UseCors` and
`UseAuthentication`; removing it removes the misleading header source with no
behavioural change for authenticated endpoints.

Leave `AddMemoryCache()` in place — `AspNetCoreRateLimit` and `LoginLockoutService`
depend on it.

### 3b. Remove the `/pages` snapshot cache

`PMWDS.API/Controllers/PagesController.cs` — remove the `ICacheService _cache`
dependency, the `cacheKey`/`GetAsync` short-circuit (lines 57-61) and the
`SetAsync` write (line 185). Once clients receive `DataChanged`, the snapshot buys
nothing and costs correctness. (Alternative if `/pages` proves too slow under load:
keep a version counter — see Risks.)

The `ProducesResponseTypeConvention` removal already strips the client-side header,
so no cache-busting query params are needed anywhere.

### 3c. Make Redis optional and non-fatal

`PMWDS.API/Program.cs` (~lines 210-232) — restructure the probe so the outcome
drives the actual registration:

- Try `StackExchange.Redis.ConnectionMultiplexer.Connect` inside the existing
  `try/catch` and record a `redisAvailable` bool.
- If reachable → `AddStackExchangeRedisCache` as today.
- If not → `AddDistributedMemoryCache()` and log one clear warning.

This makes the existing "will fall back to in-memory" log line true. Also add a
`try/catch` inside `RedisCacheService.GetAsync`/`SetAsync`/`RemoveAsync`
(`PMWDS.Infrastructure/Services/CacheService.cs`) that logs and returns
`default`/`false` on `RedisConnectionException`, so a mid-flight Redis outage can
never turn a page load into a 500.

## Step 4 — Client: SignalR connection

**Install** `npm install @microsoft/signalr` in `Client/` (latest 8.x/10.x compatible
with React 19 + Vite 8; resolves to `10.0.11` at time of writing).

**New file** `Client/src/realtime.ts`:

- Builds the hub URL from the same base as `Client/src/api.ts`. `API_BASE_URL` there
  is e.g. `https://pmwds.dharmaatribe.app/api/v1`, so derive the origin and append
  `/hubs/dashboard`. In dev (`http://localhost:5177/api/v1`) that yields
  `http://localhost:5177/hubs/dashboard`.
- A module-level singleton `HubConnection` with `accessTokenFactory` returning the
  current JWT from `localStorage` key `pmwds-client-auth` (matching
  `STORAGE_KEY` in `Client/src/auth.tsx`). Reading from storage rather than React
  state avoids tearing the connection down on every token refresh.
- `startRealtime()`, `stopRealtime()`, and an `onDataChanged(handler)` subscription
  returning an unsubscribe function.
- `withAutomaticReconnect([0, 2000, 5000, 10000, 30000])`.
- Expose connection state (`connecting` / `connected` / `disconnected`) so the UI can
  show an offline hint. Guard against double-`start()` under React StrictMode.

**New file** `Client/src/realtimeContext.tsx` (or extend `appData.tsx`):
start the connection when `auth` exists, stop it on logout, and fan the
`DataChanged` event out to subscribers.

## Step 5 — Client: consume the event

`Client/src/appData.tsx`:
- Subscribe to `onDataChanged`. On any event, call the existing `refresh()`. Debounce
  to ~250ms so a bulk import doesn't cause a refetch storm.
- Skip events caused by the current user if cheap to detect (optional; correctness
  first — refetching on your own write is harmless).
- Ensure `refresh` does not run concurrently; guard with an in-flight ref.

`Client/src/pages/nested/nestedShared.ts` (`useProjectWorkspace`):
- Subscribe per mounted instance; call `load()` on relevant scopes
  (`projects`, `milestones`, `tasks`, `documents`). Unused `load` must stay
  referentially stable (wrap in `useCallback`) so the existing effect deps hold.

`Client/src/pages/projectsK/components/DocumentsSection.tsx`:
- Call `fetchDocuments()` on `documents` and `projects` scope events. Move
  `fetchDocuments` into `useCallback` and include it in the subscribe effect deps.

**Scope→action mapping** should be centralized in one module (e.g.
`Client/src/realtimeScopes.ts`) rather than duplicated across the three files, so
adding a new scope later is a one-line change.

## Step 6 — Client: safety net

Refresh even if the socket is down.

- **Refetch on focus/visibility.** In `appData.tsx`, listen for `window` `focus` and
  `document` `visibilitychange` (when `document.visibilityState === "visible"`) and
  call `refresh()`. Debounce ~1s. Same treatment for `useProjectWorkspace`.
- **Slow poll.** `setInterval` at 60s calling `refresh()`. Skip entirely when the
  document is hidden, and skip when the realtime connection reports `connected` to
  avoid redundant traffic. Both intervals must be cleaned up on unmount/auth change.
- **Manual Refresh button** in `Client/src/layout.tsx` shell calling
  `useAppData().refresh()`. Cheap to add, and gives users an explicit escape hatch.

## Step 7 — nginx

> **IMPORTANT — this step is partly OUTSIDE the repository and must be done on the VPS.**
>
> `Client/nginx.conf` is only the Docker/Compose config. **Production does not use it.**
> The live site is served by nginx installed directly on the VPS (`147.93.155.185`,
> Ubuntu 24.04, nginx 1.24), with configuration in:
>
> - `/etc/nginx/sites-available/pmwds-ip` — the bare-IP server block
>   (`listen 80 default_server; server_name _;`), added per `PRODUCTION.md:317`.
> - the Certbot-generated domain block for `pmwds.dharmaatribe.app`.
>
> **Both blocks must get a `location /hubs/` entry added by hand.** They serve the same
> webroot and proxy the same locations, so both need it. Neither file lives in this repo,
> so this cannot be committed — it has to be applied on the server during deploy.
>
> If this is skipped, the SignalR connection works perfectly in local development and
> **silently fails in production** (the browser gets a 404 on `/hubs/dashboard/negotiate`
> and just quietly falls back to the 60s poll). Treat it as a required deploy step, not
> an optional one.
>
> Apply on the VPS:
>
> ```bash
> ssh contabo
> sudo cp /etc/nginx/sites-available/pmwds-ip{,.bak}
> sudo nano /etc/nginx/sites-available/pmwds-ip     # add the location /hubs/ block
> sudo nginx -t && sudo systemctl reload nginx
> curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
>   -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
>   http://127.0.0.1/hubs/dashboard/negotiate
> ```
>
> Expect `400` (missing `access_token`) or a `101` upgrade — **not** a `404`. A `404`
> means the `location` block is missing or still spelled `/hub/`.

### In-repo change

`Client/nginx.conf:33` — change `location /hub/` to `location /hubs/` to match
`Program.cs:356-357`. Also add `proxy_read_timeout 3600s;` and
`proxy_send_timeout 3600s;` to that block, otherwise nginx will cut idle WebSocket
connections at the 60s default before `withAutomaticReconnect` ever sees a drop.

The in-repo `Client/nginx.conf` edit only fixes the Docker path. The live VPS nginx
blocks described above must be updated separately on the server — see the callout at
the top of this step.

## Step 8 — Non-destructive `UsersSeeder`

`PMWDS.Persistence/Migrations/Seeders/UsersSeeder.cs:52-85` — currently overwrites
seeded users on **every** boot (name, job title, availability, AI scores, profile
picture), renames emails, and deletes SuperAdmin's `UserDepartments` rows. Edits to
seeded users are silently reverted on every restart.

Change to match the `AnyAsync` guard used by every other seeder:

- Only apply `UpdateProfile` for fields that are still empty/unset
  (null/blank first name, last name, job title, `ProfilePictureUrl`).
- Only assign availability / AI scores when the user has no explicit value already.
- Keep role assignment, but only add a role that is missing — do not remove roles an
  admin granted.
- Keep `RenameRetiredEmailsAsync` (idempotent, only renames when the target email is
  free).
- Make the SuperAdmin department/organization clearing **creation-only**: move it
  inside the `if (user == null)` branch so it runs once at insert, not on every boot.

Do not touch the other seeders — they already use the `AnyAsync` early-return guard
(`ProjectsSeeder.cs:41` and ~24 others).

## Step 9 — Storage roots and dev uploads

Two separate, inconsistent roots today:

- Uploads (`ILocalFileStorageService`) → `{AppContext.BaseDirectory}/Data/...`
  (from `AzureStorage:LocalUploadPath`, empty in Development).
- Avatars + seeded profile images → `{AppContext.BaseDirectory}/App_Data/...`
  (from `FileStorage:BasePath`, empty).

In Development the first resolves to `PMWDS.API/bin/Debug/net10.0/Data`, so a
rebuild deletes uploaded files while their `ProjectDocuments` rows survive in the DB
→ downloads 404. Also, `SeedData.SeedAsync(..., storageBasePath: storageBaseRoot)`
(`Program.cs:376`) passes the `App_Data` root, but the `/files` static handler is
rooted at `Data` (`Program.cs:322-330`) — so seeded profile images written to
`App_Data` are not actually served by `/files` despite the URL the seeder writes.

Changes:

1. In `PMWDS.API/appsettings.Development.json`, set
   `"AzureStorage": { "LocalUploadPath": "App_Data", "LocalBaseUrl": "/files" }`
   and `"FileStorage": { "BasePath": "App_Data", ... }` so both settings agree.
   Both are already gitignored (`App_Data/`) and resolve to
   `PMWDS.API/App_Data`, **outside** `bin/`, so a rebuild no longer destroys uploads.
   Production values (`/var/lib/pmwds/data`) are unaffected and stay absolute.
2. Align the seeding root with the served root: pass the **same** resolved root to
   both `UseStaticFiles` and `SeedData.SeedAsync`. Cleanest is to resolve one
   `storageRoot` variable at `Program.cs:319-341` and use it for the static file
   providers, `FileStorage:BasePath`, and the seeder argument — removing the
   `Data` vs `App_Data` split entirely rather than making two settings agree by
   convention.
3. Verify the seeded-avatar URL the seeder writes still matches the `/files` request
   path after the roots are unified (`UsersSeeder.cs:121-158`).
4. Confirm `.gitignore` covers the chosen dev folder (it already ignores `App_Data/`,
   `Data/`, `*.sqlite`, `*.db`).

**One-time data move**: if there are currently uploaded documents in
`PMWDS.API/bin/Debug/net10.0/Data/documents`, copy them into
`PMWDS.API/App_Data/documents/` before switching, otherwise their DB rows will point
at missing files.

---

## Verification

Manual, since there is no test suite for this area:

1. `dotnet build PMWDS.slnx` clean; `cd Client && npm run build` clean.
2. Start API + client, log in on two browsers (or one normal + one incognito).
3. Browser A creates/edits/deletes a **project** → browser B updates within ~1s, no
   reload.
4. Repeat for a **milestone**, a **task**, a **user**, and a **document upload**.
5. Confirm A itself sees its own save immediately (previously up to 30s stale).
6. Kill the API or block the socket, confirm the 60s poll + focus refetch still
   recover the data, and that the offline hint appears.
7. `curl -sI -H "Authorization: Bearer <token>" http://localhost:5177/api/v1/pages`
   → assert **no** `Cache-Control: public, max-age=30`.
8. Restart with Redis stopped → confirm `/pages` still returns 200 and one clear
   warning is logged (not a 500).
9. Restart the API, then check that a seeded user's edited job title **survives**.
10. Upload a document in dev, run `dotnet build`, restart → document still listed
    **and** still downloads.
11. Confirm `/hubs/negotiate` reaches the API through nginx (WebSocket `101`
    upgrade), not a 404 from the `/hub/` mismatch.
12. Reload `/hangfire` still behaves as before (unchanged, still SQL-Server-gated).

## Risks and decisions to flag

- **`/pages` is a heavy endpoint** (~120 EF queries) and is now uncached. Removing the
  30s cache could increase DB load. Acceptable at current scale; if it becomes a
  problem, reintroduce caching with a **monotonic version counter** in the DB (bump on
  every mutation, include the version in the cache key) rather than a TTL. Do not
  reintroduce a plain TTL.
- **Broadcast vs targeted push.** `Clients.All` sends the invalidation hint to every
  connected user. Clients still refetch through authorized endpoints, so no data
  leaks, but each event costs N refetches. The debounce in Step 5 is what keeps this
  sane. A per-user/per-department fan-out via the existing `user-*`/`dept-*` groups
  is the follow-up if N grows.
- **StrictMode double-effect** will mount the realtime provider twice in dev. The
  singleton + start guard must handle it.
- **Token expiry mid-connection.** With `ExpiryMinutes: 1440` a socket can outlive its
  JWT. `accessTokenFactory` is only invoked on (re)negotiate, so a socket that
  reconnects after expiry with a stale localStorage token could 401. Reading the token
  fresh from localStorage on each factory call, plus `auth.tsx` already writing the
  refreshed token back to storage, should cover this — verify explicitly in step 6.
- **`Program.cs` line ordering.** `AddHangfire` still depends on
  `databaseStatus.Provider`; none of these changes alter that gate.
- **VPS nginx edit is out-of-repo.** Step 7 must be applied by hand on
  `147.93.155.185` in both the domain and `default_server` blocks, otherwise SignalR
  works locally and silently fails in production.
- **Seeded user edit semantics.** Step 8 means a seeded user who was renamed at seed
  time keeps the old name forever. That is the intended trade (edits persist), but if
  you want to rename seeds, the seeder constants must change rather than the DB row.
---

## Implementation notes

All nine steps are implemented. Deviations from the plan, and why:

### Where the notifier lives

Planned for `PMWDS.Infrastructure/Services/DataChangeNotifier.cs`. It is in
**`PMWDS.API/Services/DataChangeNotifier.cs`** instead: it depends on
`IHubContext<DashboardHub>` and the hub itself, and `PMWDS.Infrastructure` cannot
reference `PMWDS.API`. The interface and the `DataChangeScopes` constants stay in
`PMWDS.Application/Interfaces/Services/IDataChangeNotifier.cs` as planned.

### Redundant work removed from the notifications path

`NotificationService` was deliberately **not** wired to the hub beyond the
notifications scope. Existing notification writes already broadcast via the
`notifications` scope, which the app-data store treats as a global scope, so the
notification bell updates without a special case.

### Redis probe

The probe was made async (`ConnectAsync`) and its result now drives the registration
rather than being logged and ignored. `RedisCacheService` was also given a
constructor-injected `ILogger` and a catch-all that degrades to a miss.

### Seeder avatar URL

The planned "verify the seeder's URL still matches" check turned out to be moot:
`PMWDS.API/SeedData/Images/` contains only a `README.txt`, so no profile images are
copied and every seeded user falls back to a dicebear URL. The structural fix still
matters - the seeder writes into `storageRoot` and `/files` is now rooted there too.

### Storage resolution detail the plan missed

The plan said to point Development config at a persistent gitignored folder, but did
not account for **how** relative paths resolve. `StoragePathResolver.Resolve` binds
against `AppContext.BaseDirectory`, which under `dotnet run` is
`PMWDS.API/bin/Debug/net10.0` - so `App_Data` would still have landed inside `bin/`
and been deleted on rebuild, exactly the bug being fixed. Relative storage paths now
resolve against `IWebHostEnvironment.ContentRootPath`, which is `PMWDS.API/` in
development and the publish folder in production. This matches what
`DatabaseConnectionService` already does for the SQLite data source.

Because of that, the root had to be resolved **before** `builder.Build()` so
`LocalFileStorageSettings` could be pinned to it via `PostConfigure`; the
configuration read previously happened after `Build()`.

### Verification actually performed

Run against a live API on `:5199` with **Redis down**, Development/SQLite:

| Check | Result |
|---|---|
| `POST /hubs/dashboard/negotiate` | 200, connectionToken, WebSockets offered |
| WebSocket upgrade `GET /hubs/dashboard?id=...` | 101, authenticated (`User: Aarav Sharma`) |
| SignalR handshake | `{}` ack |
| `POST /api/v1/departments` mutation | **`DataChanged` broadcast received over the socket** |
| `/api/v1/pages` with Redis down | 200 (previously 500) |
| `Cache-Control` on `/pages`, `/projects`, `/users`, `/workspace/bootstrap` | absent |
| Seeded user job title edited, API restarted | edit survived (Step 8) |
| Uploaded document listed + downloaded | 55,877 bytes |
| ...after full `dotnet build` + restart | still listed, still 55,877 bytes (Step 9) |
| `GET /avatars/<file>` | 200 `image/webp` from the upload root (Step 9) |
| Startup log | `[PMWDS] Storage root: ...\PMWDS.API\App_Data` |

The end-to-end broadcast was confirmed with a real `System.Net.WebSockets.ClientWebSocket`
rather than assumed, precisely because the SSE path returned 200 with an empty body and
would have been easy to misread as working.

### Two test-harness traps hit along the way

Recorded because both produced convincing false results:

1. PowerShell does not expand `` `x1e `` inside a double-quoted string; it emits the
   literal characters `x1e`. The first WebSocket handshake therefore sent a malformed
   frame and the server returned `{"error":"Handshake was canceled."}` after its 15s
   timeout. Fixed by building the record separator as `[char]0x1e`.
2. The first SSE/WS probes returned HTTP 200 / 404 in ways that looked like product
   bugs. The 404 was a malformed URL built from a scratch file that had been written
   with `docId: <guid>` labels rather than a bare GUID.

### Still outstanding

- The **VPS nginx change is not in the repo** and has not been applied. See the callout
  in Step 7 and `PRODUCTION.md` section 2b. SignalR works locally and will fail
  silently in production until this is done by hand.
- SQL Server, Redis and Hangfire remain out of scope and untouched.
- `packages` audit warnings (`SQLitePCLRaw.lib.e_sqlite3`, `Microsoft.OpenApi`) are
  pre-existing and unaddressed.
- No automated test covers this area; the verification above is manual.
