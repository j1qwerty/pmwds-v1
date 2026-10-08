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
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";
const labelCls =
  "text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5";

export function ReportFilters({ filters, projects, onFilterChange, scopeFields }: ReportFiltersProps) {
  const hasFilters = filters.organizationId || filters.projectId || filters.departmentId || filters.startDate || filters.endDate || filters.status;

  const clearFilters = () => {
    onFilterChange({ organizationId: "", projectId: "", departmentId: "", startDate: "", endDate: "", status: "" });
  };

  return (
    <SectionCard
      title="Report Filters"
      description="Narrow down the data your report will analyze"
      icon="hi-filter"
      actions={hasFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
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
          <label className={labelCls}>Project</label>
          <select
            value={filters.projectId}
            onChange={(e) => onFilterChange({ ...filters, projectId: e.target.value })}
            className={inputCls}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className={inputCls}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="onHold">On Hold</option>
            <option value="cancelled">Cancelled</option>
            <option value="planning">Planning</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className={labelCls}>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* End Date */}
        <div>
          <label className={labelCls}>End Date</label>
          <input
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
