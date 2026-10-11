import { useMemo, useState } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { Avatar, ModalCancelButton, ModalPrimaryButton, Sheet } from "../shared";
import { Icon } from "../../components/ui/Icon";
import { ROLE_DISPLAY_NAMES, ROLE_LEVELS, RoleKey, normalizeRoleKey, type RoleKeyCode } from "../../permissions";

const roleOptions: RoleKeyCode[] = [RoleKey.Viewer, RoleKey.TeamMember, RoleKey.DepartmentHead, RoleKey.ProjectManager, RoleKey.Director, RoleKey.SuperAdmin];
const availabilityOptions = ["Available", "Busy", "Away", "InMeeting", "Offline", "DeepWork"];

type UserEditModalProps = {
  user: User;
  departments: Department[];
  organizations: OrganizationRecord[];
  canSelectSuperAdminRole: boolean;
  userMaxLevel: number;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

export function UserEditModal({ user, departments, organizations, canSelectSuperAdminRole, userMaxLevel, onClose, onSubmit }: UserEditModalProps) {
  const initialOrganizationId =
    user.organizationId ??
    user.departments?.find((item) => item.organizationId)?.organizationId ??
    departments.find((department) => department.id === user.departmentId)?.organizationId ??
    "";
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email] = useState(user.email);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? "");
  const [availabilityStatus, setAvailabilityStatus] = useState(user.availabilityStatus || "Available");
  const [departmentIds, setDepartmentIds] = useState<string[]>(user.departments?.map((item) => item.departmentId) ?? (user.departmentId ? [user.departmentId] : []));
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [roles, setRoles] = useState<string[]>(
    user.roleKeys?.length ? user.roleKeys : (user.roles?.length ? user.roles.map(normalizeRoleKey) : [RoleKey.Viewer]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profilePictureUrl] = useState(user.profilePictureUrl ?? "");
  const visibleRoleOptions = roleOptions.filter((role) => {
    if (role === RoleKey.SuperAdmin && !canSelectSuperAdminRole) return false;
    if (canSelectSuperAdminRole) return true;
    return (ROLE_LEVELS[role] ?? 0) < userMaxLevel;
  });

  const departmentsByOrg = useMemo(
    () =>
      organizations
        .filter((org) => !organizationId || org.id === organizationId)
        .map((org) => ({
        org,
        departments: departments.filter((department) => department.organizationId === org.id),
      })),
    [departments, organizationId, organizations],
  );

  const toggleDepartment = (departmentId: string) => {
    setDepartmentIds((current) =>
      current.includes(departmentId)
        ? current.filter((item) => item !== departmentId)
        : [...current, departmentId]
    );
  };

  const toggleRole = (role: string) => {
    setRoles((current) => {
      const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
      return next.length ? next : [RoleKey.Viewer];
    });
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        firstName,
        lastName,
        email,
        jobTitle,
        phoneNumber: "",
        organizationId: organizationId || null,
        departmentIds,
        roleNames: roles,
        availabilityStatus,
        profilePictureUrl: profilePictureUrl || null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update user.");
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={true}
      onClose={onClose}
      title="Edit user"
      description={user.fullName}
      icon="edit"
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onClose} />
          <ModalPrimaryButton
            onClick={() => void submit()}
            loading={saving}
            label="Save changes"
            icon="check"
          />
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="space-y-5"
      >
        {/* Profile preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
          <Avatar person={user} size="lg" src={user.profilePictureUrl ?? undefined} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{user.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
            {user.jobTitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{user.jobTitle}</p>}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            <Icon name="error" size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Personal information */}
        <section className="space-y-3">
          <SectionLabel icon="badge">Personal information</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" value={email} onChange={() => undefined} disabled />
            <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
          </div>
        </section>

        {/* Availability */}
        <section className="space-y-2">
          <SectionLabel icon="schedule">Availability</SectionLabel>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
            <select
              value={availabilityStatus}
              onChange={(event) => setAvailabilityStatus(event.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              {availabilityOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </section>

        {/* Roles */}
        <section className="space-y-2">
          <SectionLabel icon="verified_user">Roles</SectionLabel>
          <p className="text-[11px] text-slate-500">Viewer is the default role for newly registered users.</p>
          <div className="flex flex-wrap gap-1.5">
            {visibleRoleOptions.map((role) => {
              const active = roles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? "bg-indigo-600 text-white border border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {active && <Icon name="check" size={12} />}
                  {ROLE_DISPLAY_NAMES[role]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Organization & Departments */}
        <section className="space-y-2">
          <SectionLabel icon="apartment">{canSelectSuperAdminRole ? "Organization & departments" : "Departments"}</SectionLabel>
          <p className="text-[11px] text-slate-500">Select departments for this user.</p>

          {canSelectSuperAdminRole && (
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Organization</span>
              <select
                value={organizationId}
                onChange={(event) => {
                  setOrganizationId(event.target.value);
                  setDepartmentIds([]);
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                <option value="">Unassigned</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {departmentsByOrg.map(({ org, departments: orgDepartments }) => (
              <div key={org.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                <div className="mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{org.name}</div>
                <div className="space-y-1.5">
                  {orgDepartments.map((department) => {
                    const checked = departmentIds.includes(department.id);
                    return (
                      <label
                        key={department.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                          checked ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDepartment(department.id)}
                          className="accent-indigo-600 size-3.5"
                        />
                        <span className="truncate">{department.name}</span>
                      </label>
                    );
                  })}
                  {orgDepartments.length === 0 && <span className="text-[11px] text-slate-400">No departments</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hidden submit to allow form submission via Enter key */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon name={icon} size={13} className="text-slate-400" />
      <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{children}</h4>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
      />
    </label>
  );
}
