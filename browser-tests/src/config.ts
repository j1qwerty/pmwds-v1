export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? "http://127.0.0.1:5175";

export const E2E_PASSWORD =
  process.env.E2E_PASSWORD ?? "";

export type TestUserId =
  | "superAdmin"
  | "director"
  | "projectManager"
  | "chiefEngineer"
  | "departmentHeadA"
  | "departmentHeadB"
  | "departmentHeadC"
  | "teamMemberA"
  | "teamMemberB"
  | "teamMemberC"
  | "viewer";

export type TestUser = {
  id: TestUserId;
  label: string;
  email: string;
  role: string;
  fullName: string;
  departmentCode?: string;
};

export const USERS: Record<TestUserId, TestUser> = {
  superAdmin: { id: "superAdmin", label: "SuperAdmin", email: "superadmin@org1.com", role: "SuperAdmin", fullName: "Aarav Sharma" },
  director: { id: "director", label: "Director / Admin", email: "admin@org1.com", role: "Director", fullName: "Priya Menon", departmentCode: "PWD" },
  projectManager: { id: "projectManager", label: "Project Manager", email: "manager@org1.com", role: "ProjectManager", fullName: "Dev Kapoor", departmentCode: "PWD" },
  chiefEngineer: { id: "chiefEngineer", label: "Chief Engineer", email: "rajesh.verma@pwd.up.gov.in", role: "ProjectManager", fullName: "Rajesh Verma", departmentCode: "PWD" },
  departmentHeadA: { id: "departmentHeadA", label: "Department Head A - Civil", email: "head.eng@org1.com", role: "DepartmentHead", fullName: "Rohan Iyer", departmentCode: "PWDC" },
  departmentHeadB: { id: "departmentHeadB", label: "Department Head B - PMO", email: "head.pmo@org1.com", role: "DepartmentHead", fullName: "Sita Rao", departmentCode: "PWD" },
  departmentHeadC: { id: "departmentHeadC", label: "Department Head C - Operations", email: "head.ops@org1.com", role: "DepartmentHead", fullName: "Vikram Singh", departmentCode: "PROC" },
  teamMemberA: { id: "teamMemberA", label: "Team Member A", email: "member@org1.com", role: "TeamMember", fullName: "Ananya Patel", departmentCode: "PWDC" },
  teamMemberB: { id: "teamMemberB", label: "Team Member B", email: "dinesh.kumar@pwd.up.gov.in", role: "TeamMember", fullName: "Dinesh Kumar", departmentCode: "PWDC" },
  teamMemberC: { id: "teamMemberC", label: "Team Member C", email: "manoj.tiwari@up.gov.in", role: "TeamMember", fullName: "Manoj Tiwari", departmentCode: "PROC" },
  viewer: { id: "viewer", label: "Viewer", email: "viewer@org1.com", role: "Viewer", fullName: "Sneha Kulkarni", departmentCode: "PWD" },
};

export const ROUTES = {
  login: "/login",
  dashboard: "/",
  projects: "/projects",
  departments: "/departmentsPage",
  users: "/users",
  roles: "/roles",
  notifications: "/notificationsPage",
  organizationStructure: "/organizationStructure",
  profiles: "/profiles",
  ai: "/ai",
  reports: "/reports",
  reportsView: "/reports/view",
  activityLogs: "/activity-logs",
  settings: "/settings",
} as const;

export function getUser(id: TestUserId): TestUser {
  return USERS[id];
}
