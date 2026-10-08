# Browser E2E test status

Working notes for the Playwright suite in `browser-tests/`. Tracks how far the
run gets, which defects it exposed, and how to resume.

Last run: **step 27 of ~51** (`Department Head A - Civil verifies scoped access`).

---

## Running the suite

The suite talks to an **already-running** client and API. It starts neither.

```powershell
# terminal 1 - API
dotnet run --project PMWDS.API

# terminal 2 - client2 UI under test
cd client2; npm run dev
```

Then, from the repository root:

```powershell
pnpm btest                # full lifecycle, headless
pnpm btest:headed         # visible browser - use this when debugging a step
pnpm btest:discover       # read-only UI discovery, no writes
pnpm btest:list           # list the spec without running it
pnpm btest:report         # open the last HTML report
pnpm btest -- --grep "..."   # extra args pass through to Playwright
```

`pnpm btest` reads `Seed__DefaultPassword` from the repository `.env` (the same
value the database seeder gives every seeded account) and installs
`browser-tests/node_modules` + Chromium if they are missing. Set `E2E_PASSWORD`
to override, `E2E_BASE_URL` to target another environment.

Static checks that need no running app:

```powershell
cd browser-tests
pnpm exec tsc --noEmit
```

### Destructive

`pnpm btest` runs the full business lifecycle: it creates a project with
milestones, tasks, subtasks, documents and dependencies, then deletes it as
SuperAdmin. **Disposable database only** - never production.

Each run leaves its project behind if it fails partway. The dev SQLite
currently accumulates `Browser E2E <timestamp>` projects; they are safe to
delete.

---

## Verified steps

Steps 1-26 pass in a full run.

| # | Step | Notes |
|---|------|-------|
| 1 | Login as Project Manager | seeded password + 11 seeded identities |
| 2 | Open Projects and start New Project | |
| 3 | Fill project details | name, description, priority, budget, dates |
| 4 | Select PWD, PWD Civil and Procurement departments | step widened to include Procurement; see fix 14 |
| 5 | Review project users | |
| 6 | Review empty milestone plan | |
| 7 | Review empty dependencies | |
| 8 | Review empty initial tasks | |
| 9 | Finish project creation | |
| 10 | Verify new project visible to the project manager | |
| 11 | Login as SuperAdmin | |
| 12 | SuperAdmin: verify project visibility | |
| 13 | Login as Director / Admin | |
| 14 | Director: verify project visibility | |
| 15 | Director opens project milestones | |
| 16 | Director creates PWD milestone | |
| 17 | Director creates PWDC milestone | |
| 18 | Director creates PROC milestone | |
| 19 | Director edits the PWD milestone | |
| 20 | Director creates task: Civil Site Review Task | |
| 21 | Director creates task: Civil Quality Review Task | |
| 22 | Director creates task: Coordination Review Task | |
| 23 | Director creates task: Procurement Review Task | |
| 24 | Director verifies task and milestone counts | |
| 25 | Create a milestone dependency | |
| 26 | Login as Department Head A - Civil | |

---

## Remaining steps to verify

| # | Step | Area |
|---|------|------|
| 27 | Department Head A - Civil verifies scoped access | **currently failing** |
| 28 | Department Head A creates a subtask | |
| 29 | Department Head A edits its task | |
| 30-32 | Department Head B - PMO (scoped access, subtask, edit task) | |
| 33-35 | Department Head C - Operations (scoped access, subtask, edit task) | |
| 36-44 | Team Members A/B/C (open scoped task, update subtask progress, upload task document) | |
| 45 | Chief Engineer / Project Manager verifies project visibility | |
| 46 | Viewer verifies project without write controls | |
| 47 | Department Head C deletes its task | |
| 48 | Project Manager edits the project | |
| 49 | Director edits the project | |
| 50 | SuperAdmin performs final project deletion | |
| 51 | SuperAdmin verifies the project disappeared | |

### Current failure - step 27

```
Locator: getByText('Civil Works Milestone', { exact: true })
Expected: visible   (timeout 15s)
```

Department Head A (`head.eng@org1.com`) belongs to PWDC and
`Civil Works Milestone` is the PWDC milestone, so it should be in scope. Not yet
diagnosed. Things worth checking when picking it up:

- does the milestones page render a scoped list for a Department Head, or the
  full list?
- `roleWork` asserts on the milestones page
  (`browser-tests/src/flows/work-lifecycle.ts`); the milestone name may render
  with extra text, so `exact: true` may need the same treatment as the project
  card in fix 11.
- `expectButtonHidden(page, /new milestone/i)` in the same step is a second
  assertion to watch.

---

## Resuming from a specific step

The flow is a **single Playwright test** made of sequential, stateful steps:
each builds on the project, milestones and tasks the previous one created.
`--grep` filters tests, not steps, so it cannot skip ahead - a filtered run that
excluded step 27 would have no project to assert against.

Practical options when working on step 27+:

1. **Just run the whole thing** (~4 minutes). It stops at the first failure, so
   earlier verified steps cost you only a couple of minutes.
   ```powershell
   pnpm btest
   ```

2. **Watch it** to see the failing step happen:
   ```powershell
   pnpm btest:headed
   ```

3. **Temporarily narrow the flow** while iterating. Comment out the completed
   blocks in `browser-tests/src/flows/full-business-flow.ts` (`createProject`,
   `adminMilestonesAndTasks`, ...) and keep only the section under test. Revert
   before committing.

4. **Read the artefacts** a failing run leaves behind - these are the fastest
   way to see what the page actually showed:
   ```
   browser-tests/runs/playwright-<id>/ui/<step>-before.txt    page state before the step
   browser-tests/runs/playwright-<id>/ui/<step>-failure.txt   page state at failure
   browser-tests/runs/playwright-<id>/screenshots/            before/after/failure
   browser-tests/test-results/.../trace.zip                   npx playwright show-trace trace.zip
   ```
   ```powershell
   pnpm btest:report
   ```

5. **Correlate with the API log** for server-side rejections (400/403/500) that
   the UI swallows - the flows tolerate a missing toast with `.catch(() => {})`,
   so a failed create can still leave the step "green".

---

## Defects the run exposed

Fixed. Kept here because several are product bugs, not test bugs, and each one
silently broke parts of the app.

### Application

1. **`Client/src/appData.tsx` - departments and users never loaded, for anyone.**
   The reference-data load was aborted on effect cleanup, and a ref guard then
   blocked every retry, so the collection was permanently empty. Every
   department/task/milestone selector rendered empty (the milestone Department
   select offered only "None"). Now only a real unmount aborts the load.
2. **`ProjectDocuments` missing `MilestoneId` / `TaskId`.** The
   `AddDocumentHierarchy` migration had not reached the development SQLite
   database, so `GET /projects/{id}` threw
   `SQLite Error 1: 'no such column: p0.MilestoneId'` and the project page
   returned 500. Added compat columns and indexes in
   `EnsureSqliteCompatibilityColumnsAsync`.
3. **`InputF` had no `htmlFor`/`id`,** and rendered the required `*` inside the
   label - so the accessible name was "Name*" rather than "Name". Label is now
   associated with the input and the marker sits outside it.
4. **`DependencyFormModal`** had the same label/asterisk defect on both
   milestone selects.
5. **`DependenciesPanel` / `MilestoneDependencyPanel`** let the decorative icon
   glyph into the accessible name, making the button read "add New".
6. **Project Managers could not see departments beyond their own.** They are
   seeded with `DepartmentOwn*` only, so `ScopeDepartmentsAsync` returned a
   single department and a cross-department project could not be created.
   `DepartmentAllView` added to the ProjectManager seed.

### Test harness

7. `newContext()` never received a `baseURL`, so every standalone script's
   relative `page.goto` threw "Cannot navigate to invalid URL".
8. Default base URL was `http://127.0.0.1:5175`, but Vite binds `::1` on
   Windows - `ECONNREFUSED`. Now `http://localhost:5175`.
9. Project name matched with `exact: true` against a card that concatenates
   name, status, code, priority and departments; matched by accessible name and
   scoped to `<main>` so the sidebar cannot satisfy it.
10. "Nearest div ancestor" for a milestone row resolved to the title row, which
    contains no buttons; now anchors on the ancestor owning the edit control.
11. Task names asserted on the milestones page, where only counts are rendered;
    now asserted on the Tasks tab.
12. `selectLabel` could not match `"<name> (<status>)"` options; now resolves an
    option by prefix.
13. Project creation selected PWD + PWDC, but the flow later creates a PROC
    milestone, which the API rejects (400) because a milestone's department must
    belong to the project. Project now includes Procurement.
14. `browser-tests` had no `typecheck` script.

---

## Notes

- Redis is not running locally; the API logs a warning and falls back to
  in-memory caching. Harmless for this suite.
- `Seed__DefaultPassword` must be present in `.env` - the seeder refuses to run
  without it, and so does the test runner.
- Generated output (`node_modules/`, `runs/`, `reports/`, `test-results/`,
  `ui-map/*`, `pnpm-lock.yaml`) is gitignored; only `ui-map/.gitkeep` is tracked.