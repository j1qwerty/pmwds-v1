import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { AppDataProvider, useAppData } from "./appData";
import { Layout } from "./layout";
import { ToastProvider } from "./pages/shared/Toast";
import { LoadingPage } from "./pages/shared";
import { PageSkeleton } from "./pages/shared/Skeleton";
import { NoAccessPage } from "./pages/shared/NoAccessPage";
import { RoutePermissionGuard } from "./pages/shared/PermissionControls";
import { PERMISSION_GROUPS, Permission } from "./permissions";
import { lazyPage, whenIdle } from "./lib/lazyPage";
import { registerRoutePreload } from "./lib/routePreload";

// Overview

// Projects list + project workspace shell (Overview / Milestones / Tasks / Documents)

// Project-nested views
import { ProjectNotFound } from "./pages/project/ProjectNotFound";

// Team
// Kept for when the Skills page is re-enabled (see SHOW_SKILLS_PAGE).
import { SHOW_SKILLS_PAGE } from "./featureFlags";

// Tools
import { ReportGenerationProvider } from "./pages/reports/ReportGenerationContext";

// System
// Route-level code splitting: each page is its own chunk, fetched on demand and
// warmed on nav hover / browser idle (see routePreload + whenIdle below).
const DashboardPage = lazyPage(() => import("./pages/dashboard/dashboard").then((m) => ({ default: m.DashboardPage })));
const NotificationsPage = lazyPage(() => import("./pages/notifications/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const ProjectsListPage = lazyPage(() => import("./pages/project/ProjectsListPage").then((m) => ({ default: m.ProjectsListPage })));
const ProjectDetailShell = lazyPage(() => import("./pages/project/ProjectDetailShell").then((m) => ({ default: m.ProjectDetailShell })));
const OrganizationStructurePage = lazyPage(() => import("./pages/organisations/OrganizationStructurePage").then((m) => ({ default: m.OrganizationStructurePage })));
const DepartmentsPage = lazyPage(() => import("./pages/departments/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const UsersPage = lazyPage(() => import("./pages/users/users").then((m) => ({ default: m.UsersPage })));
const ProfilesPage = lazyPage(() => import("./pages/profiles/ProfilesPage").then((m) => ({ default: m.ProfilesPage })));
const SkillsPage = lazyPage(() => import("./pages/skills/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const RolesPage = lazyPage(() => import("./pages/roles/RolesPage").then((m) => ({ default: m.RolesPage })));
const ActivityLogsPage = lazyPage(() => import(".//pages/activity/ActivityLogsPage").then((m) => ({ default: m.ActivityLogsPage })));
const SettingsPage = lazyPage(() => import("./pages/settings/settings").then((m) => ({ default: m.SettingsPage })));
const LoginPage = lazyPage(() => import("./pages/login/login").then((m) => ({ default: m.LoginPage })));
const ReportViewPage = lazyPage(() => import("./pages/reports/ReportViewPage").then((m) => ({ default: m.ReportViewPage })));
const CoreAIPage = lazyPage(() => import("./pages/ai/ai").then((m) => ({ default: m.AIPage })));
const CoreReportsPage = lazyPage(() => import("./pages/reports/reports").then((m) => ({ default: m.ReportsPage })));

registerRoutePreload("/", DashboardPage.preload);
registerRoutePreload("/notificationsPage", NotificationsPage.preload);
registerRoutePreload("/projects", ProjectsListPage.preload);
registerRoutePreload("/organizationStructure", OrganizationStructurePage.preload);
registerRoutePreload("/departmentsPage", DepartmentsPage.preload);
registerRoutePreload("/users", UsersPage.preload);
registerRoutePreload("/profiles", ProfilesPage.preload);
registerRoutePreload("/skills", SkillsPage.preload);
registerRoutePreload("/roles", RolesPage.preload);
registerRoutePreload("/activity-logs", ActivityLogsPage.preload);
registerRoutePreload("/settings", SettingsPage.preload);
registerRoutePreload("/reports/view", ReportViewPage.preload);
registerRoutePreload("/ai", CoreAIPage.preload);
registerRoutePreload("/reports", CoreReportsPage.preload);

// After first paint, quietly warm the most-visited routes.
whenIdle(() => {
  DashboardPage.preload();
  ProjectsListPage.preload();
  ProjectDetailShell.preload();
});

function RouteFallback() {
  return (
    <div className="p-7" aria-busy="true">
      <PageSkeleton />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const { initialized, loading } = useAppData();

  if (!auth) return <Navigate to="/login" />;
  if (!initialized && loading) return <LoadingPage label="Loading workspace permissions..." />;
  return <>{children}</>;
}

const ROUTE_GUARDS = {
  project: PERMISSION_GROUPS.project.view,
  notificationsPage: PERMISSION_GROUPS.notification.view,
  organizationStructure: PERMISSION_GROUPS.organization.view,
  departmentsPage: PERMISSION_GROUPS.department.view,
  users: PERMISSION_GROUPS.user.view,
  profiles: PERMISSION_GROUPS.user.view,
  skills: PERMISSION_GROUPS.user.edit,
  reports: PERMISSION_GROUPS.report.view,
  ai: PERMISSION_GROUPS.ai.view,
  roles: PERMISSION_GROUPS.role.view,
  activityLogs: PERMISSION_GROUPS.activityLog.view,
  settings: Permission.SystemAdmin,
} as const;

function Guarded({ permission, children }: { permission?: string; children: React.ReactNode }) {
  return (
    <RoutePermissionGuard permission={permission} fallback={<NoAccessPage />}>
      {children}
    </RoutePermissionGuard>
  );
}

function AppRoutes() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate to="/" /> : <Suspense fallback={<RouteFallback />}><LoginPage /></Suspense>} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Overview */}
                <Route path="/" element={<DashboardPage />} />
                {/* Projects list + project workspace shell (tabs) */}
                <Route
                  path="/projects"
                  element={<Guarded permission={ROUTE_GUARDS.project}><ProjectsListPage /></Guarded>}
                />
                <Route
                  path="/projects/:projectId"
                  element={<Guarded permission={ROUTE_GUARDS.project}><ProjectDetailShell /></Guarded>}
                />
                <Route
                  path="/projects/:projectId/:tab"
                  element={<Guarded permission={ROUTE_GUARDS.project}><ProjectDetailShell /></Guarded>}
                />
                <Route
                  path="/notificationsPage"
                  element={<Guarded permission={ROUTE_GUARDS.notificationsPage}><NotificationsPage /></Guarded>}
                />

                {/* Project-nested deep links. Dependencies is served by the tab
                    shell above; a static path here would outrank /:tab in
                    React Router's ranking and bypass the tabs. */}
                <Route path="/projects/:projectId/*" element={<ProjectNotFound />} />

                {/* Team */}
                <Route
                  path="/organizationStructure"
                  element={<Guarded permission={ROUTE_GUARDS.organizationStructure}><OrganizationStructurePage /></Guarded>}
                />
                <Route
                  path="/departmentsPage"
                  element={<Guarded permission={ROUTE_GUARDS.departmentsPage}><DepartmentsPage /></Guarded>}
                />
                <Route
                  path="/users"
                  element={<Guarded permission={ROUTE_GUARDS.users}><UsersPage /></Guarded>}
                />
                <Route path="/profiles" element={<Guarded permission={ROUTE_GUARDS.profiles}><ProfilesPage /></Guarded>} />
                {/* Skills page is temporarily hidden for all roles - see SHOW_SKILLS_PAGE.
                    Removing the route falls through to the "*" NoAccessPage route. */}
                {SHOW_SKILLS_PAGE && (
                  <Route path="/skills" element={<Guarded permission={ROUTE_GUARDS.skills}><SkillsPage /></Guarded>} />
                )}

                {/* Tools (open to all authenticated users) */}
                <Route path="/ai" element={<Guarded permission={ROUTE_GUARDS.ai}><CoreAIPage /></Guarded>} />
                <Route path="/reports" element={<Guarded permission={ROUTE_GUARDS.reports}><CoreReportsPage /></Guarded>} />
                <Route path="/reports/view" element={<Guarded permission={ROUTE_GUARDS.reports}><ReportViewPage /></Guarded>} />

                {/* System */}
                <Route
                  path="/roles"
                  element={<Guarded permission={ROUTE_GUARDS.roles}><RolesPage /></Guarded>}
                />
                <Route
                  path="/activity-logs"
                  element={<Guarded permission={ROUTE_GUARDS.activityLogs}><ActivityLogsPage /></Guarded>}
                />
                <Route
                  path="/settings"
                  element={<Guarded permission={ROUTE_GUARDS.settings}><SettingsPage /></Guarded>}
                />

                <Route path="*" element={<NoAccessPage />} />
              </Routes>
              </Suspense>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppDataProvider>
          <ToastProvider>
            {/* Holds in-flight report generation above the router so the
                "Generating..." state survives navigation. */}
            <ReportGenerationProvider>
              <AppRoutes />
            </ReportGenerationProvider>
          </ToastProvider>
        </AppDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
