import { type ReactNode } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { formatDate, formatPercent } from "../../lib/formatters";
import { roleDisplayNames } from "../../permissions";
import { Icon } from "../../components/ui/Icon";
import { Avatar, ModalCancelButton, ModalPrimaryButton, Sheet } from "../shared";
import { InfoTile } from "../shared/InfoTile";

interface UserViewPanelProps {
  /**
   * The user to show, or null while the panel is closed. The page keeps this
   * component mounted either way so switching users swaps the content in place
   * (the Sheet is never remounted) and the exit animation can always play out.
   */
  user: User | null;
  departments: Department[];
  organizations: OrganizationRecord[];
  showOrganizationName?: boolean;
  canManageUsers?: boolean;
  onClose: () => void;
  onEdit: (user: User) => void;
  /** The page's existing activate/deactivate handler (deactivate opens its own confirm) */
  onToggleUserActive?: (user: User) => void;
}

/**
 * Read-only right-slide view panel for a directory user.
 *
 * Rendered from the data already loaded on the Users page (the user record +
 * departments/organizations from app data) — no extra API calls. The footer
 * reuses the page's existing actions: Edit opens the UserEditModal Sheet and
 * activate/deactivate flows through the page's own handlers/confirm.
 */
export function UserViewPanel({
  user,
  departments,
  organizations,
  showOrganizationName = false,
  canManageUsers = false,
  onClose,
  onEdit,
  onToggleUserActive,
}: UserViewPanelProps) {
  if (!user) {
    // Closed — keep a (hidden) Sheet instance mounted so a reopen never remounts the portal.
    return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  }

  const isActive = user.isActive !== false;
  const roleLabels = roleDisplayNames(user.roles);
  const primaryDept = departments.find((d) => d.id === user.departmentId);
  const org = organizations.find((item) => item.id === (user.organizationId ?? primaryDept?.organizationId));
  const orgName = showOrganizationName ? org?.name : undefined;
  const deptLabel = user.departments?.length
    ? user.departments
        .map((item) =>
          `${item.departmentName}${showOrganizationName && item.organizationName ? ` (${item.organizationName})` : ""}`,
        )
        .join(", ")
    : primaryDept?.name || user.department || "Unassigned";
  const headerLine =
    [roleLabels.join(", ") || user.jobTitle || undefined, deptLabel !== "Unassigned" ? deptLabel : undefined]
      .filter(Boolean)
      .join(" · ") || "No role or department assigned";

  const workloadScore = user.aiWorkloadScore || 0;
  const workloadPercent = workloadScore <= 1 ? workloadScore * 100 : workloadScore;
  const availabilityDot =
    user.availabilityStatus === "Available"
      ? "bg-emerald-500"
      : user.availabilityStatus === "Offline"
        ? "bg-slate-400"
        : "bg-amber-500";

  const skillChips = user.skillDetails?.length
    ? user.skillDetails.map((skill) => ({
        name: skill.skillName,
        title: `Proficiency ${skill.proficiencyLevel}${skill.experienceMonths ? ` · ${skill.experienceMonths} mo experience` : ""}`,
      }))
    : (user.skills ?? []).map((name) => ({ name, title: undefined as string | undefined }));

  const handleToggleActive = () => {
    if (!onToggleUserActive) return;
    if (isActive) {
      // Deactivation runs through the page's confirm modal — close this panel first
      // so the two overlays never stack (Esc would otherwise dismiss both at once).
      onClose();
    }
    onToggleUserActive(user);
  };

  return (
    <Sheet
      open={true}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-3 min-w-0">
          <Avatar person={user} size="lg" className="shrink-0" />
          <span className="block min-w-0">
            <span className="block text-base font-bold text-slate-800 leading-tight truncate">
              {user.fullName}
            </span>
            <span className="block text-xs text-slate-400 truncate mt-0.5">{user.email}</span>
          </span>
        </span>
      }
      description={headerLine}
      footer={
        <>
          {canManageUsers && onToggleUserActive && (
            <button
              type="button"
              onClick={handleToggleActive}
              className={`mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-white text-xs font-semibold transition-colors ${
                isActive
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Icon name={isActive ? "person_off" : "restart_alt"} size={14} className="shrink-0" />
              {isActive ? "Deactivate" : "Reactivate"}
            </button>
          )}
          <ModalCancelButton onClick={onClose} label="Close" />
          {canManageUsers && (
            <ModalPrimaryButton icon="edit" label="Edit user" onClick={() => onEdit(user)} />
          )}
        </>
      }
    >
      {/* key on the user keeps a swap between two users a smooth content change */}
      <div key={user.id} className="view-fade space-y-5">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border shrink-0 ${
              isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-red-50 text-red-700 border-red-100"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
            {isActive ? "Active" : "Inactive"}
          </span>
          {user.availabilityStatus && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-white text-slate-600 border border-slate-200 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${availabilityDot}`} />
              {user.availabilityStatus}
            </span>
          )}
        </div>

        {/* About */}
        {user.bio && (
          <section className="space-y-2">
            <SectionTitle icon="person">About</SectionTitle>
            <p className="text-sm text-slate-600 leading-relaxed">{user.bio}</p>
          </section>
        )}

        {/* Details */}
        <section className="space-y-2.5">
          <SectionTitle icon="badge">Details</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoTile icon="mail" label="Email" value={user.email} />
            <InfoTile icon="work" label="Job title" value={user.jobTitle || "Not set"} />
            {orgName && <InfoTile icon="apartment" label="Organization" value={orgName} />}
            <InfoTile icon="event" label="Last login" value={formatDate(user.lastLoginDate)} />
            <InfoTile icon="task_alt" label="Active tasks" value={user.activeTaskCount} />
          </div>
        </section>

        {/* Capacity */}
        <section className="space-y-2">
          <SectionTitle icon="monitoring">Capacity</SectionTitle>
          <div className="rounded-xl border border-slate-200/60 bg-white/50 p-3.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Icon name="monitoring" size={11} className="text-slate-400" />
                Workload
              </span>
              <span
                className={
                  workloadPercent > 80
                    ? "text-red-600"
                    : workloadPercent > 60
                      ? "text-amber-600"
                      : "text-emerald-600"
                }
              >
                {formatPercent(workloadPercent)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  workloadPercent > 80
                    ? "bg-gradient-to-r from-red-400 to-red-500"
                    : workloadPercent > 60
                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                      : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                }`}
                style={{ width: `${Math.min(workloadPercent, 100)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="space-y-2">
          <SectionTitle icon="verified_user">Roles</SectionTitle>
          {roleLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {roleLabels.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full"
                >
                  <Icon name="badge" size={11} className="shrink-0" />
                  <span className="truncate">{role}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No roles assigned.</p>
          )}
        </section>

        {/* Departments */}
        <section className="space-y-2">
          <SectionTitle icon="account_tree">Departments</SectionTitle>
          {user.departments?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {user.departments.map((item) => (
                <span
                  key={item.departmentId}
                  title={item.isPrimary ? "Primary department" : undefined}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 max-w-full"
                >
                  <Icon name="account_tree" size={11} className="shrink-0" />
                  <span className="truncate">{item.departmentName}</span>
                  {showOrganizationName && item.organizationName && (
                    <span className="text-slate-400 truncate">· {item.organizationName}</span>
                  )}
                  {item.isPrimary && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">
                      Primary
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{deptLabel}</p>
          )}
        </section>

        {/* Skills */}
        <section className="space-y-2">
          <SectionTitle icon="school">Skills</SectionTitle>
          {skillChips.length ? (
            <div className="flex flex-wrap gap-1.5">
              {skillChips.map((chip) => (
                <span
                  key={chip.name}
                  title={chip.title}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100 max-w-full"
                >
                  <span className="truncate">{chip.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No skills recorded.</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon name={icon} size={13} className="text-slate-400" />
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</h4>
    </div>
  );
}
