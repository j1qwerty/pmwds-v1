import type { ReactNode } from "react";
import type { Project } from "../../types";
import { GlassCard } from "../shared";

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

export function ReportFilters({ filters, projects, onFilterChange, scopeFields }: ReportFiltersProps) {
  const hasFilters = filters.organizationId || filters.projectId || filters.departmentId || filters.startDate || filters.endDate || filters.status;

  const clearFilters = () => {
    onFilterChange({ organizationId: "", projectId: "", departmentId: "", startDate: "", endDate: "", status: "" });
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-500">filter_alt</span>
          Report Filters
        </h3>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Scope (Organization / Department / Search) - rendered inline with the filters below */}
        {scopeFields}

        {/* Project */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Project
          </label>
          <select
            value={filters.projectId}
            onChange={(e) => onFilterChange({ ...filters, projectId: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
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
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
      </div>
    </GlassCard>
  );
}
