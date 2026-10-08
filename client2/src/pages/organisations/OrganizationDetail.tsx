import { Avatar, SectionCard, StatCard, EmptyState, GradientButton } from "../shared";
import { InfoTile } from "../shared/InfoTile";
import { DepartmentCard } from "./DepartmentCard";
import type { OrganizationRecord, Department, User } from "../../types";
import { Icon } from "../../components/ui/Icon";

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
    <div className="flex flex-col gap-4 min-w-0">
      {/* Organization Header */}
      <SectionCard>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
              <Icon name="corporate_fare" size={26} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 truncate">{organization.name}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Icon name="layers" size={12} className="text-slate-400" />
                  {departments.length} Department{departments.length !== 1 ? "s" : ""}
                </span>
                {organization.taxId && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="fingerprint" size={12} className="text-slate-400" />
                    {organization.taxId}
                  </span>
                )}
                {organization.foundedDate && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="calendar_today" size={12} className="text-slate-400" />
                    Founded {formatDate(organization.foundedDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <GradientButton variant="ghost" onClick={onEditOrg}>
                <Icon name="edit" size={15} />
                Edit
              </GradientButton>
              {canDeleteOrg && (
                <GradientButton variant="danger" onClick={onDeleteOrg}>
                  <Icon name="delete" size={15} />
                  Delete
                </GradientButton>
              )}
            </div>
          )}
        </div>

        {organization.director && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
            <Avatar person={organization.director} size="md" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Director</div>
              <div className="text-sm font-bold text-slate-800 truncate">{organization.director.fullName}</div>
              <div className="text-xs text-slate-500 truncate">{organization.director.email}</div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Departments" value={departments.length} color="indigo" icon="groups" />
        <StatCard label="Avg Capacity" value={`${(capacityUtilization * 100).toFixed(0)}%`} color="emerald" icon="speed" />
        <StatCard label="Total Capacity" value={departments.reduce((sum, d) => sum + (d.maxCapacity || 0), 0)} color="violet" icon="trending_up" />
        <StatCard label="Founded" value={formatDate(organization.foundedDate)} color="amber" icon="event" />
      </div>

      {/* Contact Details */}
      <SectionCard title="Contact details" icon="contact_page" description="Organization contact information">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoTile icon="id_card" label="Tax ID" value={organization.taxId} />
          <InfoTile icon="call" label="Phone" value={organization.contactPhone} />
          <InfoTile icon="mail" label="Email" value={organization.contactEmail} />
          <InfoTile icon="location_on" label="Address" value={organization.address} />
          <InfoTile icon="calendar_today" label="Founded Date" value={formatDate(organization.foundedDate)} />
          <InfoTile icon="description" label="Departments" value={departments.length} />
        </div>
      </SectionCard>

      {/* Departments Section */}
      <SectionCard
        title="Departments"
        icon="account_tree"
        description={`${departments.length} department${departments.length !== 1 ? "s" : ""} in ${organization.name}`}
        actions={
          canCreateDepartments ? (
            <button
              type="button"
              onClick={onAddDept}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
            >
              <Icon name="add" size={14} />
              Add Department
            </button>
          ) : undefined
        }
        noBodyPadding
        bodyClassName="p-4"
      >
        {departments.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
          <EmptyState
            icon="folder_open"
            title="No departments yet"
            description="Create your first department to start organizing your teams and projects."
            accent="primary"
            action={
              canCreateDepartments ? (
                <button
                  type="button"
                  onClick={onAddDept}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"
                >
                  <Icon name="add" size={14} />
                  Create First Department
                </button>
              ) : undefined
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
