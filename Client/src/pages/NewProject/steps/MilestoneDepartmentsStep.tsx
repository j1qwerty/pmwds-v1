import type { Department, OrganizationRecord } from "../../../types";
import { GlassCard } from "../../shared";

interface MilestoneEntry {
  id: string;
  departmentId?: string;
  name: string;
  description: string;
  dueDate: string;
  isCritical: boolean;
}

interface MilestoneDepartmentsStepProps {
  milestones: MilestoneEntry[];
  departments: Department[];
  organizations?: OrganizationRecord[];
  loading?: boolean;
  onChange: (milestones: MilestoneEntry[]) => void;
}

export function MilestoneDepartmentsStep({
  milestones,
  departments,
  organizations = [],
  loading = false,
  onChange,
}: MilestoneDepartmentsStepProps) {
  const assignDepartment = (milestoneId: string, departmentId: string) => {
    onChange(
      milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, departmentId } : milestone,
      ),
    );
  };

  const orgNameById = new Map(organizations.map((o) => [o.id, o.name]));

  if (milestones.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-amber-400">flag</span>
        </div>
        <p className="text-sm font-semibold text-slate-600">Create milestones first</p>
        <p className="text-xs text-slate-400 mt-1">Each project milestone needs a department assignment.</p>
      </GlassCard>
    );
  }

  if (loading && departments.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <p className="text-sm font-semibold text-slate-600">Loading departments...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching the latest department list.</p>
      </GlassCard>
    );
  }

  if (departments.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-red-400">groups</span>
        </div>
        <p className="text-sm font-semibold text-slate-600">No departments available</p>
        <p className="text-xs text-slate-400 mt-1">
          No departments were returned for your organization scope. Create one on the Departments page
          (or ask an admin), then refresh and return to this step.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Every milestone must be assigned a department <span className="text-red-500">*</span>
      </p>
      {milestones.map((milestone) => (
        <div
          key={milestone.id}
          className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3 items-center p-4 rounded-xl border border-slate-200 bg-white/80"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-indigo-500">flag</span>
              <span className="font-semibold text-sm text-slate-800 truncate">{milestone.name}</span>
              {milestone.isCritical && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-600 uppercase">
                  Critical
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              {milestone.description && <span className="truncate">{milestone.description}</span>}
              {milestone.dueDate && <span>Due: {new Date(milestone.dueDate).toLocaleDateString()}</span>}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={milestone.departmentId ?? ""}
              onChange={(event) => assignDepartment(milestone.id, event.target.value)}
              className={`w-full p-2.5 rounded-lg border text-sm outline-none bg-white focus:ring-2 transition-all ${
                milestone.departmentId
                  ? "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
                  : "border-red-300 focus:border-red-400 focus:ring-red-100"
              }`}
            >
              <option value="">Select department...</option>
              {departments.map((department) => {
                const orgName = department.organizationId
                  ? orgNameById.get(department.organizationId)
                  : undefined;
                const label = orgName
                  ? `${department.name} (${department.code} · ${orgName})`
                  : department.code
                    ? `${department.name} (${department.code})`
                    : department.name;
                return (
                  <option key={department.id} value={department.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
