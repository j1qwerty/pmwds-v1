import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { lazyPage, whenIdle } from "../../lib/lazyPage";
import { ProjectDetailsStep } from "./steps/ProjectDetailsStep"; // first step: ships with the wizard chunk
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import type { Department } from "../../types";
import { lakhsToRupees } from "../../lib/formatters";
import {
  useToast,
  LoadingPage,
  usePermission,
} from "../shared";
import { Icon } from "../../components/ui/Icon";
import { Permission, RoleKey, hasRoleKey } from "../../permissions";
import { useUserOrganization } from "../shared/useUserOrganization";

const DepartmentsStep = lazyPage(() => import("./steps/DepartmentsStep").then((m) => ({ default: m.DepartmentsStep })));
const MilestonesStep = lazyPage(() => import("./steps/MilestonesStep").then((m) => ({ default: m.MilestonesStep })));
const MilestoneDepartmentsStep = lazyPage(() => import("./steps/MilestoneDepartmentsStep").then((m) => ({ default: m.MilestoneDepartmentsStep })));
const DependenciesStep = lazyPage(() => import("./steps/DependenciesStep").then((m) => ({ default: m.DependenciesStep })));
const TasksStep = lazyPage(() => import("./steps/TasksStep").then((m) => ({ default: m.TasksStep })));
const UsersStep = lazyPage(() => import("./steps/UsersStep").then((m) => ({ default: m.UsersStep })));

// Details renders immediately; the other steps are prefetched one ahead (see effect below).
const STEP_COMPONENTS: Record<string, { preload: () => Promise<unknown> }> = {
  departments: DepartmentsStep,
  users: UsersStep,
  milestones: MilestonesStep,
  milestoneDepartments: MilestoneDepartmentsStep,
  dependencies: DependenciesStep,
  tasks: TasksStep,
};

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
  { key: "details", label: "Project Details", icon: "folder_open" },
  { key: "milestones", label: "Milestones", icon: "flag" },
  { key: "milestoneDepartments", label: "Assign Departments", icon: "account_tree" },
  { key: "dependencies", label: "Dependencies", icon: "account_tree" },
  { key: "departments", label: "Departments", icon: "groups" },
  { key: "users", label: "Users", icon: "person" },
  { key: "tasks", label: "Tasks", icon: "task_alt" },
];

// Short helper copy shown at the top of each step container (presentation only).
const STEP_DESCRIPTIONS: Record<string, string> = {
  details: "Name the project, set the schedule, budget, and priority.",
  milestones: "Break the project into key milestones with due dates.",
  milestoneDepartments: "Assign each milestone to an owning department.",
  dependencies: "Optionally define which milestones wait on others.",
  departments: "Choose the departments involved in the project.",
  users: "Review the people in each selected department.",
  tasks: "Add tasks under milestones and assign owners.",
};

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

    // Debounced: typing a name/description fires this effect per keystroke,
    // and a synchronous JSON.stringify + localStorage write on every keystroke
    // is what made the wizard feel laggy. Flush 500ms after the last change.
    const timer = window.setTimeout(() => {
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
    }, 500);
    return () => window.clearTimeout(timer);
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

  // Warm every other step as soon as the browser is idle after the wizard opens,
  // so moving to the next step never waits on the network.
  useEffect(() => {
    whenIdle(() => {
      Object.values(STEP_COMPONENTS).forEach((c) => void c.preload());
    }, 800);
  }, []);

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

  // Exit affordance for the wizard header: reuse the host-provided onClose
  // when mounted inside a host modal/sheet, otherwise navigate back to /projects.
  const handleExit = () => {
    if (onClose) {
      onClose();
    } else {
      navigate("/projects");
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
    <div className="max-w-full mx-auto relative z-10">
      {/* ── Step progress header (solid white, not glass: translucent cards
          pick up the page gradient + modal scrim and render gray) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3 md:p-4 mb-3">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Icon name="folder_open" size={16} className="text-indigo-600" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800 leading-tight">New project</h2>
              <p className="text-[11px] text-slate-400">
                Step {currentStep + 1} of {visibleSteps.length} · <span className="text-red-500">*</span> required
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={restoreDraft}
              title={hasSavedDraft ? "Restore saved project wizard data" : "No saved project wizard data yet"}
              aria-label="Project wizard history"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Icon name="history" size={14} />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={handleExit}
              title="Close the project wizard"
              aria-label="Close project wizard"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-start min-w-[560px]">
            {visibleSteps.map((step, idx) => {
              const completed = idx < currentStep;
              const active = idx === currentStep;
              const pending = idx > currentStep;
              const clickable = idx < currentStep || isStepComplete(currentStep);

              return (
                <div key={step.key} className={`flex items-start ${idx < visibleSteps.length - 1 ? "flex-1" : ""}`}>
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
                      aria-current={active ? "step" : undefined}
                      className={`
                        relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                        ${completed
                          ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                          : active
                          ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30 ring-4 ring-indigo-100"
                          : "bg-slate-100 border border-slate-200 text-slate-400"
                        }
                        ${clickable && !active ? "cursor-pointer hover:brightness-105" : "cursor-default"}
                        ${!isStepComplete(currentStep) && idx > currentStep ? "cursor-not-allowed" : ""}
                      `}
                      title={step.label}
                    >
                      {completed ? (
                        <Icon name="check" size={15} />
                      ) : (
                        idx + 1
                      )}
                    </button>
                    <span className={`
                      mt-1.5 text-center whitespace-nowrap text-[10px] font-bold uppercase tracking-wider transition-colors duration-200
                      ${completed ? "text-emerald-600" : active ? "text-indigo-600" : "text-slate-400"}
                    `}>
                      {step.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < visibleSteps.length - 1 && (
                    <div className="flex-1 h-0.5 rounded-full mt-4 mx-2 bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${completed ? "bg-emerald-500 w-full" : "bg-slate-200 w-0"}`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Step container (solid white, see header note) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 md:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Icon name={steps[currentStep].icon} size={17} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800">{steps[currentStep].label}</h3>
            <p className="text-xs text-slate-400">{STEP_DESCRIPTIONS[steps[currentStep].key] ?? ""}</p>
          </div>
        </div>

        {/* Step body */}
        <div key={currentStepKey} className="min-h-[200px] view-fade">
          <Suspense fallback={<div className="min-h-[200px]" aria-busy="true" />}>
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
          </Suspense>
        </div>

        {/* Bottom action bar — sticky to the card bottom */}
        <div className="sticky bottom-0 -mx-4 md:-mx-5 -mb-4 md:-mb-5 mt-4 px-4 md:px-5 py-3 border-t border-slate-100 bg-white/97  flex items-center justify-between rounded-b-2xl">
          <div>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Icon name="arrow_back" size={15} />
                Back
              </button>
            )}
          </div>
          {currentStep < visibleSteps.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <Icon name="arrow_forward" size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || !canProceed}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating project...
                </>
              ) : (
                <>
                  <Icon name="check_circle" size={15} />
                  Create project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
