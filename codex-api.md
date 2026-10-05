# PMWDS API / Backend Audit

> Audit date: 2026-10-03
> Base reviewed: `main` at `f90909c618bbcbc3e2a2b6ae3fb579f82828942c`
> Focus: domain correctness, workflow logic, authorization/data isolation, persistence, jobs, performance and API consistency.
>
> This is a source-level audit of the repository. Runtime verification should be performed after each implementation PR with the existing integration suite and a role-by-role workflow run.

## Severity

- **High** — security/data-integrity/business-rule failure, missing core workflow, or behaviour that can produce materially wrong records/results.
- **Medium** — important correctness, reliability, maintainability or performance issue that should be fixed before production hardening.
- **Low** — cleanup, consistency, optimization or developer-experience improvement.

---

# High

## H1. The required Project → Goal → Milestone → Task → Subtask hierarchy is incomplete

**Evidence:** no Goal entity, Goal DTO/commands, Goal repository/configuration, Goal permissions or Goal controller were found. Current persistence/domain flows attach milestones directly to projects.

**Impact:** a core PMWDS business concept is missing from the backend model, so goal assignment, goal transfers/acknowledgement, goal due dates, goal documents, goal budgets and goal-level reporting cannot be enforced as first-class rules.

**Fix:** introduce a real Goal aggregate/child model and permissions. Move the hierarchy to:

`Project → Goal → Milestone → Task → Subtask`

Milestones should reference GoalId rather than bypassing it. Add API contracts, migrations, scoping and tests before moving UI flows.

---

## H2. The budget lifecycle is not represented as a real workflow

The current Project model exposes `PlannedBudget` and `ActualCost`, but there is no complete domain model for:

- goal allocations as separate records;
- released vs unreleased amounts;
- tranche/release conditions;
- pending / withheld / rejected / cancelled states;
- partial release approvals;
- expenditure/invoice ledger;
- immutable amendments;
- department requests with justification/supporting evidence.

**Impact:** budget values can be stored/displayed, but the intended allocation/release/accountability process cannot be reconciled or audited reliably.

**Fix:** introduce typed budget aggregates/ledger tables. Keep project reserve separate from allocated goal amounts and actual expenditure. Make every adjustment append-only/auditable.

---

## H3. Stored report data is not scope-protected

In `PMWDS.API/Controllers/ReportsController.cs`:

- `GET /reports/stored`
- `GET /reports/stored/{id}`
- `GET /reports/stored/{id}/download`

do not enforce owner/resource scope.

Update/delete also only use the broad Manager policy and do not verify that the caller owns or can manage the report's underlying project/department.

**Impact:** an authenticated manager can potentially read, download, edit or delete a stored report belonging to another scope.

**Fix:** give stored reports explicit `ProjectId` / `DepartmentId` resource metadata plus creator/owner semantics, and centralize `CanAccessReportAsync` / `CanManageReportAsync`. Apply it to every read/write/download/schedule operation.

---

## H4. Report schedules are CRUD records, but their execution semantics are disconnected from the configured schedules

`ReportSchedule` stores frequency, next run, recipients and delivery options. The Hangfire `ScheduledReportJob`, however, loops ProjectManager users and sends a hard-coded weekly PDF for their projects. It does not load active `ReportSchedule` records and execute them according to their stored settings.

**Impact:** the schedule UI/API can claim a schedule exists while the configured frequency, recipients and delivery options are not what actually run.

**Fix:** make `ScheduledReportJob` process due active schedule records, claim/lock each job safely, generate the requested report type/format, deliver to the stored recipients, update LastRun/NextRun, and record failures/retries.

---

## H5. Task assignment history can leave previously assigned users with write access

`TaskAssignment` supports `IsActive` and `Release()`, but the reassignment path adds a new assignment without releasing the previous active assignment. More importantly, `TaskWorkflowService.CanWorkOnTaskAsync` checks whether the user exists in `Assignments` but does not require `IsActive`.

**Impact:** a user who was removed from a task can remain authorized to update task progress/status/comments/attachments depending on the endpoint.

**Fix:** on reassignment, release all previous active assignments except the intended set. Every work authorization query must require `IsActive`. Add tests for reassignment -> old user forbidden -> new user allowed.

---

## H6. Task-to-milestone/project referential integrity is incomplete

`CreateTaskCommandHandler` and task update paths accept `MilestoneId` without enforcing that the milestone belongs to the same project. The command layer also does not validate `ParentTaskId` ownership/project consistency.

**Impact:** malformed records can attach work to a milestone from another project, producing incorrect rollups and cross-project data relationships.

**Fix:** validate parent task and milestone existence + project identity in the application/domain workflow, not only in controllers. Reject mismatched combinations with a validation/conflict response.

---

## H7. Task dependency graph rules are incomplete

`TaskDependency.Create` only rejects self-dependency. The API currently does not guarantee:

- predecessor and successor belong to the same project;
- duplicate dependencies are rejected;
- longer dependency cycles are rejected (A→B→C→A);
- lag values are within a defined range.

**Impact:** cyclic or cross-project graphs can be created even though downstream progress/blocking logic assumes a coherent project-local dependency graph.

**Fix:** create a dependency domain service that validates project equality, duplicates and cycle reachability in one transaction. Add database uniqueness for the logical edge.

---

## H8. Project status justification is not persisted by the status command

`UpdateProjectStatusCommandHandler` accepts `Justification`, but `Project.UpdateStatus` ignores it. The handler only places the justification in audit metadata. `PutOnHold(string justification)` exists but is not used by this path.

**Impact:** the UI can collect a delay/on-hold reason that is not stored as the project's current justification.

**Fix:** persist/clear justification as part of the domain status transition, with explicit rules for which states require it.

---

## H9. Project deletion soft-deletes the project but leaves milestone rows attached

The project-to-milestone foreign key uses `DeleteBehavior.NoAction`, while project deletion is handled through the soft-delete model. Existing tests/docs already flag that deleting a project leaves milestones undeleted.

**Impact:** orphaned visible-to-database child rows remain attached to a hidden project. This makes recovery/reporting and future migration work harder.

**Fix:** define an explicit aggregate soft-delete operation that recursively marks project-owned milestones/documents/tasks and other descendants as deleted, with restore semantics where required. Do not rely on SQL cascade for a soft-delete workflow.

---

## H10. Permission semantics are inconsistent with the advertised dynamic permission model

`PermissionPolicyRegistry.Manager` and `Director` are broad `RequireAny` policies. Several controllers use these named policies even though granular permissions exist.

Example: a user with an otherwise unrelated permission included in the Manager policy can satisfy the Manager policy, while a user granted a granular permission may still fail later because `RoleScopeService` also relies on hard-coded role keys such as Director / DepartmentHead / ProjectManager.

**Impact:** visible permission assignment, API authorization and actual resource-scope rules can disagree.

**Fix:** use one model consistently:
1. granular permission for the action;
2. resource scope service for the target;
3. explicit capability checks for delegated assignment.
Keep role keys only for genuinely role-specific semantics.

---

## H11. Critical invariants live in controllers instead of one application boundary

Several checks are controller-specific (project/department scope, task relationships, assignee organization). MediatR handlers themselves can construct or mutate entities without all of those invariants.

**Impact:** future endpoints, background jobs or internal callers can accidentally bypass rules.

**Fix:** move business invariants into application services/domain policies invoked by every write path. Controllers should translate HTTP input and call the same workflow.

---

# Medium

## M1. Multi-step write operations are not consistently transactional

Examples include task progress, task reassignment, project/task update + rollup, audit logging, notification and realtime publication. Multiple `SaveChangesAsync` calls appear in a single logical operation.

**Risk:** a later step can fail after earlier data has committed.

**Fix:** transaction around the atomic database changes; publish audit/realtime through an outbox after commit.

---

## M2. Notifications/realtime are coupled to already-committed mutations

Many endpoints save first, then send notifications. If notification fails, the request can still return an error even though the mutation is committed.

**Fix:** transactional outbox + background delivery, while preserving current SignalR as the fast UI hint channel.

---

## M3. AI enrichment on create is synchronous

Task creation persists the task, then immediately invokes delay prediction and performs a second write.

**Risk:** AI latency/failure makes a successful task creation look failed and increases API latency.

**Fix:** create the task synchronously, queue AI enrichment, store prediction status, and let the UI refresh when the result is available.

---

## M4. Background jobs repeatedly load large datasets into memory

Deadline/escalation jobs use repository methods that load broad task collections and then filter in memory. Escalation can call AI once per task.

**Fix:** push all filters into SQL, page/batch large workloads, and process incrementally. Avoid running expensive AI for tasks that cannot possibly need escalation.

---

## M5. Stored-report permissions and resource identity need typed API contracts

`Report.ParametersJson` is free-form JSON. Resource scope should not depend on convention-based parsing of arbitrary parameters.

**Fix:** add typed `ProjectId`, `DepartmentId`, report visibility/owner metadata and a stable report type enum.

---

## M6. Optimistic concurrency is configured but not surfaced cleanly

`RowVersion` is configured as a concurrency token, but there is no dedicated conflict response path in the exception middleware.

**Fix:** convert EF concurrency failures to HTTP 409 with a stable error code and refresh/retry guidance for the client.

---

## M7. RoleScopeService is still coupled to built-in role keys

The project advertises dynamic roles and permissions, but resource-management semantics still branch on hard-coded role keys.

**Fix:** model scope/capabilities explicitly (for example: can-manage-own-department, can-manage-assigned-project, can-work-assigned-task) and evaluate them from permissions + scope, with built-in roles simply providing defaults.

---

## M8. Pagination is inconsistent

Some list APIs are paginated; other controllers/repositories and many client calls intentionally request `pageSize: 500` or return all rows.

**Fix:** make pagination the default for all collection endpoints, expose totals, and implement server-side search/filter/sort consistently.

---

## M9. Large entity graphs are loaded for screens that only need summaries

Several repository queries include tasks/comments/attachments/time entries/assignments together.

**Fix:** separate list DTO projections from detail queries; fetch expensive child graphs only when a detail view needs them.

---

## M10. Rate limiting is in-memory even though Redis is available for the app

The API uses `AddInMemoryRateLimiting()`. This makes limits local to one process and not shared across multiple API instances.

**Fix:** use a distributed rate-limit store for multi-instance deployments and keep a safe in-memory fallback for local development.

---

# Low

## L1. Unused/partially wired permission constants

The codebase contains permissions whose actual controller usage is inconsistent or indirect. Maintain a permission-to-endpoint matrix generated from the source.

## L2. Multiple API authorization styles

Named policies, CRUD policies and manual checks coexist. Consolidate into predictable endpoint conventions.

## L3. Repeated controller helper logic

Project/dept/user scope validation is repeated in several controllers. Centralize reusable resource authorization helpers.

## L4. Error responses should be consistently typed

Some endpoints return strings/anonymous objects while the global envelope uses `ApiResponse`. Keep one error contract for all API paths.

## L5. API surface cleanup

Remove redundant Swagger/Scalar package usage if Swagger is intentionally not exposed, and remove dead/redundant DTOs/endpoints after consumers are migrated.

---

# Parallel work

These tracks can be implemented independently after the audit PR:

| Track | Can run in parallel with | Main dependencies |
|---|---|---|
| Goal + hierarchy model | Modal/UI cleanup, API contract cleanup | Highest backend dependency |
| Budget workflow | UI modal work, realtime work | Goal model should be settled first |
| Task authorization/integrity | UI modal work, report work | Independent |
| Report scope + schedule execution | Task work, UI cleanup | Typed Report scope first |
| Transactions/outbox/concurrency | UI work | Can follow core workflow fixes |
| Pagination/query optimization | UI cleanup | API contract changes may affect client |
| Permission-policy consolidation | Task/report work | Coordinate with resource-scope changes |
| UI modal system | All backend tracks | Use stable API contracts where possible |
| UI data/loading/error logic | Modal system, backend work | API response/error shape should remain stable |

# Recommended implementation order

1. **Security/data integrity first:** H5, H6, H7, H8, H9, H10/H11.
2. **Core product model:** H1 and H2.
3. **Reports and scheduled execution:** H3/H4.
4. **Reliability/performance:** M1-M10.
5. **UI consistency and interaction polish:** tracked separately in `codex-ui.md`.

# Verification required for backend fixes

Run the existing `PMWDS.Tests` suite plus explicit role flows for:

- SuperAdmin, Admin/Director, DepartmentHead, ProjectManager, TeamMember and Viewer.
- Project → Goal → Milestone → Task → Subtask creation and cross-scope rejection.
- Task reassignment and old-assignee authorization removal.
- Dependency duplicate/cycle/cross-project rejection.
- Project status justification persistence.
- Stored report owner/scope isolation and download authorization.
- Scheduled report configuration actually driving execution.
- Project deletion and descendant soft-delete behaviour.
- Concurrent edit -> HTTP 409 behaviour.
