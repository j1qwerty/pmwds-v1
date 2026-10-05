import type { Department, OrganizationRecord } from "../../types";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";
import { formatPercent } from "../../ui";

interface DepartmentListViewProps {
  department: Department;
  organization?: OrganizationRecord;
  isSelected: boolean;
  onSelect: () => void;
}

export function DepartmentListView({ department, organization, isSelected, onSelect }: DepartmentListViewProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-lg border p-3.5 text-left transition-all hover:border-sky-500/30 ${
        isSelected
          ? "border-sky-400/40 bg-sky-400/5 ring-1 ring-sky-400/20"
          : "border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">{department.name}</p>
          <p className="text-xs text-slate-500">{department.code}</p>
          {organization && (
            <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">business</span>
              {organization.name}
            </p>
          )}
          <div className="mt-2">
            <ProgressBar
              value={Math.round((department.capacityUtilization || 0) * 100)}
              label="Capacity"
            />
          </div>
        </div>
        {isSelected && (
          <span className="material-symbols-outlined text-sky-400 shrink-0">check_circle</span>
        )}
      </div>
    </button>
  );
}