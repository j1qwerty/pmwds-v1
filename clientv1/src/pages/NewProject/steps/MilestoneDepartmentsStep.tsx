import type { Department, OrganizationRecord } from "../../../types";
import { GlassCard, EmptyState } from "../../shared";
import { Icon } from "../../../components/ui/Icon";

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
  showOrganization?: boolean;
  loading?: boolean;
  onChange: (milestones: MilestoneEntry[]) => void;
}

export function MilestoneDepartmentsStep({
  milestones,
  departments,
  organizations = [],
  showOrganization = false,
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
      <GlassCard>
        <EmptyState
          icon="flag"
          title="Create milestones first"
          description="Each project milestone needs a department assignment."
          accent="warning"
        />
      </GlassCard>
    );
  }

  if (loading && departments.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
          <Icon name="hourglass_top" size={16} className="animate-spin text-slate-400" />
          Loading departments...
        </div>
        <p className="text-xs text-slate-400 mt-1">Fetching the latest department list.</p>
      </GlassCard>
    );
  }

  if (departments.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          icon="groups"
          title="No departments available"
          description="No departments were returned for your organization scope. Create one on the Departments page (or ask an admin), then refresh and return to this step."
          accent="danger"
        />
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
          className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3 items-center p-3 rounded-xl border border-slate-200 bg-white"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="flag" size={15} className="text-indigo-500 shrink-0" />
              <span className="font-semibold text-sm text-slate-800 truncate">{milestone.name}</span>
              {milestone.isCritical && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100 uppercase">
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
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={milestone.departmentId ?? ""}
              onChange={(event) => assignDepartment(milestone.id, event.target.value)}
              className={`w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 transition-all ${
                milestone.departmentId
                  ? "bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-indigo-100"
                  : "bg-red-50/50 border border-red-300 text-slate-700 focus:bg-white focus:border-red-400 focus:ring-red-100"
              }`}
            >
              <option value="">Select department...</option>
              {departments.map((department) => {
                const orgName = department.organizationId
                  ? orgNameById.get(department.organizationId)
                  : undefined;
                const label = showOrganization && orgName
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
