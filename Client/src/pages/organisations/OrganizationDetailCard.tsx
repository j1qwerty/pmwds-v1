import type { OrganizationRecord, Department } from "../../types";
import { DetailRow } from "./DetailRow";
import { StatCard } from "./StatCard";

interface OrganizationDetailCardProps {
  organization: OrganizationRecord;
  departments: Department[];
  totalDepartmentCount: number;
}

export function OrganizationDetailCard({
  organization,
  departments,
  totalDepartmentCount,
}: OrganizationDetailCardProps) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{organization.name}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {departments.length} Department{departments.length !== 1 ? "s" : ""} • {totalDepartmentCount} Total
          </p>
        </div>
        <span className="material-symbols-outlined text-3xl text-sky-400">business</span>
      </div>

      <div className="mb-4 space-y-0">
        <DetailRow label="Tax ID" value={organization.taxId} icon="id_card" />
        <DetailRow label="Phone" value={organization.contactPhone} icon="call" />
        <DetailRow label="Email" value={organization.contactEmail} icon="mail" />
        <DetailRow
          label="Founded"
          value={organization.foundedDate ? new Date(organization.foundedDate).toLocaleDateString() : "—"}
          icon="calendar_today"
        />
        <DetailRow label="Address" value={organization.address} icon="location_on" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Departments" value={departments.length} sublabel={`${totalDepartmentCount} total`} icon="account_tree" />
        <StatCard label="Tax ID" value={organization.taxId || "—"} icon="badge" />
        <StatCard
          label="Contact"
          value={organization.contactEmail || organization.contactPhone || "—"}
          icon="contact_page"
        />
      </div>
    </div>
  );
}