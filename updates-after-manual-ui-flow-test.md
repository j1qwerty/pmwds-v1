# Updates after starting the manual UI flow test

Everything below was found and fixed by clicking through the demo journey
(login → create project → milestones/tasks/dependencies → department heads →
verify/edit/delete) against `Client/` on `http://localhost:5175` and
`PMWDS.API` on `http://localhost:5179`.

Companion log: [`manual-ui-flow-test.md`](./manual-ui-flow-test.md) (the step-by-step
run, pass/fail per step).

---

## Backend (PMWDS.API / Application / Domain / Persistence)

### 1. Project edit returned HTTP 500 whenever the department list changed
The headline bug. Editing a project worked only while the assigned-department
list stayed the same length; adding or removing any department returned 500 and
the edit sheet silently discarded the change. Act 3 was blocked on it because
the demo project needed Civil + Procurement assigned before department heads
could see it.

**Root cause.** `EfRepository<Project>.UpdateAsync` marks the aggregate root
`Modified`. EF's cascade behaviour for `Modified` does **not** add dependents,
so the `ProjectDepartment` join rows created by `Project.AssignDepartments`
were never tracked as `Added`. EF emitted an
`UPDATE "ProjectDepartments" ... WHERE "Id" = @p AND "RowVersion" = @p2`, which
matched 0 rows, and threw `DbUpdateConcurrencyException`
("expected to affect 1 row(s), but actually affected 0"). Confirmed by
capturing generated SQL against an isolated copy of the DB with EF command
logging.

A second, smaller defect: dropped assignments were removed from the tracked
collection with no hard delete. `ProjectDepartments` carries a UNIQUE index on
`(ProjectId, DepartmentId)`, so a soft-deleted row would permanently block
re-assigning that department to the same project.

| File | Change |
|---|---|
| `PMWDS.Domain/Entities/ProjectDepartment.cs` | New `MarkedForDeletion` flag + `MarkForDeletion()`. Hard delete (not the usual soft delete) precisely because of the UNIQUE `(ProjectId, DepartmentId)` index — an `IsDeleted` row would block re-assignment forever. Audit trail lives in `ActivityLog`, so the join row itself need not be retained. |
| `PMWDS.Domain/Entities/Project.cs` | `AssignDepartments` replaced `RemoveAll(...)` with an explicit loop that flags a dropped assignment **before** removing it from the backing list. Order matters: removing first detaches the entity and the flag would never reach the persistence layer. |
| `PMWDS.Persistence/Context/ApplicationDbContext.cs` | `SaveChangesAsync` translates `MarkedForDeletion` → `EntityState.Deleted`. |
| `PMWDS.Persistence/Repositories/UnitOfWork.cs` | Added `ProjectDepartments` repository. |
| `PMWDS.Application/Interfaces/Services/IUnitOfWork.cs` | Added `IRepository<ProjectDepartment> ProjectDepartments`. |
| `PMWDS.Application/Features/Projects/Commands/UpdateProjectCommand.cs` | Captures the join rows loaded from the DB and `AddAsync`es every remaining instance as `Added`. Compared **by reference**, not by `DepartmentId` — my first attempt compared by ID and still failed the three-department case, because `Project.Update()` internally calls `AssignDepartments` too, so an already-assigned department gets dropped and re-created as a new instance within the same request. |
| `PMWDS.Persistence/Migrations/20261011120000_AddProjectDepartmentMarkedForDeletion.cs` | New migration adding the column. *(new file)* |
| `PMWDS.Persistence/Migrations/ApplicationDbContextModelSnapshot.cs` | Snapshot entry for the new column. |
| `PMWDS.API/Services/DatabaseConnectionService.cs` | `ALTER TABLE "ProjectDepartments" ADD COLUMN "MarkedForDeletion" ...` in the startup bootstrap. |

**Note on applying the migration.** `dotnet ef database update` cannot be used
against this SQLite file. The database is `EnsureCreated`-bootstrapped and has no
migration history, so EF tries to replay `InitialCreate` against an existing
schema and collides. This is the known two-strategy conflict already documented
in `config-sqlite.md` and `PMWDS.API/sqlite.md`. The column is therefore added by
the existing startup `ALTER TABLE` bootstrap, which is how this project already
handles `Users.PasswordResetToken*`, `Skills.OrganizationId`, etc. Verified
present in `App_Data/pmwds-v1.sqlite`.

**Verification.** API regression matrix (single-PWD → add PWD Civil → add
Procurement too → back to single) went from `OK / FAIL / FAIL / OK` to
**all four OK**. Then through the UI: Edit project → uncheck Procurement &
Finance → Save (row deleted, no 500) → re-add all three → Save (all three render
in the project header).

---

## Client (`Client/`, the vite app on :5175)

### 2. "Saving..." never reset — forms wedged permanently
`MilestoneFormModal`, `TaskFormModal` and `ProjectFormModal` all called
`onSubmit(...)` **without awaiting** and never reset `submitting`. Any slow or
failing save left the footer button stuck on "Saving..." forever. Compounding
it, writes had **no timeout** (only reads were deadline-guarded, at 45s, in the
request coordinator), so a never-settling request hung the awaiting form
indefinitely.

| File | Change |
|---|---|
| `src/api.ts` | `WRITE_TIMEOUT_MS = 60_000`; writes now race an `AbortController` with a 60s deadline, and an `AbortError` is surfaced as `Request timed out after 60s.` instead of an opaque failure. |
| `src/pages/project/components/MilestoneFormModal.tsx` | `handleSubmit` is now `async`, `await onSubmit(payload)` inside `try`, `setSubmitting(false)` in `finally`. |
| `src/pages/project/components/TaskFormModal.tsx` | Same fix. |
| `src/pages/project/components/ProjectFormModal.tsx` | Same fix, plus the footer Save now calls `formRef.current?.requestSubmit()`. The previous `onClick={() => handleSubmit()}` invoked `onSubmit` with no event, and both parents call `e.preventDefault()` unconditionally — so it threw `TypeError: Cannot read properties of undefined (reading 'preventDefault')` and the save silently never fired. |

### 3. Panels rendered as ~40px slivers (Tailwind v4 token collision)
`max-w-sm/md/lg/xl` in the size maps resolved against the **spacing** scale
instead of the **container** scale (e.g. `max-w-xl` → `2.5rem`), so sheets and
modals collapsed to a narrow sliver off-screen.

| File | Change |
|---|---|
| `src/pages/shared/Sheet.tsx` | `SIZE_MAP` uses explicit rem values matching the classic container widths (`sm` 28rem, `md` 36rem, `lg` `max-w-3xl`, `xl` `max-w-5xl`). |
| `src/pages/shared/Modal.tsx` | Same fix. |

### 4. Wizard rendered a white card inside a white card
`Sheet`/`ModalOverlay` already paint a panel, so the wizard's own inner card was
a redundant second white surface.

| File | Change |
|---|---|
| `src/pages/shared/ModalOverlay.tsx`, `src/pages/shared/Modal.tsx` | Added a `bare` prop to suppress the panel for the full-bleed wizard. |
| `src/pages/NewProject/NewProjectPage.tsx` | Wizard uses `bare`; solid white cards, hidden scrollbar (`.no-scrollbar`), debounced draft persistence. |

### 5. Permission checks were role-gated instead of permission-driven
Policy adopted during the run: **role checks only for SuperAdmin; every other
role must be permission-driven.** Audited and fixed across the project pages.

| File | Change |
|---|---|
| `src/pages/project/ProjectMilestonesPage.tsx` | `canManageMilestones` — SuperAdmin or Director role, else `perm.hasAny(milestone.manage / create / edit / delete)`. Drives the New-milestone action and the milestone panel/dependency `canManage` props. *(verified live: PM sees New milestone)* |
| `src/pages/project/ProjectOverviewPage.tsx` | `canUploadProjectDocs` — SuperAdmin or Director, or primary-department user, else permission-driven. |
| `src/pages/project/components/TaskFormModal.tsx` | `canAssignMilestone` — role keys for SuperAdmin/Director, else `PERMISSION_GROUPS.task.manage`. Gates the milestone-assignment field. |

### 6. Topbar changes
| File | Change |
|---|---|
| `src/pages/shared/nav-header.tsx` | Back button is now a filled indigo pill (was visually indistinguishable from a link). Topbar is **title-only** — the description prop was accepted but never rendered, which made it look like a bug; the comment now records that. |

### 7. Project dependencies action was on the wrong tab
`New dependency` lived on the Tasks tab while the dependency UI is on the
Dependencies tab.

| File | Change |
|---|---|
| `src/pages/project/components/MilestoneDependencyPanel.tsx` | Added a `newRequestKey` prop that auto-opens the dependency form on change. |
| `src/pages/project/ProjectDependenciesPage.tsx` | Owns `newRequestKey` state and passes `New dependency` into the tab actions. |
| `src/pages/project/ProjectTasksPage.tsx` | Removed the dependency action. |

### 8. `ProjectInfoCard` duplicated the header on the Milestones tab
| File | Change |
|---|---|
| `src/pages/project/ProjectMilestonesPage.tsx` | `ProjectInfoCard` no longer rendered there. It remains on Overview (`ProjectOverviewPage.tsx:309`) and Tasks (`ProjectTasksPage.tsx:281`). |

### 9. Project card name was cropped to a few characters
The name shared a row with the status badge, so on a narrow card it collapsed to
`"Ganga Expr…"` / `"Demo 202…"`.

| File | Change |
|---|---|
| `src/pages/project/ProjectsListPage.tsx` | Name gets the full card width on its own line (`line-clamp-3 break-words`); status badge + project code share one line beneath it. Project code gains `truncate min-w-0` so it can't force overflow. |

Also in this file, from the same review pass: progress ring moved before the
name; actions reordered view → edit → delete on the header card, grid card and
list row; department chips raised 2 → 4 with a `+N` tooltip; list-row dates
column widened 104px → 150px with `nowrap` so dates stop truncating.

---

## Also in this working tree (not test-driven)

- `manual-ui-flow-test.md` — the run log.
- `deploy-v1.ps1` — `client2` target (bare IP, new port 8090). Already run and
  verified; deployed to `http://147.93.155.185:8090`, nginx site
  `pmwds-v1-client2`, ufw 8090/tcp.

**Note on git state.** The commit `d93b387` ("client2 renamed as client")
swept the `client2/` → `Client/` rename together with several of the client
fixes above (items 3–9), because that work was in flight when the rename was
committed. That is why `git diff 33af5d8..HEAD` shows ~377 files / 63k
deletions — it is dominated by the rename, not by these fixes. Items 1–2 and
the project card work are still uncommitted on top of it.

---

## Known non-bugs (confirmed intended behaviour)

- A milestone assigned a department **not assigned to the project** returns API
  400 "Request failed." — correct validation, not a hang or permission fault.
- A DepartmentHead gets "Project not found" for a project that does not include
  their department — correct scoping.

## Still outstanding

Acts 3 (department heads), 4 (team members + document upload) and 5 (chief
engineer, viewer read-only, delete task/project) were **not reached** in this
session, and the page sweep over `/notificationsPage`, `/organizationStructure`,
`/departmentsPage`, `/users`, `/profiles`, `/ai`, `/reports`, `/roles`,
`/activity-logs`, `/settings` is still pending. The Act 3 blocker is now
resolved, so that act can be resumed.
