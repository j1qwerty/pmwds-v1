import { GlassCard } from "../shared";

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
}

const REPORT_TYPES = [
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

const colorMap: Record<string, { bg: string; text: string; border: string; hover: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200", hover: "hover:bg-indigo-100" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", hover: "hover:bg-emerald-100" },
  violet: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200", hover: "hover:bg-violet-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", hover: "hover:bg-amber-100" },
  red: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", hover: "hover:bg-red-100" },
};

export function ReportGenerator({ filters, generatingReportType, isGeneratingType, ...handlers }: ReportGeneratorProps) {
  const anyGenerating = generatingReportType !== null;

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-indigo-500">description</span>
        Generate Reports
      </h3>
      <p className="text-xs text-slate-500 mb-5">
        Select a report type to generate an AI-powered report. Reports can be viewed inline or downloaded as PDF.
      </p>

      {anyGenerating && (
        <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="text-sm text-indigo-700 font-medium">
            Generating {REPORT_TYPES.find((r) => r.id === generatingReportType)?.title ?? "report"} with AI...
          </span>
          <span className="text-[11px] text-indigo-400 ml-auto hidden sm:inline">
            This keeps running if you switch pages
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map((report) => {
          const colors = colorMap[report.color];
          const isThisGenerating = isGeneratingType(report.id);
          // Only block a card while *its own* request is pending, or while it
          // cannot run. Other types stay clickable unless already in flight.
          const needsProject = report.requiresProject && !filters.projectId;
          const isDisabled = isThisGenerating || needsProject || (anyGenerating && !isThisGenerating);

          const handler = handlers[report.onClick];

          return (
            <button
              key={report.id}
              onClick={handler}
              disabled={isDisabled}
              aria-busy={isThisGenerating}
              className={`
                p-4 rounded-xl border text-left transition-all duration-200
                ${isDisabled
                  ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed"
                  : `${colors.bg} ${colors.border} ${colors.hover} cursor-pointer hover:shadow-sm`
                }
              `}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                isDisabled ? "bg-slate-200" : colors.bg
              }`}>
                {isThisGenerating ? (
                  <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className={`material-symbols-outlined text-xl leading-none ${
                    isDisabled ? "text-slate-400" : colors.text
                  }`}>
                    {report.icon}
                  </span>
                )}
              </div>
              <h4 className={`text-sm font-bold mb-1 ${isDisabled ? "text-slate-400" : "text-slate-800"}`}>
                {report.title}
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {report.description}
              </p>
              {needsProject && (
                <p className="text-[10px] text-amber-500 mt-2 font-medium">
                  Requires project selection
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-3">
                <span className={`material-symbols-outlined text-sm leading-none ${
                  isThisGenerating ? "text-indigo-500" : isDisabled ? "text-slate-400" : colors.text
                }`}>
                  {isThisGenerating ? "hourglass_top" : "auto_awesome"}
                </span>
                <span className={`text-xs font-semibold ${
                  isThisGenerating ? "text-indigo-600" : isDisabled ? "text-slate-400" : colors.text
                }`}>
                  {isThisGenerating ? "Generating..." : "Generate & View"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
