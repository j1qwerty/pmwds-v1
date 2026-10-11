import type { ReactNode } from "react";
import type { Project } from "../../types";
import { SectionCard } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface ReportFiltersProps {
  filters: {
    organizationId: string;
    projectId: string;
    departmentId: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  projects: Project[];
  onFilterChange: (filters: ReportFiltersProps["filters"]) => void;
  /**
   * Extra scope fields (organization / department / search) rendered as the
   * first cells of the same filter grid, instead of a separate row above it.
   */
  scopeFields?: ReactNode;
}

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm text-slate-700 transition-all";
const labelCls =
  "text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5";

export function ReportFilters({ filters, projects, onFilterChange, scopeFields }: ReportFiltersProps) {
  const hasFilters = filters.organizationId || filters.projectId || filters.departmentId || filters.startDate || filters.endDate || filters.status;

  const clearFilters = () => {
    onFilterChange({ organizationId: "", projectId: "", departmentId: "", startDate: "", endDate: "", status: "" });
  };

  return (
    <SectionCard
      title="Report filters"
      description="Narrow down the data your report will analyze"
      icon="hi-filter"
      actions={hasFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <Icon name="close" size={12} />
          Clear all
        </button>
      ) : undefined}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Scope (Organization / Department / Search) - rendered inline with the filters below */}
        {scopeFields}

        {/* Project */}
        <div>
          <label className={labelCls} htmlFor="report-filter-project">Project</label>
          <select
            id="report-filter-project"
            value={filters.projectId}
            onChange={(e) => onFilterChange({ ...filters, projectId: e.target.value })}
            className={inputCls}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={labelCls} htmlFor="report-filter-status">Status</label>
          <select
            id="report-filter-status"
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className={inputCls}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="onHold">On Hold</option>
            <option value="cancelled">Cancelled</option>
            <option value="planning">Planning</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className={labelCls} htmlFor="report-filter-start">Start date</label>
          <input
            id="report-filter-start"
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* End Date */}
        <div>
          <label className={labelCls} htmlFor="report-filter-end">End date</label>
          <input
            id="report-filter-end"
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </SectionCard>
  );
}
