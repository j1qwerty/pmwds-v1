import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import type { Department } from "../../types";
import { lakhsToRupees } from "../../lib/formatters";
import {
  GlassCard,
  useToast,
  LoadingPage,
  usePermission,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { Permission, RoleKey, hasRoleKey } from "../../permissions";
import { useUserOrganization } from "../shared/useUserOrganization";
import { ProjectDetailsStep } from "./steps/ProjectDetailsStep";
import { DepartmentsStep } from "./steps/DepartmentsStep";
import { MilestonesStep } from "./steps/MilestonesStep";
import { MilestoneDepartmentsStep } from "./steps/MilestoneDepartmentsStep";
import { DependenciesStep } from "./steps/DependenciesStep";
import { TasksStep } from "./steps/TasksStep";
import { UsersStep } from "./steps/UsersStep";

interface MilestoneEntry {
  id: string;
  departmentId?: string;
  name: string;
  description: string;
  dueDate: string;
  isCritical: boolean;
}

interface DependencyEntry {
  id: string;
  prerequisiteMilestoneId: string;
  dependentMilestoneId: string;
  type: "CompletionBased" | "ProgressThreshold";
  thresholdPercentage: number;
}

interface TaskEntry {
  id: string;
  title: string;
  description: string;
  priority: string;
  milestoneId: string;
  assignedToUserIds: string[];
  estimatedHours: number;
  startDate: string;
  dueDate: string;
}

interface StepConfig {
  key: string;
  label: string;
  icon: string;
}

interface ProjectWizardDraft {
  version: 1;
  savedAt: string;
  lastCreatedAt?: string;
  lastCreatedProjectId?: string;
  currentStep: number;
  name: string;
  description: string;
  priority: string;
  budget: number;
  startDate: string;
  endDate: string;
  primaryDepartmentId: string;
  selectedDepartmentIds: string[];
  milestones: MilestoneEntry[];
  dependencies: DependencyEntry[];
  tasks: TaskEntry[];
}

// Shared four-step flow for every role allowed to create projects.
const PROJECT_WIZARD_STEPS: StepConfig[] = [
  { key: "details", label: "Project Details", icon: "folder" },
  { key: "milestones", label: "Milestones", icon: "flag" },
  { key: "milestoneDepartments", label: "Assign Departments", icon: "account_tree" },
  { key: "dependencies", label: "Dependencies", icon: "account_tree" },
  { key: "departments", label: "Departments", icon: "groups" },
  { key: "users", label: "Users", icon: "person" },
  { key: "tasks", label: "Tasks", icon: "task_alt" },
];

export function NewProjectPage({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const draftStorageKey = `pmwds:new-project-wizard:${auth?.userId ?? "anonymous"}`;
  const [hasSavedDraft, setHasSavedDraft] = useState(() => {
    try {
      return window.localStorage.getItem(draftStorageKey) !== null;
    } catch {
      return false;
    }
  });
  const draftHasUserChanges = useRef(false);
  const draftChangedByUserId = useRef<string | null>(null);
  const perm = usePermission();
  const { data, refresh } = useAppData();
  const { addToast } = useToast();
  const [liveDepartments, setLiveDepartments] = useState<Department[] | null>(null);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // The wizard previously relied only on the paginated / cached appData
  // departments (pages API). The Departments page fetches live via
  // api.getDepartments, so newly created departments were visible there
  // but missing here. Fetch live and merge so the dropdown never goes
  // empty while cached data is stale.
  useEffect(() => {
    if (!auth) {
      setLiveDepartments(null);
      return;
    }
    let cancelled = false;
    setDepartmentsLoading(true);
    api.getDepartments(auth.token)
      .then((departments) => {
        if (!cancelled) setLiveDepartments(departments);
      })
      .catch(() => {
        if (!cancelled) setLiveDepartments(null);
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  const allDepartments = useMemo(() => {
    if (!liveDepartments) return data.departments;
    const seen = new Set(liveDepartments.map((d) => d.id));
    const missing = data.departments.filter((d) => !seen.has(d.id));
    return [...liveDepartments, ...missing];
  }, [data.departments, liveDepartments]);

  const { userOrganizationId, shouldFilterByOrg } = useUserOrganization(data.users, allDepartments);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Project Details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [budget, setBudget] = useState(0);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [projectDocumentFile, setProjectDocumentFile] = useState<File | null>(null);

  // Primary department (creator) - for exec flow
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState("");

  // Step 2: Departments
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);

  // Step 3: Milestones
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);

  // Step 4: Dependencies
  const [dependencies, setDependencies] = useState<DependencyEntry[]>([]);

  // Step 5: Tasks
  const [tasks, setTasks] = useState<TaskEntry[]>([]);

  const markDraftDirty = () => {
    draftHasUserChanges.current = true;
    draftChangedByUserId.current = auth?.userId ?? null;
  };

  useEffect(() => {
    try {
      setHasSavedDraft(window.localStorage.getItem(draftStorageKey) !== null);
    } catch {
      setHasSavedDraft(false);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    const userId = auth?.userId;
    if (!userId || !draftHasUserChanges.current || draftChangedByUserId.current !== userId) return;

    const draft: ProjectWizardDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      currentStep,
      name,
      description,
      priority,
      budget,
      startDate,
      endDate,
      primaryDepartmentId,
      selectedDepartmentIds,
      milestones,
      dependencies,
      tasks,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      setHasSavedDraft(true);
    } catch {
      // Continue working if browser storage is unavailable or full.
    }
  }, [
    auth?.userId,
    budget,
    currentStep,
    dependencies,
    description,
    draftStorageKey,
    endDate,
    milestones,
    name,
    primaryDepartmentId,
    priority,
    selectedDepartmentIds,
    startDate,
    tasks,
  ]);

  const isSuperAdmin = hasRoleKey(auth?.roleKeys, RoleKey.SuperAdmin);
  const isDepartmentHead = hasRoleKey(auth?.roleKeys, RoleKey.DepartmentHead);
  const canUploadProjectDocument = perm.has(Permission.DocumentOwnProjectUpload) || perm.has(Permission.DocumentAllProjectUpload);
  const steps = PROJECT_WIZARD_STEPS;
  const currentStepKey = steps[currentStep]?.key ?? "details";

  const dependenciesStepIndex = steps.findIndex((step) => step.key === "dependencies");
  const visibleSteps = steps.slice(0, dependenciesStepIndex + 1);

  // Auto-default primary department for DepartmentHead to their own department
  useEffect(() => {
    if (isDepartmentHead && auth && !primaryDepartmentId) {
      const dept = allDepartments.find(d => d.departmentHeadUserId === auth.userId);
      if (dept) setPrimaryDepartmentId(dept.id);
    }
  }, [isDepartmentHead, auth, allDepartments, primaryDepartmentId]);

  const handleDetailsChange = (field: string, value: string | number) => {
    markDraftDirty();
    switch (field) {
      case "name": setName(value as string); break;
      case "description": setDescription(value as string); break;
      case "priority": setPriority(value as string); break;
      case "budget": setBudget(value as number); break;
      case "startDate": setStartDate(value as string); break;
      case "endDate": setEndDate(value as string); break;
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (steps[step]?.key) {
      case "details":
        return (
          name.trim().length > 0 &&
          startDate.trim().length > 0 &&
          endDate.trim().length > 0 &&
          endDate >= startDate
        );
      case "departments": return selectedDepartmentIds.length > 0;
      case "milestones": return milestones.length > 0;
      case "milestoneDepartments": return milestones.length > 0 && milestones.every((milestone) => !!milestone.departmentId);
      case "dependencies": return true;
      case "users": return true;
      case "tasks": return true;
      default: return true;
    }
  };

  const canProceed = isStepComplete(currentStep);

  const handleNext = () => {
    if (!canProceed) return;
    if (currentStep < visibleSteps.length - 1) {
      markDraftDirty();
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      markDraftDirty();
      setCurrentStep((s) => s - 1);
    }
  };

  const handleMilestonesChange = (nextMilestones: MilestoneEntry[]) => {
    markDraftDirty();
    setMilestones(nextMilestones);
  };

  const handleDependenciesChange = (nextDependencies: DependencyEntry[]) => {
    markDraftDirty();
    setDependencies(nextDependencies);
  };

  const handleSelectedDepartmentIdsChange = (departmentIds: string[]) => {
    markDraftDirty();
    setSelectedDepartmentIds(departmentIds);
  };

  const handlePrimaryDepartmentChange = (departmentId: string) => {
    markDraftDirty();
    setPrimaryDepartmentId(departmentId);
  };

  const restoreDraft = () => {
    try {
      const serialized = window.localStorage.getItem(draftStorageKey);
      if (!serialized) {
        setHasSavedDraft(false);
        addToast("No saved project wizard data is available yet.", "info");
        return;
      }

      const draft = JSON.parse(serialized) as Partial<ProjectWizardDraft>;
      if (draft.version !== 1) {
        addToast("The saved project draft is no longer supported.", "error");
        return;
      }

      markDraftDirty();
      setCurrentStep(draft.lastCreatedAt ? 0 : Math.max(0, Math.min(draft.currentStep ?? 0, 3)));
      setName(draft.name ?? "");
      setDescription(draft.description ?? "");
      setPriority(draft.priority ?? "Medium");
      setBudget(draft.budget ?? 0);
      setStartDate(draft.startDate ?? "");
      setEndDate(draft.endDate ?? "");
      setPrimaryDepartmentId(draft.primaryDepartmentId ?? "");
      setSelectedDepartmentIds(Array.isArray(draft.selectedDepartmentIds) ? draft.selectedDepartmentIds : []);
      setMilestones(Array.isArray(draft.milestones) ? draft.milestones : []);
      setDependencies(Array.isArray(draft.dependencies) ? draft.dependencies : []);
      setTasks(Array.isArray(draft.tasks) ? draft.tasks : []);
      setProjectDocumentFile(null);
      addToast("Saved project wizard data restored.", "success");
    } catch {
      addToast("Could not restore the saved project draft.", "error");
    }
  };

  const handleFinish = async () => {
    if (!auth) return;
    const milestoneDeptIds = Array.from(new Set(milestones.map((milestone) => milestone.departmentId).filter(Boolean) as string[]));
    const assignedDepartmentIds = milestoneDeptIds;
    const execPrimaryDeptId = primaryDepartmentId || assignedDepartmentIds[0] || "";
    if (assignedDepartmentIds.length === 0) {
      addToast("Assign at least one department before finishing.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const sanitized = name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 20);
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      const projectCode = `${sanitized}-${ts}-${rand}`;

      const project = await api.createProject(auth.token, {
        projectCode,
        name,
        description: description || "",
        category: "Monitoring",
        plannedStartDate: startDate,
        plannedEndDate: endDate || "",
        // The budget field is in lakhs; the API stores rupees.
        plannedBudget: lakhsToRupees(budget),
        organizationId: "",
        departmentId: execPrimaryDeptId,
        departmentIds: assignedDepartmentIds,
        hasPrimaryDepartment: Boolean(primaryDepartmentId),
        projectManagerId: "",
        priority,
      });

      const projectId = project.id;
      if (projectDocumentFile) {
        try {
          await api.uploadProjectDocument(auth.token, projectId, projectDocumentFile);
        } catch (error) {
          addToast(
            error instanceof Error
              ? `Project created, but the document upload failed: ${error.message}`
              : "Project created, but the document upload failed.",
            "error",
          );
        }
      }


      // Create milestones sequentially, collecting real IDs
      const createdMilestoneIds: Record<string, string> = {};
      for (const ms of milestones) {
        const created = await api.createMilestone(auth.token, {
          name: ms.name,
          description: ms.description || "",
          dueDate: ms.dueDate || "",
          isCritical: ms.isCritical,
          departmentId: ms.departmentId || null,
          projectId,
        });
        createdMilestoneIds[ms.id] = created.id;
      }

      // Create milestone dependencies
      for (const dep of dependencies) {
        await api.createMilestoneDependency(auth.token, {
          projectId,
          prerequisiteMilestoneId: createdMilestoneIds[dep.prerequisiteMilestoneId],
          dependentMilestoneId: createdMilestoneIds[dep.dependentMilestoneId],
          type: dep.type,
          thresholdPercentage: dep.type === "ProgressThreshold" ? dep.thresholdPercentage : null,
        });
      }

      // Create tasks
      for (const task of tasks) {
        const taskPayload: Record<string, unknown> = {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          estimatedHours: task.estimatedHours,
          projectId,
          assignedToUserIds: task.assignedToUserIds,
        };
        if (task.startDate) taskPayload.startDate = task.startDate;
        if (task.dueDate) taskPayload.dueDate = task.dueDate;
        const actualMilestoneId = createdMilestoneIds[task.milestoneId];
        if (actualMilestoneId) {
          taskPayload.milestoneId = actualMilestoneId;
        }
        if (task.assignedToUserIds[0]) {
          taskPayload.assignedToUserId = task.assignedToUserIds[0];
        }
        await api.createTask(auth.token, taskPayload);
      }

      await refresh();
      try {
        // Keep the most recently completed project as reusable wizard history.
        // Start it at step one when restored so the saved project can be reviewed
        // and used as a starting point for another project.
        const createdAt = new Date().toISOString();
        const completedDraft: ProjectWizardDraft = {
          version: 1,
          savedAt: createdAt,
          lastCreatedAt: createdAt,
          lastCreatedProjectId: projectId,
          currentStep: 0,
          name,
          description,
          priority,
          budget,
          startDate,
          endDate,
          primaryDepartmentId,
          selectedDepartmentIds,
          milestones,
          dependencies,
          tasks,
        };
        window.localStorage.setItem(draftStorageKey, JSON.stringify(completedDraft));
        setHasSavedDraft(true);
      } catch {
        // Project creation succeeds even when browser storage is unavailable.
      }
      addToast("Project created successfully!");
      onClose?.();
      navigate(tasks.length > 0 ? `/projects/${projectId}/tasks` : `/projects/${projectId}/milestones`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create project", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const scopedDepartments = useMemo(() => {
    let filtered = allDepartments;
    if (shouldFilterByOrg && userOrganizationId) {
      const orgFiltered = filtered.filter((d) => d.organizationId === userOrganizationId);
      // Fall back to the full server-scoped list instead of an empty
      // dropdown when the client-side org id does not match (e.g. stale
      // user scope or departments without an organization).
      if (orgFiltered.length > 0) return orgFiltered;
      // If every department lacks an organization, filtering is meaningless.
      if (filtered.length > 0 && filtered.every((d) => !d.organizationId)) return filtered;
    }
    return filtered;
  }, [allDepartments, shouldFilterByOrg, userOrganizationId]);

  // The API already scopes departments to the signed-in user's access. Keep
  // the primary-department selector aligned with that same list for every role
  // that can create projects.
  const primaryDepartmentOptions = scopedDepartments;

  const departmentUsers = useMemo(() => {
    const effectiveDepartmentIds = milestones.map((milestone) => milestone.departmentId).filter(Boolean) as string[];
    if (effectiveDepartmentIds.length === 0) return [];
    const deptSet = new Set(effectiveDepartmentIds);
    const seen = new Set<string>();
    return data.users.filter((u) => {
      if (u.isActive === false) return false;
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      if (hasRoleKey(u.roleKeys ?? u.roles, RoleKey.SuperAdmin)) return false;
      const belongsToDept =
        (u.departmentId && deptSet.has(u.departmentId)) ||
        u.departments?.some((d) => deptSet.has(d.departmentId));
      return belongsToDept;
    });
  }, [milestones, data.users]);

  return (
    <div className="max-w-full mx-auto ">
      <div className=" bg-white shadow-md rounded-2xl p-6 md:p-8">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={restoreDraft}
            title={hasSavedDraft ? "Restore saved project wizard data" : "No saved project wizard data yet"}
            aria-label="Project wizard history"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Icon name="history" size={16} />
            <span>History</span>
          </button>
        </div>
        {/* Steps indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-0">
            {visibleSteps.map((step, idx) => {
              const completed = idx < currentStep;
              const active = idx === currentStep;
              const pending = idx > currentStep;

              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  {/* Circle + label */}
                  <div className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (idx < currentStep || isStepComplete(currentStep)) {
                          markDraftDirty();
                          setCurrentStep(idx);
                        }
                      }}
                      disabled={!isStepComplete(currentStep) && idx > currentStep}
                      className={`
                        relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                        ${completed
                          ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-200 scale-100"
                          : active
                          ? "bg-white border-2 border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-100 scale-110"
                          : pending
                          ? "bg-slate-50 border-2 border-slate-200 text-slate-300"
                          : "bg-slate-50 border-2 border-slate-200 text-slate-400"
                        }
                        ${idx < currentStep ? "cursor-pointer hover:scale-105" : ""}
                        ${!isStepComplete(currentStep) && idx > currentStep ? "cursor-not-allowed" : "cursor-pointer"}
                      `}
                      title={step.label}
                    >
                      {completed ? (
                        <Icon name="check-circle" size={20} />
                      ) : (
                        <span className="material-symbols-outlined text-xl">{step.icon}</span>
                      )}
                      {pending && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-300 text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                      )}
                      {active && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </button>
                    <span className={`
                      mt-2 text-center whitespace-nowrap text-[10px] font-bold uppercase tracking-wider transition-colors duration-200
                      ${completed ? "text-indigo-600" : active ? "text-indigo-600" : pending ? "text-slate-300" : "text-slate-400"}
                    `}>
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < visibleSteps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-3 mt-[-1.5rem] rounded-full relative">
                      <div className={`
                        absolute inset-0 rounded-full transition-all duration-500
                        ${idx < currentStep ? "bg-indigo-500" : "bg-slate-200"}
                      `} />
                      <div className={`
                        absolute inset-0 rounded-full bg-indigo-500 transition-all duration-500
                      `} style={{
                        width: idx < currentStep ? "100%" : "0%",
                      }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 text-xl">
              {steps[currentStep].icon}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{steps[currentStep].label}</h2>
            <p className="text-xs text-slate-400">
              Step {currentStep + 1} of {visibleSteps.length} ·{" "}
              <span className="text-red-500">*</span> required
            </p>
          </div>
        </div>

        {/* Step body */}
        <div className="min-h-[300px]">
          {currentStepKey === "details" && (
            <ProjectDetailsStep
              name={name}
              description={description}
              priority={priority}
              budget={budget}
              startDate={startDate}
              endDate={endDate}
              onChange={handleDetailsChange}
              primaryDepartmentId={primaryDepartmentId}
              departments={primaryDepartmentOptions}
              primaryDepartmentLocked={false}
              projectDocumentFile={projectDocumentFile}
              onProjectDocumentChange={setProjectDocumentFile}
              canUploadProjectDocument={canUploadProjectDocument}
              onPrimaryDepartmentChange={handlePrimaryDepartmentChange}
            />
          )}
          {currentStepKey === "departments" && (
            <DepartmentsStep
              selectedDepartmentIds={selectedDepartmentIds}
              onDepartmentsChange={handleSelectedDepartmentIdsChange}
              departments={scopedDepartments}
              organizations={data.organizations}
              users={data.users}
              onRefresh={refresh}
            />
          )}
          {currentStepKey === "users" && (
            <UsersStep
              selectedDepartmentIds={selectedDepartmentIds}
              departments={data.departments}
              users={data.users}
              organizations={data.organizations}
              onRefresh={refresh}
            />
          )}
          {currentStepKey === "milestones" && (
            <MilestonesStep
              milestones={milestones}
              onChange={handleMilestonesChange}
              projectEndDate={endDate}
            />
          )}
          {currentStepKey === "milestoneDepartments" && (
            <MilestoneDepartmentsStep
              milestones={milestones}
              departments={scopedDepartments}
              organizations={data.organizations}
              showOrganization={isSuperAdmin}
              loading={departmentsLoading}
              onChange={handleMilestonesChange}
            />
          )}
          {currentStepKey === "dependencies" && (
            <DependenciesStep
              milestones={milestones}
              dependencies={dependencies}
              onChange={handleDependenciesChange}
            />
          )}
          {currentStepKey === "tasks" && (
            <TasksStep
              milestones={milestones}
              tasks={tasks}
              onChange={setTasks}
              users={departmentUsers}
            />
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <div>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Icon name="arrow-left" size={16} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep < visibleSteps.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <Icon name="arrow-right" size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting || !canProceed}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="check-circle" size={16} />
                    Finish
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
