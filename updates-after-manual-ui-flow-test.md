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

### 2b. **Regression: every role saw every button, tab and action** (permission engine)
Item 5 below (role checks → permission checks) exposed a latent defect in
`coversManagedPermission` and turned the whole app into an open door. Fixed.

**Symptom.** After the permission-driven rework, a TeamMember saw *New Project*,
*New milestone*, *New task*, *New dependency*, and view/edit/delete on project
cards; Viewer saw the same; ProjectManager saw the notification **Templates**
and **Alert rules** tabs and user-management. Sidebar items leaked too.

**Root cause.** `Client/src/permissions.ts`, inside `coversManagedPermission`:

```ts
for (const candidate of scopedVariants(requested)) {
  if (expanded.has(candidate)) return true;
  if (PERMISSION_COVERAGE[candidate]?.some((covered) => expanded.has(covered))) return true;  // ← this line
}
```

`PERMISSION_COVERAGE` is a *downward* map: `MANAGE` → `[VIEW, CREATE, EDIT,
DELETE]`, i.e. "granting X also grants what X covers". The expansion loop above
already applies it in that direction. The second line read it **backwards** —
"holding any one permission X covers also grants X" — which collapses the entire
hierarchy, because every `*_MANAGE` covers `*_VIEW`:

- TeamMember holds `PROJECT_OWN_VIEW` (seeded, `RolesAndPermissionsSeeder.cs`).
  `PERMISSION_COVERAGE["PROJECT_OWN_MANAGE"]` contains `PROJECT_OWN_VIEW`
  (reached as an alias candidate via `scopedVariants`), so
  `perm.has(PERMISSION_GROUPS.project.manage)` returned **true**.
- Same for `TASK_OWN_VIEW` → `TASK_MANAGE`, `MILESTONE_OWN_VIEW` →
  `MILESTONE_MANAGE`, and `NOTIFICATION_OWN_VIEW` → `NOTIFICATION_MANAGE`
  (whose coverage is `[view, broadcast, template manage, rule manage]` — hence
  Templates + Alert rules).

Why it looked new: `canManageMilestones` and the dependencies `canManage` were
*role*-gated (`isSuperAdmin || Director`) before item 5, which masked the bug for
milestones/dependencies. `canManageProjects` / `canManageTasks` were already
permission-gated and already leaking.

**Fix.** `Client/src/permissions.ts` — deleted the inverted-coverage branch.
Matching is now exact against the expanded grant set; the only aliasing left is
the intentional one in `scopedVariants` (a non-scoped request also matches its
`_OWN_` / `_ALL_` variants, and an `_ALL_` grant implies its `_OWN_`
counterpart). This matches `PermissionPolicyRegistry.AddScopedCrud` on the
server, where `*.Create/Edit/Delete` accept `ownManage`/`allManage` but `*.View`
does **not** accept `create`/`edit`/`delete`.

**Verification.** Extracted the six seeded role permission sets from
`RolesAndPermissionsSeeder.cs` and asserted the real `coversManagedPermission`
against them (75 assertions: per-role manage/create/edit/delete/view, the two
composite flags `canManageMilestones` and `canConfigureNotifications`, and every
sidebar/route-guard permission). All 75 pass after the fix; the same script
against the pre-fix `permissions.ts` fails 13, including exactly the reported
symptoms:

```
FAIL  TeamMember     has(PROJECT_MANAGE) = true, expected false
FAIL  TeamMember     has(MILESTONE_MANAGE) = true, expected false
FAIL  TeamMember     has(TASK_MANAGE) = true, expected false
FAIL  TeamMember     has(NOTIFICATION_MANAGE) = true, expected false
FAIL  Viewer         has(PROJECT_MANAGE) = true, expected false
FAIL  DepartmentHead has(NOTIFICATION_MANAGE) = true, expected false
FAIL  ProjectManager has(USER_MANAGE) = true, expected false
FAIL  ProjectManager has(NOTIFICATION_MANAGE) = true, expected false
FAIL  TeamMember     canManageMilestones() = true, expected false
FAIL  Viewer         canManageMilestones() = true, expected false
FAIL  TeamMember     canConfigureNotifications() = true, expected false
FAIL  Viewer         canConfigureNotifications() = true, expected false
FAIL  ProjectManager canConfigureNotifications() = true, expected false
```

One intentional behaviour change worth flagging: **Activity Logs is now hidden
from TeamMember and ProjectManager.** Both hold `ACTIVITY_LOG_OWN_CREATE` but no
`ACTIVITY_LOG_OWN_VIEW`, and were only seeing the page because of this bug. The
server already refuses them — `AuthorizationPolicies.ActivityLogsView` requires
`ActivityLogManage`/`ActivityLogView`/`SystemAdmin`. If they are meant to have
the page, add `ActivityLogOwnView` to those role specs in
`RolesAndPermissionsSeeder.cs` rather than loosening the client.

This was display-only: the API never leaked. Every one of those buttons would
have 403'd on submit.

### 2c. One coarse `canManage` flag was gating every verb
Follow-on from §2b. §2b fixed *who passes a permission check*; this fixed
*which permission each control asks for*. Every affordance in the project
workspace hung off a single `perm.has(<MODULE>_MANAGE)` flag, which was then
used to gate create, edit, delete, status-change and inline-add controls alike.

Once §2b is in, gating on `manage` can only ever **hide** things (since
`manage ⊇ edit ⊇ view`), never leak them — so this is precision work, not a
security fix. The one real inversion was create actions gated on a non-create
flag. Worth doing properly rather than patching, so the UI now asks for the
verb it actually performs.

The server's shape (`PermissionPolicyRegistry.AddScopedCrud`) is the spec:

```
X.View   = manage | view
X.Create = manage | create
X.Edit   = manage | edit
X.Delete = manage | delete
X.Manage = manage
```

`perm.canModule(verb, module)` reproduces exactly this, because the coverage
map already expands `manage` down to every verb. So every page derives its
flags the same way, and every prop is named for the verb it guards:

| File | Change |
|---|---|
| `src/pages/project/ProjectsListPage.tsx` | `canCreateProjects` / `canEditProject` / `canDeleteProject`. `ProjectSummaryCard` and `ProjectListView` take `canEdit` + `canDelete` instead of one `canManage`. |
| `src/pages/project/ProjectInfoCard.tsx` | `canManageProjects` → `canEditProject` + `canDeleteProject`; edit and delete hover actions gate separately. |
| `src/pages/project/components/ProjectBasicDetails.tsx`, `ProjectDetailModal.tsx` | `canManage` → `canEdit` (it only ever drove the status dropdown, i.e. `PUT /projects/{id}`). |
| `src/pages/project/ProjectOverviewPage.tsx`, `ProjectTasksPage.tsx` | Pass the split flags to `ProjectInfoCard`; dropped the now-dead `RoleKey.Director` short-circuit from `canUploadProjectDocs` — `DOCUMENT_ALL_MANAGE` already covers Director, and the `_PROJECT_UPLOAD` codes are seeded explicitly for the other roles. |
| `src/pages/project/ProjectMilestonesPage.tsx`, `ProjectTasksPage.tsx` | Flags derived from `perm.canModule`: `canCreateMilestones`, `canEditMilestones`, `canDeleteMilestones`, `canCreateTasks`, `canEditTasks`, `canDeleteTasks`, `canCreateSubtasks`. |
| `src/pages/project/components/MilestonesPanel.tsx` | `canManage` → `canEdit` + `canDelete`; `canCreateMilestones` / `canCreateTasks` are now **required** props, so no caller can silently fall back to a manage-level flag. |
| `src/pages/project/components/MilestoneCard.tsx` | `canManage` → `canEdit` (it only ever guarded the edit hover action). |
| `src/pages/project/components/MilestoneDetailk.tsx`, `MilestoneDetailModal.tsx` | `isAdmin` → `canEdit` + `canDelete`. "Add Task" gates on `canCreateTasks`, not on edit. |
| `src/pages/project/ProjectDependenciesPage.tsx` | Replaced the `manage / create / edit / delete` OR-chain with `canEditDependencies` / `canDeleteDependencies`, matching `MilestonesController` — dependencies hang off `POST\|PUT\|DELETE /milestones/dependencies`, gated on `Milestones.Edit` / `Milestones.Delete`, **not** on `Milestones.Create`. |
| `src/pages/project/components/MilestoneDependencyPanel.tsx`, `DependenciesPanel.tsx` | `canManage` split into `canEdit` (New + row Edit) and `canDelete` (row Delete). |
| `src/pages/project/components/TaskSubtaskCard.tsx` | New `canCreateSubtask` gates "Add subtask" (`POST /subtasks`), separate from `canEdit`. |
| `src/pages/project/components/TaskFormModal.tsx` | `canAssignMilestone` was `role ∈ {SuperAdmin, Director} \|\| hasAny(task.manage, task.create, task.edit)` — i.e. a **create-only** grant got the assignee field. Now `isSuperAdmin \|\| canModule("assign", "task")`, matching `AuthorizationPolicies.TaskEditor`. |

### 2d. Backend: no scoped role could ever assign a task
Surfaced by §2c. `canAssignMilestone` had been hiding the assignee field from
Director / PM / DepartmentHead — correctly, because **the server rejected them
too**. This is a pre-existing backend bug, not a client one.

`PermissionCatalog.ManagePermissionCoverage` expands the *unscoped* `TaskManage`
to `[view, create, edit, delete, assign, comment_create, attachment_create]`,
but the **scoped** `TaskOwnManage` / `TaskAllManage` entries only covered
view/create/edit/delete. Every seeded role holds a scoped `TASK_*_MANAGE` and
none of them expands to a scoped assign, so `AuthorizationPolicies.TaskEditor`
— which matches the unscoped `TaskAssign` — rejected all of them.
`PermissionCatalog.GetScopedAliases` does not reduce `TASK_OWN_ASSIGN` to
`TASK_ASSIGN` either, so the scoped assign codes were unreachable through that
policy too. Net effect: nobody but SuperAdmin could assign a task.

| File | Change |
|---|---|
| `PMWDS.Application/Security/PermissionCatalog.cs` | `TaskOwnManage` / `TaskAllManage` now also cover the matching `*_ASSIGN`, `*_COMMENT_CREATE`, `*_ATTACHMENT_CREATE` codes, mirroring the unscoped `TaskManage` entry. |
| `PMWDS.API/Auth/PermissionPolicyRegistry.cs` | `AuthorizationPolicies.TaskEditor` and `.Manager` now list the scoped task/project/milestone/subtask codes alongside the unscoped ones, since `GetScopedAliases` never reduces a scoped code to its unscoped form. |

Client `PERMISSION_COVERAGE` was updated to match, so both sides agree.

**Verification.** Role × capability matrix over the six seeded permission sets
(90 assertions, all passing):

```
                         SuperAdmin  Director    PM      DeptHead  TeamMember  Viewer
  project.create    New Project (topbar/dashboard)      yes   yes   yes   yes   --    --
  project.edit      Edit project + status dropdown      yes   yes   yes   yes   --    --
  project.delete    Delete project                      yes   yes   yes   yes   --    --
  milestone.create  New milestone + panel '+'           yes   yes   yes   yes   --    --
  milestone.edit    Milestone edit/complete/status      yes   yes   yes   yes   --    --
  milestone.delete  Milestone delete                    yes   yes   yes   yes   --    --
  task.create       New task / Create first task        yes   yes   yes   yes   --    --
  task.edit         Task edit / progress / comments     yes   yes   yes   yes   yes   --
  task.delete       Task delete                         yes   yes   yes   yes   --    --
  subtask.create    Add subtask                         yes   yes   yes   yes   yes   --
  task.assign       TaskFormModal assignee field        yes   yes   yes   yes   --    --
  notification.manage Templates + Alert rules tabs      yes   yes   --    --    --    --
  user.manage       Users page write actions            yes   yes   --    yes   --    --
  role.manage       Roles page write actions            yes   yes   --    --    --    --
  system.manage     Settings page                       yes   --    --    --    --    --
```

`user.manage` is intentionally `yes` for DepartmentHead: they are seeded with
`USER_OWN_MANAGE`, so they manage users inside their own department, with
`RoleScopeService` applying the department scoping on top.

`tsc -b`, `vite build` and `dotnet build PMWDS.API` are all clean.

### 2e. Dependency rows showed "Unknown" for milestones in other departments
Logged in as TeamMember on a project spanning several departments: the
Dependencies tab showed 18 rows, most of them "Unknown → X" or "X → Unknown",
plus one "Unknown → Unknown".

**Why "Unknown".** `GET /milestones/by-project/{id}` filters milestones to the
caller's own departments, so milestones owned by another department are simply
absent from the client's `milestones` array. Both panels resolved names with
`milestones.find(...)?.name || "Unknown"`, and neither distinguished "not
visible to me" from "genuinely missing data".

**Behaviour now.**

| Ends | Before | After |
|---|---|---|
| both visible | `A → B` | `A → B` |
| prerequisite hidden | `Unknown → B` | `Other department → B` |
| dependent hidden | `A → Unknown` | `A → Other department` |
| **both** hidden | `Unknown → Unknown` | **row dropped** |

A row with at least one visible end is kept, because that end is the caller's
own milestone and the rule genuinely affects their work — they need to know they
are blocked by another team. A row where neither end is theirs says nothing
actionable, so it is hidden rather than rendered as
`Other department → Other department`.

Two supporting details:

- **Counts follow the visible set.** Total / Met / Blocking now describe what is
  on screen. When every row is hidden, the empty state says how many were
  withheld rather than claiming "No dependencies defined".
- **No fake `0% / 80%`.** For a `ProgressThreshold` rule whose prerequisite is
  out of scope, the panel renders `Progress threshold 80%` instead. The old code
  substituted `0` for the unreadable progress and printed `0% / 80%`, which is
  simply wrong — and the local "is this rule satisfied" computation is
  meaningless in that case. The server's `isMet` stays authoritative for the
  Met/Blocking chip.

| File | Change |
|---|---|
| `src/pages/project/dependencyVisibility.ts` | *(new)* `resolveDependencies(dependencies, milestones)` — resolves each end to a real milestone or `OTHER_DEPARTMENT_LABEL`, drops both-hidden rows, and exposes `canReadPrereqState` so callers stop inventing progress. |
| `src/pages/project/components/MilestoneDependencyPanel.tsx` | Uses the helper; new shared `DependencyEndLabel` renders the muted/italic placeholder; counts and empty state follow the visible set. |
| `src/pages/project/components/DependenciesPanel.tsx` | Same helper and label, so the compact panel on the Milestones tab matches the Dependencies tab. |

**Backend leak fixed.** The UI was only hiding the names — the API was still
returning them. `MilestoneDependencyDto.FromEntity` populated
`PrerequisiteMilestoneName` / `DependentMilestoneName` unconditionally, so a
TeamMember's network tab contained every hidden milestone's real name, which is
exactly what `GET /milestones/by-project` withholds.

| File | Change |
|---|---|
| `PMWDS.Application/DTOs/Projects/MilestoneDependencyDto.cs` | `FromEntity` takes optional `revealPrerequisiteName` / `revealDependentName`; names become `null` when not revealed. |
| `PMWDS.API/Controllers/MilestonesController.cs` | `GetDependenciesByProject` and `GetDependencyStatus` redact names for milestones outside the caller's scope, reusing the same `CanSeeFullProjectDetailsAsync` rule that drives `GetByProject`. The dependency row itself is still returned — the blocking relationship is not secret. |

**Verification.** 18 assertions over `resolveDependencies`, using the milestone
set and row shapes from the screenshot: both-hidden rows dropped, each one-hidden
case labelled correctly, visible-set counts, threshold maths for visible
prerequisites, `canReadPrereqState` false for hidden ones, a full-scope caller
keeping all 18 rows with real names, and empty-input cases. All pass.
`tsc -b`, `vite build` and `dotnet build PMWDS.API` are clean.

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

> Reworking these to be permission-driven is what surfaced the regression in
> §2b — the permission engine itself was granting every `*_MANAGE` to anyone
> holding the matching `*_VIEW`. The changes below are correct and stayed; the
> engine underneath them is what was fixed.

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
