import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import type {
  AiReportResponse,
  Project,
  StoredReportRecord,
} from "../../types";
import {
  AnimatedBackground,
  LoadingPage,
  useNavHeader,
  OrganizationDepartmentFilter,
  PERMISSION_GROUPS,
  getProjectDepartmentIds,
  projectBelongsToDepartment,
  usePermission,
  useToast,
} from "../shared";
import { ReportFilters } from "./ReportFilters";
import { ReportGenerator } from "./ReportGenerator";
import { GeneratedReports } from "./GeneratedReports";
import { useReportGeneration } from "./ReportGenerationContext";

export function ReportsPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { data: appData } = useAppData();
  const perm = usePermission();
  const canViewOrganizations = perm.hasAny(PERMISSION_GROUPS.system.manage, PERMISSION_GROUPS.organization.view);
  const [projects, setProjects] = useState<Project[]>([]);
  const [storedReports, setStoredReports] = useState<StoredReportRecord[]>([]);
  const [storedReportsLoading, setStoredReportsLoading] = useState(true);
  const { generate, isGeneratingType, pendingReportType, generationError } = useReportGeneration();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    organizationId: "",
    projectId: "",
    departmentId: "",
    startDate: "",
    endDate: "",
    status: "",
  });

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({ title: "Reports", description: "Generate portfolio, workload, delay, and budget reports" });
  }, [setNavHeader]);

  useEffect(() => {
    if (!auth) return;
    let disposed = false;

    const load = async () => {
      setLoading(true);
      try {
        const projectData = await api.getProjects(auth.token);
        if (disposed) return;
        setProjects(projectData);
        setFilters((current) => ({
          ...current,
          projectId: current.projectId || projectData[0]?.id || "",
          departmentId: current.departmentId || appData.departments[0]?.id || "",
        }));
      } catch (cause) {
        if (!disposed) addToast(cause instanceof Error ? cause.message : "Failed to load reports", "error");
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [auth, appData.departments, addToast]);

  const loadStoredReports = useCallback(() => {
    if (!auth) return;
    setStoredReportsLoading(true);
    api.getStoredReports(auth.token)
      .then((reports) => setStoredReports(reports))
      .catch((cause) => {
        addToast(cause instanceof Error ? cause.message : "Failed to load generated reports", "error");
      })
      .finally(() => setStoredReportsLoading(false));
  }, [auth]);

  useEffect(() => {
    loadStoredReports();
  }, [loadStoredReports]);

  const departments = appData.departments;
  const organizations = appData.organizations;

  const visibleDepartments = useMemo(() => {
    return filters.organizationId
      ? departments.filter((department) => department.organizationId === filters.organizationId)
      : departments;
  }, [departments, filters.organizationId]);

  const visibleProjects = useMemo(() => {
    if (perm.isSuperAdmin) return projects;

    if (filters.departmentId) {
      return projects.filter((project) => projectBelongsToDepartment(project, filters.departmentId));
    }

    if (filters.organizationId) {
      const departmentIds = new Set(visibleDepartments.map((department) => department.id));
      return projects.filter((project) => getProjectDepartmentIds(project).some((departmentId) => departmentIds.has(departmentId)));
    }

    return projects;
  }, [filters.departmentId, filters.organizationId, projects, visibleDepartments, perm.isSuperAdmin]);

  useEffect(() => {
    if (filters.departmentId && !visibleDepartments.some((department) => department.id === filters.departmentId)) {
      setFilters((current) => ({ ...current, departmentId: "", projectId: "" }));
      return;
    }

    if (filters.projectId && !visibleProjects.some((project) => project.id === filters.projectId)) {
      setFilters((current) => ({ ...current, projectId: "" }));
    }
  }, [filters.departmentId, filters.projectId, visibleDepartments, visibleProjects]);

  const reportFilterPayload = () => ({
    projectId: filters.projectId || null,
    departmentId: filters.departmentId || null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    status: filters.status || null,
  });

  const handleGenerate = async (label: string, reportType: string, body: Record<string, unknown>) => {
    // The pending flag lives above the router, so this guard still holds if the
    // user navigated away and back while the request is running.
    if (isGeneratingType(reportType)) {
      addToast(`${label} report is already being generated.`, "error");
      return;
    }

    try {
      const { report, exportParams } = await generate(reportType, body, reportFilterPayload());
      navigate("/reports/view", { state: { report, exportParams } });
      loadStoredReports();
      addToast(`${label} report generated successfully.`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Generation failed", "error");
    }
  };

  const handleViewStoredReport = async (record: StoredReportRecord) => {
    if (!auth) return;
    try {
      const blob = await api.downloadStoredReport(auth.token, record.id);
      const text = await blob.text();
      const parsed = JSON.parse(text) as AiReportResponse;
      navigate("/reports/view", { state: { report: parsed, exportParams: reportFilterPayload() } });
    } catch {
      addToast("Could not load this report for viewing.", "error");
    }
  };

  const handleDownloadStoredReport = async (report: StoredReportRecord) => {
    if (!auth) return;
    try {
      const blob = await api.downloadStoredReport(auth.token, report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${report.name}.${report.format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Download failed"}`, "error");
    }
  };

  const handleDeleteStoredReport = async (id: string) => {
    if (!auth) return;
    try {
      await api.deleteStoredReport(auth.token, id);
      setStoredReports((prev) => prev.filter((r) => r.id !== id));
      addToast("Report deleted.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Delete failed"}`, "error");
    }
  };

  const handleGenerateProjectStatus = () => {
    if (!filters.projectId) {
      addToast("Select a project first.", "error");
      return;
    }
    handleGenerate("Project Status", "project-status", {
      projectId: filters.projectId,
    });
  };

  const handleGenerateBudgetVariance = () => {
    if (!filters.projectId) {
      addToast("Select a project first.", "error");
      return;
    }
    handleGenerate("Budget Variance", "budget-variance", {
      projectId: filters.projectId,
    });
  };

  const handleGenerateTaskCompletion = () => {
    handleGenerate("Task Completion", "task-completion", reportFilterPayload());
  };

  const handleGenerateDepartmentWorkload = () => {
    if (!filters.departmentId) {
      addToast("Select a department first.", "error");
      return;
    }
    handleGenerate("Department Workload", "department-workload", {
      departmentId: filters.departmentId,
      startDate: filters.startDate || new Date().toISOString(),
      endDate: filters.endDate || new Date().toISOString(),
    });
  };

  const handleGenerateDelayAnalysis = () => {
    handleGenerate("Delay Analysis", "delay-analysis", reportFilterPayload());
  };

  if (loading) return <LoadingPage label="Loading reports..." />;

  return (
    <div>
      <AnimatedBackground />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Filters & Report Generation */}
        <div className="flex flex-col gap-6">
          <ReportFilters
            filters={filters}
            projects={visibleProjects}
            onFilterChange={setFilters}
            scopeFields={
              <OrganizationDepartmentFilter
                variant="fields"
                searchPlaceholder="Search departments..."
                organizations={canViewOrganizations ? organizations : []}
                departments={departments}
                users={appData.users}
                selectedOrganizationId={filters.organizationId}
                selectedDepartmentId={filters.departmentId}
                onOrganizationChange={(organizationId) => setFilters((current) => ({
                  ...current,
                  organizationId,
                  departmentId: "",
                  projectId: "",
                }))}
                onDepartmentChange={(departmentId) => setFilters((current) => ({
                  ...current,
                  departmentId,
                  projectId: "",
                }))}
              />
            }
          />

          <ReportGenerator
            filters={filters}
            generatingReportType={pendingReportType}
            isGeneratingType={isGeneratingType}
            generationError={generationError}
            onGenerateProjectStatus={handleGenerateProjectStatus}
            onGenerateBudgetVariance={handleGenerateBudgetVariance}
            onGenerateTaskCompletion={handleGenerateTaskCompletion}
            onGenerateDepartmentWorkload={handleGenerateDepartmentWorkload}
            onGenerateDelayAnalysis={handleGenerateDelayAnalysis}
          />
        </div>

        {/* Right: Generated Reports */}
        <div className="lg:sticky lg:top-7 h-fit">
          <GeneratedReports
            reports={storedReports}
            loading={storedReportsLoading}
            onView={handleViewStoredReport}
            onDownload={handleDownloadStoredReport}
            onDelete={handleDeleteStoredReport}
          />
        </div>
      </div>

    </div>
  );
}
