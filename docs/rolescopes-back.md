# RoleScope & Permission Integration Audit Report

> Generated: 2026-06-01
> Scope: All backend controllers + services in PMWDS.API

---

## 1. Architecture Overview

The authorization system has **3 layers** of access control:

| Layer | Mechanism | Location |
|-------|-----------|----------|
| **Authentication** | JWT Bearer tokens with role + permission claims | `Program.cs`, `AuthController` |
| **Policy Authorization** | `[Authorize(Policy = "...")]` attributes -> `PermissionAuthorizationHandler` | `PermissionPolicyRegistry.cs`, `PermissionAuthorizationHandler.cs` |
| **Data Scoping** | `RoleScopeService` restricts queried/visible entities per role | `RoleScopeService.cs` |

### Role Hierarchy (from `RoleScopeService`)

```
SuperAdmin   → full access, no scoping
Director     → sees all orgs in scope, manage orgs
DepartmentHead → sees own org/department users, manage own department
ProjectManager → manages assigned projects
TeamMember    → sees own data, works on assigned tasks
Viewer        → minimal access
```

---

## 2. Controllers – RoleScopeService Integration Check

### 2.1 AuthController
| File | RoleScopeService Injected? | Gaps |
|------|---------------------------|------|
| `AuthController.cs` | ❌ Not injected | **None** – Auth is identity-only, no data scoping needed. Login/Signup/Password-reset are `[AllowAnonymous]` by design ✓ |

### 2.2 UsersController
| File | RoleScopeService Injected? | Status |
|------|---------------------------|--------|
| `UsersController.cs` | ✅ Yes | **Has gaps** |

| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /` | ✅ `ScopeUsersAsync()`, `CanAccessDepartmentAsync()` | ✓ |
| `GET /{id}` | ✅ `CanAccessUserAsync()` | ✓ |
| `GET /me` | ✅ Self-only | ✓ |
| `PUT /{id}` | ✅ `CanManageUserAsync()`, `AreDepartmentsInScopeAsync()`, `IsOrganizationInScopeAsync()` | ✓ |
| `POST /register` | ✅ `AreDepartmentsInScopeAsync()`, `IsOrganizationInScopeAsync()` | ✓ |
| `PUT /{id}/departments` | ✅ `CanManageUserAsync()`, `AreDepartmentsInScopeAsync()` | ✓ |
| `POST /{id}/profile-picture` | ✅ `CanManageUserAsync()` (or self) | ✓ |
| **`PATCH /{id}/availability`** | ❌ **None** | **GAP-1**: Anyone can update any user's availability |
| **`POST /{id}/skills`** | ❌ **None** | **GAP-1**: Anyone can add skills to any user |
| **`PUT /{id}/skills/{skillId}`** | ❌ **None** | **GAP-1**: Anyone can update any user's skill proficiency |
| **`DELETE /{id}/skills/{skillId}`** | ❌ **None** | **GAP-1**: Anyone can remove any user's skills |
| `GET /available` | ✅ `ScopeUsersAsync()` | ✓ |
| `GET /workload` | ✅ `ScopeUsersAsync()`, `CanAccessDepartmentAsync()` | ✓ |
| `PATCH /{id}/deactivate` | ✅ `CanManageUserAsync()` | ✓ |
| `PATCH /{id}/reactivate` | ✅ `CanManageUserAsync()` | ✓ |

### 2.3 ProfilesController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /{userId}` | ✅ `CanAccessUserAsync()` | ✓ |
| `PUT /{userId}` | ✅ `CanManageUserAsync()` | ✓ |
| **All good** | | ✓ |

### 2.4 RolesController
| File | RoleScopeService Injected? | Status |
|------|---------------------------|--------|
| `RolesController.cs` | ❌ **Not injected** | **Appropriate** – Roles/Permissions are system-level, not data-scoped. Protected by `[Authorize(Policy = "SuperAdmin")]` for writes, `[Authorize(Policy = "Authenticated")]` for reads ✓ |

### 2.5 OrganizationsController
| File | RoleScopeService Injected? | Status |
|------|---------------------------|--------|
| `OrganizationsController.cs` | ✅ Yes | **Minor gap** |

| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /` | ✅ `GetOrganizationIdsAsync()` | ✓ |
| `GET /{id}` | ✅ `CanAccessOrganizationAsync()` | ✓ |
| `POST /` | ✅ `[Authorize(Policy = "SuperAdmin")]` | ✓ |
| `PUT /{id}` | ✅ `CanManageOrganizationAsync()` | ✓ |
| `DELETE /{id}` | ✅ `[Authorize(Policy = "SuperAdmin")]` | **GAP-10**: No check for related data (departments, projects, users) before delete. Cascade issues possible |
| `PUT /{id}/departments/{deptId}` | ✅ `[Authorize(Policy = "SuperAdmin")]` | ✓ |
| `DELETE /{id}/departments/{deptId}` | ✅ `[Authorize(Policy = "SuperAdmin")]` | ✓ |

### 2.6 DepartmentsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| **`GET /`** | ✅ `GetOrganizationIdsAsync()` | **GAP-11**: Fetches ALL departments then filters in-memory (`Where()` on in-memory list) instead of using IQueryable-based filtering |
| `GET /{id}` | ✅ `CanAccessDepartmentAsync()` | ✓ |
| `GET /{id}/dashboard` | ✅ `CanAccessDepartmentAsync()`, `ScopeUsersAsync()` | ✓ |
| `POST /` | ✅ Org-ID validation via `GetOrganizationIdsAsync()` + Director check | ✓ |
| `PUT /{id}` | ✅ `CanManageDepartmentAsync()` | ✓ |
| `DELETE /{id}` | ✅ `[Authorize(Policy = "SuperAdmin")]` | Consistent with SuperAdmin being all-powerful | ✓ |

### 2.7 ProjectsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| **`GET /dashboard`** | ❌ **None for null departmentId** | **GAP-2**: When `departmentId` is null, no scoping is applied – users see all-project dashboard data regardless of org scope |
| `GET /` | ✅ `ScopeProjectsAsync()`, `CanAccessDepartmentAsync()` | ✓ |
| `GET /{id}` | ✅ `CanAccessProjectAsync()` | ✓ |
| **`POST /`** | ⚠️ `CanAccessDepartmentAsync()` + `IsSuperAdmin/IsDirector` | **GAP-3**: Logic `!CanAccessDepartment() || !IsSuperAdmin && !IsDirector` means only SuperAdmin/Director can create projects. DepartmentHeads with `ProjectCreate` permission are denied |
| `PUT /{id}` | ✅ `CanManageProjectAsync()`, `CanAccessDepartmentAsync()` | ✓ |
| `PATCH /{id}/status` | ✅ `CanManageProjectAsync()` | ✓ |
| `GET /{id}/progress` | ✅ `CanAccessProjectAsync()` | ✓ |
| `GET /{id}/ai/health` | ✅ `CanAccessProjectAsync()` | ✓ |
| `GET /{id}/ai/insights` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /{id}/ai/optimize` | ✅ `CanManageProjectAsync()` | ✓ |
| Document endpoints | ✅ `CanAccessProjectAsync()` / `CanManageProjectAsync()` | ✓ |
| `DELETE /{id}` | ✅ `CanManageProjectAsync()` | ✓ |

### 2.8 MilestonesController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /by-project/{projectId}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `GET /{id}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /` | ✅ `CanManageProjectAsync()` | ✓ |
| `PUT /{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| `PATCH /{id}/complete` | ✅ `CanManageProjectAsync()` | ✓ |
| `PATCH /{id}/status` | ✅ `CanManageProjectAsync()` | ✓ |
| `DELETE /{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| **All good** | | ✓ |

### 2.9 TasksController (with Subtasks)
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /by-project/{projectId}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `GET /my-tasks` | ✅ `GetAccessibleProjectIdsAsync()` | ✓ |
| `GET /{id}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /` | ✅ `CanManageProjectAsync()` | ✓ |
| `PUT /{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| `PATCH /{id}/progress` | ✅ `CanWorkOnTaskAsync()` | ✓ |
| `PATCH /{id}/status` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /{id}/assign` | ✅ `CanManageProjectAsync()` | ✓ |
| `GET /{id}/ai/recommend-assignee` | ✅ `[Authorize(Policy = "Manager")]` | ✓ |
| `GET /{id}/ai/delay-prediction` | ✅ `CanAccessTaskAsync()` | ✓ |
| `POST /{id}/escalate` | ✅ `CanManageTaskAsync()` | ✓ |
| **`POST /{id}/comments`** | ⚠️ Only `CanAccessProjectAsync()` | **GAP-5**: Adding comments should require `CanManageProjectAsync()` |
| **`POST /{id}/attachments`** | ⚠️ Only `CanAccessProjectAsync()` | **GAP-5**: Uploading attachments should require `CanManageProjectAsync()` |
| **`POST /{id}/time/start`** | ⚠️ Only `CanAccessProjectAsync()` | **GAP-5**: Starting time tracking should require `CanManageProjectAsync()` |
| **`POST /{id}/time/stop`** | ⚠️ Only `CanAccessProjectAsync()` | **GAP-5**: Stopping time tracking should require `CanManageProjectAsync()` |
| `GET /overdue` | ✅ `GetAccessibleProjectIdsAsync()` | ✓ |
| `GET /escalated` | ✅ `GetAccessibleProjectIdsAsync()` | ✓ |
| `GET /unassigned` | ✅ `GetAccessibleProjectIdsAsync()` | ✓ |
| **`POST /{id}/subtasks`** | ⚠️ `CanWorkOnTaskAsync()` | **GAP-4**: Subtask `dto.ProjectId` is NOT validated against parent task's ProjectId – subtask could be created under a different project |
| `GET /{id}/subtasks` | ✅ `CanAccessProjectAsync()` | ✓ |
| `GET /subtasks/{id}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `PUT /subtasks/{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| `PATCH /subtasks/{id}/progress` | ✅ `CanWorkOnTaskAsync()` | ✓ |
| `PATCH /subtasks/{id}/status` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /subtasks/{id}/assign` | ✅ `CanManageTaskAsync()` | ✓ |
| `DELETE /subtasks/{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| `DELETE /{id}` | ✅ `CanManageProjectAsync()` | ✓ |
| `GET /{id}/dependencies` | ✅ `CanAccessProjectAsync()` | ✓ |
| **`POST /{id}/dependencies`** | ⚠️ Only `CanAccessProjectAsync()` | **GAP-6**: Creating dependencies should require `CanManageProjectAsync()` |
| **`PUT /dependencies/{depId}`** | ⚠️ Only `CanAccessTaskAsync()` (view-level) | **GAP-6**: Updating dependencies should require manage-level access |
| **`DELETE /dependencies/{depId}`** | ⚠️ Only `CanAccessTaskAsync()` (view-level) | **GAP-6**: Deleting dependencies should require manage-level access |

### 2.10 NotificationsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /` | ✅ Self-only (UserId filter) | ✓ |
| `GET /unread-count` | ✅ Self-only | ✓ |
| `PATCH /{id}/read` | ✅ Ownership check (`notification.UserId != _currentUser.UserId`) | ✓ |
| `PATCH /read-all` | ✅ Self-only | ✓ |
| `DELETE /{id}` | ✅ Ownership + `IsSuperAdmin` check | ✓ |
| `POST /broadcast` | ✅ `CanAccessDepartmentAsync()`, `ScopeUsersAsync()` | ✓ |
| Template/Rule CRUD | ✅ `[Authorize(Policy = "SuperAdmin")]` | ✓ |
| **All good** | | ✓ |

### 2.11 ActivityLogsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /` | ✅ Self-only | ✓ |
| `GET /user/{userId}` | ✅ `CanAccessUserAsync()` | ✓ |
| `GET /team` | ✅ `ScopeUsersAsync()` | ✓ |
| **`GET /all`** | ✅ `ScopeUsersAsync()` + `IsSuperAdmin`/`IsDirector` check | **GAP-12**: Redundant checks – `[Authorize(Policy = "Director")]` already ensures only Directors can access, but the code also checks `IsDirector` and `IsSuperAdmin` internally |
| `GET /project/{projectId}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /` | ✅ Self-only | ✓ |
| **All good** | | ✓ |

### 2.12 DashboardsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| All endpoints | ✅ Self-only (UserId filter) | ✓ **(No role scope needed – dashboards are personal)** |

### 2.13 ReportsController
| Endpoint | Scope Check | Issue |
|----------|-------------|-------|
| `GET /project-status/{projectId}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /task-completion` | ✅ `CanAccessReportFilterAsync()` | ✓ |
| `POST /department-workload` | ✅ `CanAccessDepartmentAsync()` | ✓ |
| `GET /budget-variance/{projectId}` | ✅ `CanAccessProjectAsync()` | ✓ |
| `POST /delay-analysis` | ✅ `CanAccessReportFilterAsync()` | ✓ |
| **`GET /stored`** | ❌ **None** | **GAP-7**: Returns ALL stored reports without scope filtering |
| **`GET /stored/{id}`** | ❌ **None** | **GAP-7**: Returns any stored report by ID without scope check |
| **`GET /stored/{id}/download`** | ❌ **None** | **GAP-7**: Downloads any stored report data without scope check |
| `POST /stored` | ✅ `[Authorize(Policy = "Manager")]` | ✓ (no data scope needed for create) |
| `PUT /stored/{id}` | ✅ `[Authorize(Policy = "Manager")]` | ✓ |
| `DELETE /stored/{id}` | ✅ `[Authorize(Policy = "Manager")]` | ✓ |
| Schedule endpoints | ✅ `[Authorize(Policy = "Manager")]` | ✓ |

---

## 3. RoleScopeService Analysis

### Test: `E:\saturday\PMWDS.S\PMWDS.API\Services\RoleScopeService.cs`

### 3.1 Role Detection
| Property | Mechanism | Issue |
|----------|-----------|-------|
| `IsSuperAdmin` | `_currentUser.IsInRole("SuperAdmin")` | ✅ JWT claim check |
| `IsDirector` | `_currentUser.IsInRole("Director")` | ✅ |
| `IsDepartmentHead` | `_currentUser.IsInRole("DepartmentHead")` | ✅ |
| `IsProjectManager` | `_currentUser.IsInRole("ProjectManager")` | ✅ |
| `IsTeamMember` | `_currentUser.IsInRole("TeamMember")` | ✅ |

### 3.2 Scope Snapshot Caching
The `ScopeSnapshot` is memoized per request (service is Scoped). Snapshot gathers all org/department IDs from:
- User's `OrganizationId` (direct assignment)
- User's primary department's organization
- User's `DepartmentId`
- All department assignments' organizations

**No issues found** – caching strategy is correct for Scoped lifetime ✓

### 3.3 Scoping Methods

| Method | SuperAdmin behavior | Non-SuperAdmin behavior | Issue |
|--------|---------------------|------------------------|-------|
| `ScopeOrganizationsAsync` | Returns query unchanged | Filters by `organizationIds` | ✅ |
| `ScopeDepartmentsAsync` | Returns query unchanged | Filters by `department.OrganizationId` | ✅ |
| `ScopeProjectsAsync` | Returns query unchanged | Filters by `project.Department.OrganizationId` | ⚠️ Requires `Include(p => p.Department)` or navigation property; silent N+1 if not included |
| `ScopeUsersAsync` | Returns query unchanged | Complex multi-condition filter (org + dept + assignments) | ✅ |
| CanAccessOrganization | Always true | Checks org ID in set | ✅ |
| CanAccessDepartment | Always true | Checks org ID via DB query | ✅ |
| CanAccessProject | Always true | Checks org ID via DB navigation | ✅ |
| CanAccessUser | Always true (or self) | Checks scoped user list, excludes SuperAdmins | ✅ |
| CanManageOrganization | Always true | Requires Director + org access | ✅ |
| CanManageDepartment | Always true | Director (org access) OR DepartmentHead (own dept) | ✅ |
| CanManageProject | Always true | ProjectManager (assigned) OR Director/DepartmentHead (org access) | ✅ |
| CanManageUser | Always true | Requires Director + user access | ✅ |

### 3.4 Missing Scoping Methods (GAP-8)

| Missing Method | Needed By |
|----------------|-----------|
| `ScopeMilestonesAsync(IQueryable<Milestone>, CancellationToken)` | MilestonesController (currently relies on project-level check, no query-level scoping) |
| `ScopeNotificationsAsync(IQueryable<Notification>, CancellationToken)` | NotificationsController (currently uses user-ID filter – OK for personal notifications) |
| `ScopeActivityLogsAsync(IQueryable<ActivityLog>, CancellationToken)` | ActivityLogsController (currently uses manual filtering) |
| `ScopeReportsAsync(IQueryable<Report>, CancellationToken)` | ReportsController (GAP-7 for stored reports) |

### 3.5 ScopeProjectsAsync Navigation Dependency
⚠️ `ScopeProjectsAsync` filters via `project.Department != null && project.Department.OrganizationId.HasValue`. This requires the caller to `.Include(p => p.Department)` on the query. The query in `ProjectsController.GetAll()` does include `.Include(p => p.Department)`, but if other callers forget, EF might throw or silently evaluate client-side.

---

## 4. Permission System Analysis

### 4.1 PermissionCodes defined vs used

| Permission Code | Defined In | Referenced In Policy | Notes |
|----------------|------------|---------------------|-------|
| `SYSTEM_ADMIN` | ✅ | ✅ `SuperAdmin`, `Director`, `Manager`, `TaskEditor`, all CRUD | ✓ |
| `SYSTEM_DATABASE_VIEW` | ✅ | ❌ **Never referenced** | 🔴 Unused constant |
| `ORGANIZATION_*` | ✅ | ✅ CRUD policies | ✓ |
| `DEPARTMENT_*` | ✅ | ✅ CRUD policies | ✓ |
| `PROJECT_*` | ✅ | ✅ CRUD policies | ✓ |
| `MILESTONE_*` | ✅ | ✅ CRUD policies | ✓ |
| `TASK_*` | ✅ | ✅ Policies `Manager`, `TaskEditor`, CRUD | ✓ |
| `SUBTASK_*` | ✅ | ✅ Policy `TaskEditor`, CRUD | ✓ |
| `USER_*` | ✅ | ✅ CRUD policies | ✓ |
| `ROLE_*` | ✅ | ✅ CRUD policies | ✓ |
| `PERMISSION_*` | ✅ | ✅ CRUD policies | ✓ |
| **`NOTIFICATION_*`** | ✅ | ❌ **Never referenced in any policy** | **GAP-9**: `NOTIFICATION_VIEW`, `NOTIFICATION_BROADCAST`, `NOTIFICATION_TEMPLATE_MANAGE`, `NOTIFICATION_RULE_MANAGE` defined but unused |
| `ACTIVITY_LOG_VIEW` | ✅ | ✅ Only in `Director` named policy | ✓ (but could be in CRUD) |
| `ACTIVITY_LOG_CREATE` | ✅ | ❌ **Never referenced** | 🔴 Unused constant |
| `REPORT_*` | ✅ | ✅ Only in `Manager` named policy | Report CRUD policies exist but not added to `PermissionPolicyRegistry` |
| `KNOWLEDGE_*` | ✅ | ✅ Only in `Manager` named policy | ✓ |
| `INTEGRATION_*` | ✅ | ❌ **Never referenced** | 🔴 Unused constants |
| `AI_*` | ✅ | ❌ **Never referenced** | 🔴 Unused constants |

### 4.2 Named Policies vs Granular CRUD Policies

The system mixes two patterns inconsistently:

```csharp
// Named policies (hardcoded permission sets)
[Authorize(Policy = "SuperAdmin")]   // requires SYSTEM_ADMIN
[Authorize(Policy = "Director")]     // requires SYSTEM_ADMIN | ORGANIZATION_VIEW | ORGANIZATION_EDIT | ACTIVITY_LOG_VIEW
[Authorize(Policy = "Manager")]      // requires SYSTEM_ADMIN | PROJECT_CREATE | PROJECT_EDIT | TASK_CREATE | TASK_EDIT | REPORT_CREATE | KNOWLEDGE_CREATE
[Authorize(Policy = "TaskEditor")]   // requires SYSTEM_ADMIN | TASK_CREATE | TASK_EDIT | TASK_ASSIGN | SUBTASK_CREATE | SUBTASK_EDIT

// Granular CRUD policies
[Authorize(Policy = "Organizations.View")]
[Authorize(Policy = "Projects.Create")]
[Authorize(Policy = "Tasks.Edit")]
```

**GAP-13**: The RolesController uses `[Authorize(Policy = "SuperAdmin")]` instead of `[Authorize(Policy = "Roles.Create")]`. If a permission code like `ROLE_CREATE` is added to a non-SuperAdmin role, it would still be denied because the controller checks `SuperAdmin` named policy.

### 4.3 Named Policy Coarseness

The `Manager` named policy's `RequireAny` logic means a user who has `REPORT_CREATE` but NOT `PROJECT_CREATE` would pass the "Manager" policy and gain access to project creation endpoints – because `RequireAny` only needs ONE match. This is by design per the `RequireAny` logic, but could allow unintended access.

---

## 5. Gap Summary Table

| # | Severity | Module | Location | Description |
|---|----------|--------|----------|-------------|
| **GAP-1** | 🔴 **High** | Users | `UpdateAvailability`, `AddSkill`, `UpdateSkill`, `RemoveSkill` | Mutating endpoints lack any scope check – any authenticated user can modify any user's availability and skills |
| **GAP-2** | 🔴 **High** | Projects | `GetDashboard()` | When `departmentId` is null, the dashboard shows all-project data without any role-scope filtering |
| **GAP-3** | 🟡 **Medium** | Projects | `Create()` | Logic restricts project creation to SuperAdmin/Director only; DepartmentHeads with `ProjectCreate` permission are denied |
| **GAP-4** | 🟡 **Medium** | Tasks/Subtasks | `CreateSubtask()` | Subtask's `ProjectId` from DTO is not validated against parent task's project – allows cross-project subtask creation |
| **GAP-5** | 🟡 **Medium** | Tasks | `AddComment`, `UploadAttachment`, `StartTimer`, `StopTimer` | Write/action operations require only view-level access (`CanAccessProjectAsync`) instead of manage-level (`CanManageProjectAsync`) |
| **GAP-6** | 🟡 **Medium** | Tasks/Dependencies | `CreateDependency`, `UpdateDependency`, `DeleteDependency` | Dependency CRUD operations require only view-level access instead of manage-level |
| **GAP-7** | 🟡 **Medium** | Reports | `GetStoredReports`, `GetStoredReport`, `DownloadStoredReport` | Stored report retrieval has no scope check – users can access any stored report |
| **GAP-8** | 🟡 **Medium** | RoleScopeService | Missing methods | No `ScopeMilestonesAsync`, `ScopeActivityLogsAsync`, `ScopeReportsAsync` IQueryable scoping methods |
| **GAP-9** | 🔵 **Low** | Permissions | `PermissionPolicyRegistry` | `NOTIFICATION_*`, `ACTIVITY_LOG_CREATE`, `REPORT_*` CRUD, `INTEGRATION_*`, `AI_*` permission codes are defined but never referenced in policies |
| **GAP-10** | 🔵 **Low** | Organizations | `Delete()` | No check for related data (departments, projects, users) before deleting an organization |
| **GAP-11** | 🔵 **Low** | Departments | `GetAll()` | Fetches ALL departments into memory then filters client-side instead of using IQueryable scoping |
| **GAP-12** | 🔵 **Low** | ActivityLogs | `GetAll()` | Redundant `IsSuperAdmin`/`IsDirector` check that duplicates the `[Authorize(Policy = "Director")]` attribute |
| **GAP-13** | 🔵 **Low** | Roles | `RolesController` | Uses `[Authorize(Policy = "SuperAdmin")]` instead of granular `Roles.Create`/`Roles.Edit`/`Roles.Delete` policies |

---

## 6. Service-Level Issues

### 6.1 `RoleScopeService.cs`

| Issue | Detail |
|-------|--------|
| **Navigation dependency in ScopeProjectsAsync** | Filters via `project.Department.OrganizationId` which requires `Include(p => p.Department)` on the query. Silent failure if not included |
| **No task-level scoping** | `ScopeTasksAsync()` doesn't exist. Tasks are scoped indirectly through project access, but query-level scoping is absent |
| **No milestone-level scoping** | Same as tasks |
| **CanManageUser too restrictive** | Only Directors (not DepartmentHeads) can manage users. This may be by design but limits department autonomy |

### 6.2 `PermissionAuthorizationHandler.cs`

| Issue | Detail |
|-------|--------|
| **Database fallback could be slow** | Falls back to DB query on every authorization check if JWT claims don't contain permission. Cache in `HttpContext.Items` helps per-request, but still hits DB on first check |
| **No cache invalidation** | If user's roles/permissions change mid-session, the cached permissions in JWT claims and HttpContext.Items are stale until token refresh |

### 6.3 `CurrentUserService.cs`

| Issue | Detail |
|-------|--------|
| **DepartmentId claim missing** | The `DepartmentId` claim is embedded in the JWT but may not be refreshed when user's department assignment changes | ⚠️ |
| **Role check is claim-based** | `IsInRole()` checks JWT claims which are only refreshed on token reissue | ⚠️ |

---

## 7. Recommendations

### High Priority
1. **GAP-1**: Add `CanManageUserAsync()` checks to `UpdateAvailability()`, `AddSkill()`, `UpdateSkill()`, `RemoveSkill()` in `UsersController.cs`
2. **GAP-2**: Apply `ScopeProjectsAsync()` to the dashboard query in `ProjectsController.GetDashboard()` when `departmentId` is null

### Medium Priority
3. **GAP-5**: Upgrade `AddComment`, `UploadAttachment`, `StartTimer`, `StopTimer` from `CanAccessProjectAsync()` to `CanManageProjectAsync()`
4. **GAP-6**: Upgrade dependency CRUD endpoints to use `CanManageProjectAsync()`
5. **GAP-7**: Add scope filtering to stored report endpoints in `ReportsController.cs`
6. **GAP-4**: Validate subtask's `ProjectId` matches parent task's project in `CreateSubtask()`
7. **GAP-3**: Reconsider project creation policy – allow DepartmentHeads with proper permissions

### Low Priority
8. **GAP-8**: Add missing `Scope*Async()` methods to `RoleScopeService` for Milestones, ActivityLogs, Reports
9. **GAP-9**: Wire up unused permission codes (`NOTIFICATION_*`, `INTEGRATION_*`, `AI_*`, `REPORT_*` CRUD) into `PermissionPolicyRegistry`
10. **GAP-11**: Refactor `DepartmentsController.GetAll()` to use IQueryable scoping instead of in-memory filtering
11. **GAP-13**: Standardize policy usage – use granular CRUD policies everywhere instead of mixing with named policies
 
---

## 8. Fixes Applied - 2026-06-01

Scope handled in this pass: Auth, Users, Profiles, Roles/Permissions, Organizations, Departments, Projects, Milestones, Tasks and Subtasks, Notifications, Activity Logs.

### Issues Fixed

1. Duplicate permission aliases were removed from seed creation for the scoped modules.
   - Replaced dotted legacy aliases such as `USERS.PROFILE_PICTURE.MANAGE`, `USERS.DEPARTMENTS.MANAGE`, `SYSTEM.ADMIN`, `SYSTEM.DATABASE.VIEW`, `PROJECTS.MANAGE`, `TASKS.MANAGE`, `ORGS.MANAGE`, `ROLES.MANAGE`, and `ACTIVITY_LOGS.VIEW` with canonical codes such as `USER_PROFILE_PICTURE_MANAGE`, `USER_DEPARTMENT_MANAGE`, `SYSTEM_ADMIN`, `SYSTEM_DATABASE_VIEW`, `PROJECT_MANAGE`, `TASK_MANAGE`, `ORGANIZATION_MANAGE`, `ROLE_MANAGE`, and `ACTIVITY_LOG_VIEW`.
   - Added seed cleanup that migrates existing role assignments from legacy permissions to canonical permissions and deletes the legacy duplicate permission rows.

2. Module-level manage permissions were normalized.
   - Added canonical manage permissions for Authentication, Organizations, Departments, Projects, Milestones, Tasks, Subtasks, Users, Roles, Permissions, Notifications, and Activity Logs.
   - Updated policies so each module's `*.Manage` permission implies that module's CRUD/action permissions.
   - Updated seeded non-SuperAdmin roles so a role with a module manage permission no longer also stores all covered scoped permissions.

3. Roles and permissions API output was restricted to the required modules.
   - `RolesController.GetPermissions()` now returns only Authentication, Authorization, System, Organization, Departments, Projects, Milestones, Tasks, Subtasks, Users, Notifications, and Audit permissions.
   - Role responses suppress scoped permissions already covered by a selected module manage permission.
   - Role create/update normalizes submitted permission IDs so covered scoped permissions are not saved when the module manage permission is present.
   - Role and permission write endpoints now use granular `Roles.*` and `Permissions.*` policies.

4. Pages API output was restricted to the required modules.
   - `PagesController` now returns empty pages for Skills, Reports, Integrations, KnowledgeArticles, and LessonsLearned.
   - Roles and permissions inside the pages payload are filtered to the required permission modules.
   - Pages permission checks now recognize module manage permissions as covering their scoped permissions.

5. User mutation scope gaps were fixed.
   - `PATCH /users/{id}/availability`, `POST /users/{id}/skills`, `PUT /users/{id}/skills/{skillId}`, and `DELETE /users/{id}/skills/{skillId}` now allow self-service or require `CanManageUserAsync()` for other users.

6. Project scope gaps were fixed.
   - `GET /projects/dashboard` now scopes all dashboard totals and project lists through `RoleScopeService`, including when no department filter is supplied.
   - `POST /projects` no longer hard-denies scoped non-Director managers after the policy passes; it validates department scope and project-manager organization membership.

7. Task and subtask gaps were fixed.
   - Comments, attachments, timer start, and timer stop now require project manage access.
   - Dependency create/update/delete now require manage-level access to the involved tasks/projects.
   - Subtask creation now rejects a `ProjectId` that does not match the parent task's project.

8. Department list scoping was fixed.
   - `DepartmentsController.GetAll()` now applies `ScopeDepartmentsAsync()` to an EF query before pagination instead of loading all departments and filtering in memory.

