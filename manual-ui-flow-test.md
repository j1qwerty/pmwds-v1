# Manual UI flow test — client (ex-client2) + local API

- Date: 2026-10-11
- Client: http://localhost:5175/ (vite dev, `client/`)
- API: http://localhost:5179/ (`PMWDS.API`, SQLite fallback `App_Data/pmwds-v1.sqlite`)
- Seed password: `Pmwds@123`
- Browser: internal browser tab (snapshot/click/fill/select/screenshot)
- Note: `http://127.0.0.1:5175/` 502s from the internal browser because vite binds
  `[::1]` (IPv6 loopback); `http://localhost:5175/` works.

## Login smoke
| # | Step | Result |
|---|------|--------|
| 0 | Open http://localhost:5175/ → lands on login page | PASS — title PMWDS, login form rendered |
| 1 | Manual login form: email `manager@org1.com` + password `Pmwds@123` → Sign In | PASS — dashboard loads, `pmwds-client-auth` in localStorage. NOTE: harness `fill` appended text on this React form (values doubled); set exact values via page JS then clicked Sign In |

## Act 1 — PM creates project
| # | Step | Result |
|---|------|--------|
| 2 | Sidebar → Projects (`/projects`): 4 seeded projects listed, filters + card/list toggle render | PASS |
| 3 | Topbar **New Project** → wizard modal (bare, no outer white card/X) | PASS with note — a11y ref-click missed once (stale ref); clicked via page JS. Modal scrim + steps header + step card render |
| 4 | Step 1 Project Details: name `Demo 2026-10-11`, desc, Priority High, budget 12.5, 2026-11-01 → 2027-06-30 → Next | PASS — advanced to Step 2 |
| 5 | Step 2 Milestones empty → Next **disabled** ("At least one milestone is required") — script's "leave empty" not possible | DEVIATION — added milestone `Demo Kickoff`, due 2027-01-31 via inline form (note: harness fill hit the list search box behind modal first; cleared it, targeted `Milestone name` precisely) |
| 6 | Step 3 Assign Departments → set `Public Works Department` on Demo Kickoff → Next | PASS — reached Step 4 |
| 7 | Step 4 Dependencies empty → **Create project** | PASS — landed `/projects/9da628f3-6980-4410-9466-5656e335412e/milestones`. Topbar: colored back button, title-only `Milestones · Demo 2026-10-11`, New milestone + New task actions. **PM sees New milestone button (permission fix verified live)** |
| 8 | Back to Projects via topbar back button → demo card listed | PASS |

## Act 2 — Director adds structure (as `admin@org1.com`)
| # | Step | Result |
|---|------|--------|
| 9 | Sidebar avatar click → logged out to `/login` (no confirm) | PASS |
| 10 | DEV QUICK LOGIN → Admin `admin@org1.com` | PASS — dashboard as Director, demo project listed |

## Act 2 findings — "stuck Saving" root cause (milestone + department)
| # | Step | Result |
|---|------|--------|
| 11 | Director → demo project → Milestones tab (overview header correctly hidden here) | PASS |
| 12 | Topbar **New milestone** → `PWD Coordination Milestone`, dept Public Works Department, due 2027-03-31 → Create | PASS — created, form closed cleanly |
| 13 | New milestone → `Civil Works Milestone` + PWD Civil Division → Create: footer stuck on **Saving...**, milestone missing server-side | FAIL (UI) — investigated below |
| 14 | Repro via API: POST without dept → 64ms OK; POST with real PWD id → 64ms OK; POST with real Procurement&Finance id → **400 `bad_request` "Request failed."** | Root cause #1: server rejects departments **not assigned to the project** (correct validation; demo script itself warns the API 400s these). NOT a hang, NOT permissions |
| 15 | Root cause #2 (client): `MilestoneFormModal.handleSubmit` fired `onSubmit` without await and **never reset `submitting`** → any slow/error save wedged the button on "Saving..." forever. Same defect in `TaskFormModal`, `ProjectFormModal`. Also `api.ts` writes had **no timeout** (reads have 45s via coordinator) | FIXED: all three handlers now `await` + `finally { setSubmitting(false) }`; writes abort after 60s with `Request timed out` error. `tsc` clean |
| 16 | Re-test after fix: `Procurement Milestone` + Procurement&Finance → clean error banner "Request failed.", button reset, modal stays open (correct behavior) | PASS |
| 17 | Same form, dept → None → Create | PASS — created instantly, modal closed, no stuck spinner. Fix verified live |
| 18 | Edit `PWD Coordination Milestone` → rename `... Updated` → Save changes | PASS — saved, no stuck spinner (edit path + modal fix verified) |
| 19 | Open Civil milestone → New task ×4 (title, desc, 2026-11-05 → 2027-02-28, 24h, High): Civil Site/Quality (Civil), Coordination (PWD Updated), Procurement (Procurement) | PASS — all created, no stuck spinners (task modal fix verified) |
| 20 | Tasks tab → all four tasks render; topbar has New milestone + New task, **no Dependencies action** (moved) | PASS |
| 21 | Dependencies tab → topbar **New dependency** action present → Prereq `PWD Coordination Milestone Updated` → Dependent `Civil Works Milestone` → Add | PASS — dependency created, shows Blocking |

## Act 3 — Department heads scoped work
| # | Step | Result |
|---|------|--------|
| 22 | Login `head.eng@org1.com` (Rohan Iyer) → dashboard scoped (2 projects, demo absent) → direct milestones URL → **Project not found** | BLOCKED — demo project only has PWD in its departments (Civil/Procurement milestones were created dept-less). Correct scoping behavior, but demo setup needs those departments on the project first. Fixing setup as Director, then resuming Act 3 |
| 23 | As Director, try to add Civil + Procurement to the demo project via **Edit project** → Save | **FAIL (HTTP 500)** — edit sheet silently discarded the change. Root cause and fix below |

## Act 3 blocker — project department edit returned 500 (root cause + fix)
Symptom: editing a project worked while the department list stayed the same
length, but adding or removing any department returned HTTP 500 and the sheet
discarded the change. Only the size of the list mattered.

**Root cause.** `EfRepository<Project>.UpdateAsync` marks the aggregate root
`Modified`. EF's cascade for `Modified` does **not** add dependents, so the
`ProjectDepartment` join rows that `Project.AssignDepartments` created were
never tracked as `Added`. EF then emitted an `UPDATE "ProjectDepartments" ... WHERE
"Id" = @p AND "RowVersion" = @p2`, matched 0 rows, and threw
`DbUpdateConcurrencyException` ("expected to affect 1 row(s), but actually
affected 0"). Verified by capturing the generated SQL against an isolated DB
copy with EF command logging.

A second, smaller defect: dropped assignments were removed from the tracked
collection without a hard delete. `ProjectDepartments` carries a UNIQUE index on
`(ProjectId, DepartmentId)`, so a soft-deleted row would permanently block
re-assigning that department.

| # | Fix | Result |
|---|-----|--------|
| 24 | `ProjectDepartment.MarkedForDeletion` + `MarkForDeletion()`; `Project.AssignDepartments` flags a dropped assignment **before** removing it from the collection (removing first detaches it and the flag would never reach persistence) | Applied |
| 25 | `ApplicationDbContext.SaveChangesAsync` translates `MarkedForDeletion` → `EntityState.Deleted` (hard delete, so the unique index stays usable) | Applied |
| 26 | Migration `20261011120000_AddProjectDepartmentMarkedForDeletion` + matching model-snapshot entry. `dotnet ef database update` cannot be used on this SQLite file (it is `EnsureCreated`-bootstrapped with no migration history, so EF tries to replay `InitialCreate` and collides) — the column is instead added by the existing startup `ALTER TABLE` bootstrap in `DatabaseConnectionService` | Applied; column verified present in `App_Data/pmwds-v1.sqlite` |
| 27 | `IUnitOfWork.ProjectDepartments` repository added | Applied |
| 28 | `UpdateProjectCommandHandler` captures the join rows loaded from the DB **by instance** (not by `DepartmentId` — `Project.Update()` calls `AssignDepartments` too, so an already-assigned department is dropped and re-created as a new instance in the same request) and `AddAsync`es every remaining instance as `Added` | Applied |
| 29 | Regression matrix via API: single-PWD → add PWD Civil → add Procurement too → back to single | **PASS — all four OK** (baseline was OK / FAIL / FAIL / OK) |
| 30 | UI: Edit project → uncheck Procurement & Finance → Save | PASS — row deleted, no 500 |
| 31 | Re-add all three departments → Save | PASS — rows re-inserted, project header renders Public Works Department + PWD Civil Division + Procurement & Finance | PASS |

## Project card layout (visual fix)
| # | Step | Result |
|---|------|--------|
| 32 | `/projects` grid card: name was cropped to a few characters ("Ganga Expr…") because the status badge shared the name's row on a narrow card | FIXED — name on its own line (`line-clamp-3 break-words`), status badge + project code share one line beneath it. Verified in browser across all 5 projects |

## Remaining acts — NOT YET RUN
These were not reached in this session and are still pending:
- **Act 3 (continued)** — `head.eng` / `head.pmo` / `head.ops` scoped project,
  milestone and task views. The demo project now has all three departments
  assigned, so the `Project not found` blocker is cleared.
- **Act 4** — team members (`member`, `dinesh`, `manoj`), including document
  upload on the project Documents tab.
- **Act 5** — chief engineer, viewer read-only pass, delete a task, edit
  project, delete project.
- **Page sweep** — `/notificationsPage`, `/organizationStructure`,
  `/departmentsPage`, `/users`, `/profiles`, `/ai`, `/reports`, `/roles`,
  `/activity-logs`, `/settings`.
