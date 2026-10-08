import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useNavHeader } from "../shared";
import { useProjectWorkspace } from "./useProjectWorkspace";
import { Icon } from "../../components/ui/Icon";
import { ProjectOverviewPage } from "./ProjectOverviewPage";
import { ProjectMilestonesPage } from "./ProjectMilestonesPage";
import { ProjectTasksPage } from "./ProjectTasksPage";
import { ProjectDocumentsPage } from "./ProjectDocumentsPage";
import { ProjectDependenciesPage } from "./ProjectDependenciesPage";
import { ProjectNotFound } from "./ProjectNotFound";

const TABS = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "milestones", label: "Milestones", icon: "hi-flag" },
  { key: "tasks", label: "Tasks", icon: "hi-clipboard" },
  { key: "documents", label: "Documents", icon: "description" },
  { key: "dependencies", label: "Dependencies", icon: "account_tree" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TAB_KEYS = TABS.map((t) => t.key) as string[];

function isTabKey(value: string | undefined): value is TabKey {
  return !!value && TAB_KEYS.includes(value);
}

/**
 * Shell for a single project. Mounts a floating white tab strip (Overview /
 * Milestones / Tasks / Documents / Dependencies, with live counts) directly
 * under the topbar, then renders the existing project page component for the
 * active tab.
 *
 * The back-to-projects affordance lives in the TOPBAR: this shell publishes a
 * backTo/backLabel slot through NavHeaderContext (rendered before the title,
 * replacing the date chip), so no in-page back row is rendered here and the
 * project name appears only in the topbar + overview card.
 *
 * URL shape: /projects/:projectId/:tab  (tab defaults to "overview")
 */
const BACK_TO = "/projects";
const BACK_LABEL = "Projects";

export function ProjectDetailShell() {
  const navigate = useNavigate();
  const { projectId, tab } = useParams<{ projectId: string; tab?: string }>();
  const { auth } = useAuth();
  const ws = useProjectWorkspace();
  const { backTo, setNavHeader } = useNavHeader();

  // Light document count for the Documents tab badge. The Documents tab itself
  // does its own scoped loading; this is only the number in the tab strip.
  const [docCount, setDocCount] = useState<number | null>(null);
  useEffect(() => {
    if (!auth || !projectId) {
      setDocCount(null);
      return;
    }
    let cancelled = false;
    api
      .getProjectDocuments(auth.token, projectId)
      .then((docs) => {
        if (!cancelled) setDocCount(docs.length);
      })
      .catch(() => {
        if (!cancelled) setDocCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, projectId]);

  const activeTab: TabKey = isTabKey(tab) ? tab : "overview";

  const tabCounts = useMemo<Partial<Record<TabKey, number>>>(
    () => ({
      milestones: ws.milestones.length,
      tasks: ws.tasks.length,
      documents: docCount ?? undefined,
      dependencies: ws.dependencies.length,
    }),
    [ws.milestones.length, ws.tasks.length, ws.dependencies.length, docCount],
  );

  // Topbar back slot. Tab pages overwrite the whole header state on mount
  // (title/description only), so re-apply the back slot whenever it
  // disappears. The functional updater patches just backTo/backLabel and
  // preserves whatever title the tab page just set (no stale-title races,
  // even though child effects run before this parent effect).
  useEffect(() => {
    if (backTo !== BACK_TO) {
      setNavHeader((prev) => ({ ...prev, backTo: BACK_TO, backLabel: BACK_LABEL }));
    }
  }, [backTo, setNavHeader]);

  // Leaving the project workspace: drop the back slot so pages that never
  // call setNavHeader can't inherit a stale back button.
  useEffect(() => {
    return () => {
      setNavHeader((prev) =>
        prev.backTo ? { ...prev, backTo: undefined, backLabel: undefined } : prev,
      );
    };
  }, [setNavHeader]);

  if (!projectId) return <ProjectNotFound />;

  const goToTab = (key: TabKey) => {
    if (key === "overview") {
      navigate(`/projects/${projectId}`);
    } else {
      navigate(`/projects/${projectId}/${key}`);
    }
  };

  return (
    <div className="relative -my-2">
      {/* Tabs — floating white pill row directly under the topbar (the back
          button lives in the topbar now, so no back/breadcrumb row here). */}
      <div className="relative z-10 mb-4">
        <div
          role="tablist"
          aria-label="Project sections"
          className="inline-flex max-w-full items-stretch gap-1 overflow-x-auto rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-sm backdrop-blur-xl"
        >
          {TABS.map((t) => {
            const active = t.key === activeTab;
            const count = tabCounts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                onClick={() => goToTab(t.key)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                  active
                    ? "bg-indigo-50 font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-100"
                    : "font-semibold text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
                }`}
              >
                <Icon
                  name={t.icon}
                  size={16}
                  className={active ? "text-indigo-600" : "text-slate-400"}
                />
                {t.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                      active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — each branch mounts the existing project page component. */}
      {activeTab === "overview" && <ProjectOverviewPage />}
      {activeTab === "milestones" && <ProjectMilestonesPage />}
      {activeTab === "tasks" && <ProjectTasksPage />}
      {activeTab === "documents" && <ProjectDocumentsPage />}
      {activeTab === "dependencies" && <ProjectDependenciesPage />}
    </div>
  );
}
