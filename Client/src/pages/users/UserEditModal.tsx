import { useMemo, useState, type FormEvent } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { Avatar } from "../shared";
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-4">
            <Avatar person={user} size="lg" src={user.profilePictureUrl ?? undefined} />
            <div>
              <h3 className="text-base font-bold text-slate-800">Edit user</h3>
              <p className="text-xs text-slate-400">{user.fullName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          <section className="grid gap-4 md:grid-cols-2">
            <Field label="First name" value={firstName} onChange={setFirstName} required />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
            <Field label="Email" value={email} onChange={() => undefined} disabled />
            <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
          </section>

          <section>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Availability</span>
              <select value={availabilityStatus} onChange={(event) => setAvailabilityStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
                {availabilityOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Roles</h4>
              <p className="text-xs text-slate-400">Viewer is the default role for newly registered users.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleRoleOptions.map((role) => (
                <button key={role} type="button" onClick={() => toggleRole(role)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${roles.includes(role) ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {ROLE_DISPLAY_NAMES[role]}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{canSelectSuperAdminRole ? "Organization and " : ""}Departments</h4>
              <p className="text-xs text-slate-400">Select departments for this user.</p>
            </div>
            {canSelectSuperAdminRole && (
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organization</span>
                <select
                  value={organizationId}
                  onChange={(event) => {
                    setOrganizationId(event.target.value);
                    setDepartmentIds([]);
                  }}
                  className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Unassigned</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {departmentsByOrg.map(({ org, departments: orgDepartments }) => (
                <div key={org.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{org.name}</div>
                  <div className="space-y-2">
                    {orgDepartments.map((department) => (
                      <label key={department.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={departmentIds.includes(department.id)} onChange={() => toggleDepartment(department.id)} className="accent-indigo-600" />
                        {department.name}
                      </label>
                    ))}
                    {orgDepartments.length === 0 && <span className="text-xs text-slate-400">No departments</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving && <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            Save changes
          </button>
        </div>
      </form>
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
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
      />
    </label>
  );
}
