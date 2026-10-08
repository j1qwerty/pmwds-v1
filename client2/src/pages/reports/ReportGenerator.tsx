import { SectionCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ReportGeneratorProps {
  filters: {
    projectId: string;
    departmentId: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  /** Report type currently being generated, or null when idle. */
  generatingReportType: string | null;
  isGeneratingType: (reportType: string) => boolean;
  onGenerateProjectStatus: () => void;
  onGenerateBudgetVariance: () => void;
  onGenerateTaskCompletion: () => void;
  onGenerateDepartmentWorkload: () => void;
  onGenerateDelayAnalysis: () => void;
  generationError?: string | null;
}

export const REPORT_TYPES = [
  {
    id: "project-status",
    title: "Project Status",
    description: "Overall project health, progress, and milestone tracking",
    icon: "monitoring",
    color: "indigo",
    onClick: "onGenerateProjectStatus" as const,
    requiresProject: true,
  },
  {
    id: "budget-variance",
    title: "Budget Variance",
    description: "Budget allocation, spending analysis, and variance tracking",
    icon: "account_balance",
    color: "emerald",
    onClick: "onGenerateBudgetVariance" as const,
    requiresProject: true,
  },
  {
    id: "task-completion",
    title: "Task Completion",
    description: "Task progress, completion rates, and productivity metrics",
    icon: "task_alt",
    color: "violet",
    onClick: "onGenerateTaskCompletion" as const,
    requiresProject: false,
  },
  {
    id: "department-workload",
    title: "Department Workload",
    description: "Team capacity, workload distribution, and resource allocation",
    icon: "groups",
    color: "amber",
    onClick: "onGenerateDepartmentWorkload" as const,
    requiresProject: false,
  },
  {
    id: "delay-analysis",
    title: "Delay Analysis",
    description: "Task delays, bottleneck identification, and timeline impact",
    icon: "speed",
    color: "red",
    onClick: "onGenerateDelayAnalysis" as const,
    requiresProject: false,
  },
];

export const REPORT_TYPE_COUNT = REPORT_TYPES.length;

const colorMap: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200", hover: "hover:bg-indigo-100" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", hover: "hover:bg-emerald-100" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", hover: "hover:bg-violet-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", hover: "hover:bg-amber-100" },
  red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", hover: "hover:bg-red-100" },
};

type HandlerKey = (typeof REPORT_TYPES)[number]["onClick"];

export function ReportGenerator({
  filters,
  generatingReportType,
  isGeneratingType,
  generationError,
  ...handlers
}: ReportGeneratorProps) {
  const anyGenerating = generatingReportType !== null;

  return (
    <SectionCard
      title="Generate report"
      description="Select a report type to generate an AI-powered analysis. Reports can be viewed inline or downloaded as PDF."
      icon="description"
      className="overflow-hidden"
    >
      {/*
        Viewport clamp: the card never grows past the screen height. The
        report-type area scrolls internally (lg+) while the status footer
        below stays pinned to the bottom of the card, so the "Generating…"
        and error states remain visible without page scrolling.
      */}
      <div className="flex flex-col lg:max-h-[calc(100vh-16rem)]">
        <div className="flex-1 min-h-0 lg:overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((report) => {
              const colors = colorMap[report.color];
              const isThisGenerating = isGeneratingType(report.id);
              // Only block a card while *its own* request is pending, or while it
              // cannot run. Other types stay clickable unless already in flight.
              const needsProject = report.requiresProject && !filters.projectId;
              const isDisabled =
                isThisGenerating || needsProject || (anyGenerating && !isThisGenerating);

              const handler = handlers[report.onClick as HandlerKey];

              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={handler}
                  disabled={isDisabled}
                  aria-busy={isThisGenerating}
                  className={`
                    group flex flex-col p-4 rounded-xl border text-left transition-all duration-200
                    ${
                      isDisabled
                        ? "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed"
                        : "bg-white border-slate-200 cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                    }
                  `}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDisabled ? "bg-slate-100" : colors.bg
                      }`}
                    >
                      {isThisGenerating ? (
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon
                          name={report.icon}
                          size={20}
                          className={isDisabled ? "text-slate-400" : colors.text}
                        />
                      )}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h4
                        className={`text-sm font-bold leading-tight ${
                          isDisabled ? "text-slate-400" : "text-slate-800"
                        }`}
                      >
                        {report.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  {needsProject && (
                    <p className="text-[10px] text-amber-600 mb-2 font-medium flex items-center gap-1">
                      <Icon name="info" size={11} />
                      Requires project selection
                    </p>
                  )}

                  <div
                    className={`
                      mt-auto inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all
                      ${
                        isThisGenerating
                          ? "text-indigo-700 bg-indigo-50 border border-indigo-200"
                          : isDisabled
                          ? "text-slate-400 bg-slate-100"
                          : "text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20"
                      }
                    `}
                  >
                    {isThisGenerating ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Icon name="auto_awesome" size={13} />
                        Generate &amp; view
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status footer — pinned to the bottom of the clamped card (edge-to-edge). */}
        {generationError && !anyGenerating && (
          <div
            className="shrink-0 -mx-5 -mb-4 mt-4 px-5 py-3 bg-red-50/90 border-t border-red-100 flex items-start gap-3"
            role="alert"
          >
            <Icon name="error" size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm text-red-700 font-semibold">Report generation failed</p>
              <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{generationError}</p>
            </div>
          </div>
        )}

        {anyGenerating && (
          <div className="shrink-0 -mx-5 -mb-4 mt-4 px-5 py-3 bg-indigo-50/90 border-t border-indigo-100 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-indigo-700 font-medium">
              Generating{" "}
              {REPORT_TYPES.find((r) => r.id === generatingReportType)?.title ?? "report"} with AI...
            </span>
            <span className="text-[11px] text-indigo-400 ml-auto hidden sm:inline">
              This keeps running if you switch pages
            </span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
