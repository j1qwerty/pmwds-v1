import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { AppDataProvider, useAppData } from "./appData";
import { Layout } from "./layout";
import { ToastProvider } from "./pages/shared/Toast";
import { LoadingPage } from "./pages/shared";
import { NoAccessPage } from "./pages/shared/NoAccessPage";
import { RoutePermissionGuard } from "./pages/shared/PermissionControls";
import { PERMISSION_GROUPS, Permission } from "./permissions";

// Overview
import { DashboardPage } from "./pages/dashboard/dashboard";
import { NotificationsPage } from "./pages/notifications/NotificationsPage";

// Projects list + project workspace shell (Overview / Milestones / Tasks / Documents)
import { ProjectsListPage } from "./pages/project/ProjectsListPage";
import { ProjectDetailShell } from "./pages/project/ProjectDetailShell";

// Project-nested views
import { ProjectNotFound } from "./pages/project/ProjectNotFound";

// Team
import { OrganizationStructurePage } from "./pages/organisations/OrganizationStructurePage";
import { DepartmentsPage } from "./pages/departments/DepartmentsPage";
import { UsersPage } from "./pages/users/users";
import { ProfilesPage } from "./pages/profiles/ProfilesPage";
// Kept for when the Skills page is re-enabled (see SHOW_SKILLS_PAGE).
import { SkillsPage } from "./pages/skills/SkillsPage";
import { SHOW_SKILLS_PAGE } from "./featureFlags";

// Tools
import { AIPage as CoreAIPage } from "./pages/ai/ai";
import { ReportsPage as CoreReportsPage } from "./pages/reports/reports";
import { ReportViewPage } from "./pages/reports/ReportViewPage";
import { ReportGenerationProvider } from "./pages/reports/ReportGenerationContext";

// System
import { RolesPage } from "./pages/roles/RolesPage";
import { ActivityLogsPage } from ".//pages/activity/ActivityLogsPage";
import { SettingsPage } from "./pages/settings/settings";
import { LoginPage } from "./pages/login/login";
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
      <Route path="/login" element={auth ? <Navigate to="/" /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
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
