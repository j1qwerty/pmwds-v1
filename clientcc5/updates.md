# Updates

Newest first. `api1` is the backend zip. `clientccN` are the web app zips; each contains everything from the client versions listed below it.

## api1 (backend, first version): new endpoints from API_WISHLIST.md

Source: your `PMWDS.API` .NET solution on GitHub (net10.0). Everything below is **new files only**. No existing
backend file was edited, no database migration is needed, and nothing in Program.cs or DI changed (controllers are
auto-discovered). Drop the contents of `api1.zip` over the repo root; it keeps the repo layout.

### What I added

| # | Endpoint | What it does |
|---|----------|--------------|
| 1 | `GET /api/v1/dashboard/summary` | One call for the whole dashboard: project counts, task counts, budget, top projects by urgency, escalated tasks, 7-day activity, unread notification count. Replaces 6 requests. Optional `departmentId`, `topProjects`, `escalations`, `activityDays`. |
| 2 | `GET /api/v1/projects/urgency?limit=8` | Slim project list ranked server-side: delayed first, then AI delay risk, then nearest end date. Excludes Completed and Cancelled. Includes open and overdue task counts per project. |
| 3 | `GET /api/v1/me/work?utcOffsetMinutes=330&horizonDays=7` | The signed-in user's own open tasks grouped as Overdue, Due today, Due soon, with counts. Always filters to the caller. |
| 4 | `GET /api/v1/projects/{id}/health-timeline?weeks=12` | Weekly planned vs actual completion and overdue-open task counts for one project. |
| 5 | `GET /api/v1/search?q=&limit=5` | One endpoint for the Ctrl K palette: projects, tasks, people, departments. |
| 6 | `PATCH /api/v1/notifications/read-all` | **Already existed**, so no backend change. The UI just never called it. |
| 7 | `GET /api/v1/activitylogs/team/summary?days=7` | Event counts per UTC day (plus top 5 event types per day), every day present even when empty. |

New files:
- `PMWDS.Application/DTOs/Insights/InsightsDtos.cs` (response records)
- `PMWDS.API/Services/InsightsQueries.cs` (shared scoped queries)
- `PMWDS.API/Controllers/DashboardController.cs`, `ProjectInsightsController.cs`, `MeController.cs`,
  `SearchController.cs`, `ActivityInsightsController.cs`
- `PMWDS.API/Insights.http` (ready-made test requests for every endpoint)

### Security design (please review)
- Every endpoint reuses your existing scoping instead of inventing new rules: `RoleScopeService.ScopeProjectsAsync`,
  `ScopeUsersAsync`, `ScopeDepartmentsAsync`, `ITaskWorkflowService.GetAccessibleProjectIdsAsync`, `CanAccessProjectAsync`,
  `CanSeeFullProjectDetailsAsync`, and your policies (`ProjectsView`, `TasksView`, `UsersView`, `DepartmentsView`).
- Search returns a section only if the caller passes the matching policy, and filters it through the same scope, so
  it cannot reveal anything the normal pages hide. Sections the user cannot see come back as empty lists.
- Scores are normalised in the API: `delayRiskPercent` and `healthPercent` are integers 0 to 100 (stored delay risk is
  0 to 1, stored health is 0 to 100).
- New controllers share the `/projects` and `/activitylogs` prefixes with the existing controllers, the same way
  `SkillsController` already overrides the base route. Their routes do not overlap existing ones.

### How this was checked, and what was NOT
- Done: the new code compiles with Roslyn against your real `PMWDS.Domain` entities and the real ASP.NET Core
  reference assemblies. EF Core, MediatR and your Application/Persistence projects were replaced by small stubs.
- Done: the ranking, bucketing and timeline logic was run on in-memory data (13 checks: ranking order, completed
  projects excluded, day counts, zero-filled days, other users' tasks never returned, etc.). Two checks "failed"
  only because my expected numbers were wrong; the code behaved correctly.
- **Not done: a full `dotnet build` and a run against a real database.** The sandbox cannot reach NuGet. So the
  EF Core SQL translation of the new queries is untested.

### What you need to test (in this order)
1. `dotnet build` the solution. If anything fails to compile, send me the error text; it is most likely a name I
   inferred from reading the code (for example a using or a property name).
2. Start the API, log in, and run each request in `PMWDS.API/Insights.http`. Any 500 with an EF "could not be
   translated" error means one query needs rewriting; tell me which endpoint.
3. Run on **both** providers you use (SQLite dev and SQL Server production). The dashboard summary uses the same
   `Sum(decimal)` grouping as your existing `GET projects/dashboard`, so if that works for you this will too.
4. Role checks, with at least SuperAdmin, Director, Department Head, Project Manager, Team Member:
   - `dashboard/summary` totals must equal `projects/dashboard` and `tasks/dashboard-summary` for the same user.
   - A Team Member must not see projects or tasks outside their departments in `summary`, `urgency` or `search`.
   - `search`: a role without `Users.View` must get an empty `people` list.
   - `dashboard/summary?departmentId=` for a department the user cannot access must return 403.
5. `me/work`: assign yourself tasks due yesterday, today and in 3 days; check the three buckets. Check as SuperAdmin
   that other people's tasks do not appear (unlike `tasks/my-tasks`).
6. `health-timeline`: open a project with tasks that have completion dates and check that planned and actual
   percentages move sensibly. Open one as a non-primary department user and confirm only their milestones' tasks count.
7. `activitylogs/team/summary`: compare the total with `activitylogs/team` for the same days.
8. Performance: with a realistic amount of data, time `dashboard/summary` against the old six calls.

### Known limits and things I noticed (not changed)
- Health timeline is reconstructed from task due and completion dates. The backend does not store historical AI scores,
  so a real risk-over-time chart needs a new snapshot table first. Say the word and I will design it.
- A completed task with no completion date is counted only in the newest week.
- Per-project task counts in `urgency` and `summary` count all open top-level tasks, as your existing project list does,
  even if a restricted department only sees part of the project.
- Day buckets are UTC days. `me/work` takes the caller's timezone offset; the activity endpoints do not.
- Existing issue: `GET /notifications` loads all of a user's notifications and pages them in memory
  (`NotificationsController.GetMine`). Fine now, slow with thousands of rows.
- Existing issue: `GET /tasks/my-tasks` returns every task for a SuperAdmin.

### Client wiring status
- The UI does **not** call these endpoints yet. Wiring them in is the natural next step (dashboard to `summary`,
  Ctrl K to `search`, a "Today" panel to `me/work`, a "Mark all read" button to `read-all`).

---

## clientcc5 (latest client): dashboard risk-score fix

- **Bug fix in my own earlier work:** the Command Center dashboard treated delay risk as 0 to 100, but your API
  stores it as 0 to 1. Projects showed as "Low" risk with tiny numbers. It now normalises like the project detail
  modal does, uses the same 70% high-risk cut-off as the backend, and shows the risk as a percentage.
- No other client changes.

---

## clientcc4: remaining pages and shared components

Pass over every page that was still on its old layout. Most pages are built from shared components, so those
were fixed once and apply everywhere.

**Shared components (affect Users, Profiles, Departments, Organizations, Roles, Settings, Reports, Notifications,
project tabs and the wizard)**
- Tabs (Notifications, Roles, Reports and others) are now flat underline tabs instead of boxed folder tabs.
- Delete icons on cards and rows are quiet grey until hovered (red only on hover), so lists are no longer
  covered in red.
- Profile picture upload is a small camera icon on user cards and rows, and a proper "Upload photo" button on
  profile forms and in Settings (it was a full-width stretched button in Settings).
- Modal titles and buttons use medium weight and the rose danger colour; destructive buttons match the theme.

**Pages**
- Roles: Edit and Delete on role cards are quiet ghost buttons instead of two bordered buttons per card.
- New-project wizard: narrower form (about 880px instead of nearly full width), sentence-case step labels.
- Project Tasks tab: milestone lanes are neutral white with a border instead of filling the whole section with
  saturated status colour (completed milestones were solid green).
- Project header: status shows "In Progress" instead of "InProgress".
- Users, Departments, Organizations, Profiles, Reports, Settings, Notifications: reviewed in a browser; they
  inherit the new theme, stat strip, tabs and quiet actions. No behaviour changes.

**Not changed on purpose**
- The AI page layout (you said its look was perfect); it follows the new colours and fonts only.
- Users and Profiles were not merged: they use different permission checks, and merging would risk access rules.

---

## clientcc3: projects list, project overview, app-wide polish

Hand-redesign of the projects list and the project overview, plus app-wide polish.

**Projects list**
- Project cards rebuilt: status pill and code on top, title and description, tasks done / total with overdue count,
  one progress bar, then planned end, milestones, priority, budget and manager.
- Removed: coloured top accent bar, progress donut, rainbow department chips (departments are now a single
  line of text), duplicate gradient bar.
- Same behaviour: click to open, keyboard open, hover view/edit/delete actions, filters, sort, card and list views.

**Project overview**
- The four tinted KPI tiles became one strip of six: Progress, Days left (switches to "Past planned end" in red),
  Open tasks, Overdue tasks, Milestones, Budget used (amber above 85%, red above 100%).
- Colour now means risk only.

**App-wide (shared components, so every page picks it up)**
- Stat cards on all pages (Projects, Users, Departments, Roles, Reports, Activity and others) are now one
  surface with hairline dividers instead of separate tinted cards.
- Removed the floating blurred colour blobs and their perpetual animation from the page background.
- All remaining indigo-to-violet gradient buttons and progress bars are now flat accent colour (37 files).
- Card corners tightened from 2xl to xl for a more serious look.

**Still on the old layouts (colours and fonts updated, structure not)**
Users, Profiles, Departments, Organizations, Roles, Settings, Reports, Notifications, the project Milestones /
Tasks / Documents / Dependencies tabs, the new-project wizard, and the AI page.

---

## clientcc2: Command Center dashboard

- New dashboard: greeting with a one-line status, one KPI strip (projects, delayed projects, high delay risk,
  open tasks, delayed tasks, budget spent), projects ranked by urgency, needs-attention list of escalated tasks,
  7-day team activity bars, unread notifications.
- Reuses the existing data loading, realtime refresh, task performance table and task editor.
- Old tile wall, donut and line chart removed from this page, so the charts library no longer loads here.
- Backend suggestions for further simplification are in API_WISHLIST.md (new APIs you offered to add).

---

## clientcc1: first redesign (theme, shell, login)

- New design system: Geist and Geist Mono fonts, cool ink neutrals, one ultramarine accent. All legacy indigo,
  violet, purple and blue utilities resolve to the new accent, so every page re-themes without feature changes.
  Success, warning and error colours unchanged.
- New app shell: dark sidebar with a single "you are here" state, sentence-case group labels, compact mode,
  mobile drawer; cleaner topbar with search (Ctrl K), refresh, notifications.
- Log-out is now its own button (before, the whole profile card logged you out).
- New login screen: dark panel, real capability copy, invented uptime and project stats removed.
- Tinted shadows, visible keyboard focus rings, reduced-motion support.
- Includes everything from the optimized build below.

---

## Before clientcc1: optimized build (pmwds-client2-optimized)

Performance pass on your original client2, same look.
- Route-level code splitting: starting file went from 1.86 MB (477 KB gzip) to about 35 KB.
- Preload pages on nav hover, project tab hover and browser idle.
- New-project wizard and its seven steps load as separate chunks and prefetch when idle.
- Removed every backdrop blur (sidebar, header, modals, cards), the main cause of slow modals and wizard.
- Inter bundled locally instead of a render-blocking Google Fonts import; preconnect for icon font.
- Layout now listens to breakpoint changes instead of every window resize.
- Charts, animation and realtime libraries split into separately cached files.
- Reduced-motion support.
