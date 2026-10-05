import { GlassCard } from "../shared/GlassCard";
import { GradientButton } from "../shared/GradientButton";
import { InfoTile } from "../shared/InfoTile";
import { DepartmentCard } from "./DepartmentCard";
import type { OrganizationRecord, Department, User } from "../../types";
import { Avatar } from "../shared";

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

interface OrganizationDetailProps {
  organization: OrganizationRecord;
  departments: Department[];
  users: User[];
  isAdmin: boolean;
  canDeleteOrg?: boolean;
  canManageDepartments?: boolean;
  canCreateDepartments?: boolean;
  canEditDepartment?: (dept: Department) => boolean;
  onEditOrg: () => void;
  onDeleteOrg: () => void;
  onAddDept: () => void;
  onEditDept: (dept: Department) => void;
  onDeleteDept: (dept: Department) => void;
}

export function OrganizationDetail({
  organization,
  departments,
  users,
  isAdmin,
  canDeleteOrg = isAdmin,
  canManageDepartments = isAdmin,
  canCreateDepartments = canManageDepartments,
  canEditDepartment = () => canManageDepartments,
  onEditOrg,
  onDeleteOrg,
  onAddDept,
  onEditDept,
  onDeleteDept,
}: OrganizationDetailProps) {
  const capacityUtilization = departments.length > 0
    ? departments.reduce((sum, d) => sum + (d.capacityUtilization || 0), 0) / departments.length
    : 0;

  const getDeptHead = (dept: Department) => 
    users.find((u) => u.id === dept.departmentHeadUserId);

  const getTeamMembers = (deptId: string) =>
    users.filter((u) => u.departmentId === deptId || u.departments?.some((department) => department.departmentId === deptId));

  return (
    <>
      {/* Organization Detail Card */}
      <GlassCard className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="material-symbols-outlined text-white text-3xl">business</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{organization.name}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">layers</span>
                  {departments.length} Departments
                </span>
                {organization.taxId && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">fingerprint</span>
                    {organization.taxId}
                  </span>
                )}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <GradientButton variant="ghost" onClick={onEditOrg}>
                <span className="material-symbols-outlined text-base">edit</span>
                Edit
              </GradientButton>
              {canDeleteOrg && (
                <GradientButton variant="danger" onClick={onDeleteOrg}>
                  <span className="material-symbols-outlined text-base">delete</span>
                  Delete
                </GradientButton>
              )}
            </div>
          )}
        </div>

        {organization.director && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <Avatar person={organization.director} size="md" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Admin</div>
              <div className="text-sm font-bold text-slate-800">{organization.director.fullName}</div>
              <div className="text-xs text-slate-500">{organization.director.email}</div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">Departments</div>
            <div className="text-2xl font-bold text-indigo-600">{departments.length}</div>
            <div className="text-xs text-indigo-400 mt-1">Active units</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Avg Capacity</div>
            <div className="text-2xl font-bold text-emerald-600">{(capacityUtilization * 100).toFixed(0)}%</div>
            <div className="text-xs text-emerald-400 mt-1">Utilization</div>
          </div>
          <div className="bg-violet-50 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-1">Total Capacity</div>
            <div className="text-2xl font-bold text-violet-600">
              {departments.reduce((sum, d) => sum + (d.maxCapacity || 0), 0)}
            </div>
            <div className="text-xs text-violet-400 mt-1">Max members</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Founded</div>
            <div className="text-lg font-bold text-amber-600">
              {formatDate(organization.foundedDate)}
            </div>
            <div className="text-xs text-amber-400 mt-1">Established</div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoTile 
            icon="id_card" 
            label="Tax ID" 
            value={organization.taxId} 
          />
          <InfoTile 
            icon="call" 
            label="Phone" 
            value={organization.contactPhone} 
          />
          <InfoTile 
            icon="mail" 
            label="Email" 
            value={organization.contactEmail} 
          />
          <InfoTile 
            icon="location_on" 
            label="Address" 
            value={organization.address} 
          />
          <InfoTile 
            icon="calendar_today" 
            label="Founded Date" 
            value={formatDate(organization.foundedDate)}
          />
          <InfoTile 
            icon="description" 
            label="Departments" 
            value={departments.length}
          />
        </div>
      </GlassCard>

      {/* Departments Section */}
      <GlassCard className="p-8 flex-1">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Departments</h3>
            <p className="text-sm text-slate-500 mt-1">
              {departments.length} department{departments.length !== 1 ? "s" : ""} in {organization.name}
            </p>
          </div>
          {canCreateDepartments && (
            <GradientButton onClick={onAddDept}>
              <span className="material-symbols-outlined text-lg">add</span>
              Add Department
            </GradientButton>
          )}
        </div>

        {departments.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {departments.map((dept, index) => (
              <DepartmentCard
                key={dept.id}
                department={dept}
                index={index}
                isAdmin={canManageDepartments}
                canEdit={canEditDepartment(dept)}
                canDelete={canDeleteOrg}
                onEdit={onEditDept}
                onDelete={onDeleteDept}
                teamMembers={getTeamMembers(dept.id)}
                departmentHead={getDeptHead(dept)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-400">folder_open</span>
            </div>
            <h4 className="text-base font-semibold text-slate-700 mb-2">No departments yet</h4>
            <p className="text-sm text-slate-400  mx-auto mb-6">
              Create your first department to start organizing your teams and projects.
            </p>
            {canCreateDepartments && (
              <GradientButton variant="ghost" onClick={onAddDept}>
                <span className="material-symbols-outlined">add</span>
                Create First Department
              </GradientButton>
            )}
          </div>
        )}
      </GlassCard>
    </>
  );
}
