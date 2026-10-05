import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
 * Shell for a single project. Renders a back link plus the small tabs, then
 * mounts the existing project page component for the active tab.
 *
 * URL shape: /projects/:projectId/:tab  (tab defaults to "overview")
 */
export function ProjectDetailShell() {
  const navigate = useNavigate();
  const { projectId, tab } = useParams<{ projectId: string; tab?: string }>();

  const activeTab: TabKey = isTabKey(tab) ? tab : "overview";

  const tabs = useMemo(() => TABS, []);

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
      {/* Back button + tabs share one compact row */}
      <div className="relative z-10 mb-2 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Icon name="arrow_back" size={14} />
          Back to Projects
        </button>

        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-100 bg-white shadow-sm">
          {tabs.map((t) => {
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => goToTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
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