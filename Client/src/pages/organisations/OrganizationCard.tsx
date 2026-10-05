import type { OrganizationRecord } from "../../types";
import { Badge } from "./Badge";

interface OrganizationCardProps {
  organization: OrganizationRecord;
  isSelected: boolean;
  departmentCount: number;
  onSelect: () => void;
}

export function OrganizationCard({ organization, isSelected, departmentCount, onSelect }: OrganizationCardProps) {
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
          <p className="text-sm font-semibold text-slate-100 truncate">{organization.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">business</span>
              {departmentCount} {departmentCount === 1 ? "dept" : "depts"}
            </span>
            {organization.contactEmail && (
              <span className="flex items-center gap-1 truncate">
                <span className="material-symbols-outlined text-xs">mail</span>
                {organization.contactEmail}
              </span>
            )}
          </div>
        </div>
        {isSelected && (
          <span className="material-symbols-outlined text-sky-400 shrink-0">check_circle</span>
        )}
      </div>
    </button>
  );
}