import type { Department, User } from "../../types";
import { Avatar, AvatarStack, getDepartmentColor, HoverActions } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface DepartmentCardProps {
  department: Department;
  index: number;
  isAdmin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  teamMembers?: User[];
  departmentHead?: User;
  activeProjects?: number;
  completedProjects?: number;
  avgWorkload?: number;
  /** Optional parent organization label shown under the department name */
  organizationName?: string;
  /** Optional open handler — when set, the card header acts as a view button */
  onOpen?: () => void;
}

export function DepartmentCard({
  department,
  index,
  isAdmin,
  canEdit = isAdmin,
  canDelete = isAdmin,
  onEdit,
  onDelete,
  teamMembers = [],
  departmentHead,
  avgWorkload = 0,
  organizationName,
  onOpen,
}: DepartmentCardProps) {
  const color = getDepartmentColor(index);
  const extraCount = Math.max(0, teamMembers.length - 3);
  const workloadColor =
    avgWorkload > 80
      ? "bg-red-400"
      : avgWorkload > 60
        ? "bg-amber-400"
        : "bg-emerald-400";

  const handleOpen = () => onOpen?.();

  return (
    <div
      className="card-stagger group h-full p-4 rounded-2xl bg-white/97  border border-slate-200/60 shadow-sm hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
            <Icon name="groups" size={17} className={color.text} />
          </div>
          <div className="min-w-0">
            {onOpen ? (
              <button
                type="button"
                onClick={handleOpen}
                className="font-semibold text-sm text-slate-800 truncate block text-left hover:text-indigo-600 transition-colors max-w-full"
                title={`View ${department.name}`}
              >
                {department.name}
              </button>
            ) : (
              <div className="font-semibold text-sm text-slate-800 truncate">{department.name}</div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${color.bg} ${color.text} ${color.border}`}>
                {department.code}
              </span>
              {organizationName && (
                <span className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                  <Icon name="account_balance" size={10} className="text-slate-300 shrink-0" />
                  <span className="truncate">{organizationName}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Actions — delete always visible (permission-gated), view/edit on hover */}
        <HoverActions
          entity="departments"
          className="shrink-0 pt-0.5"
          always={
            canDelete
              ? [{ icon: "delete", label: "Delete department", tone: "danger", onClick: () => onDelete(department) }]
              : []
          }
          onHover={[
            ...(onOpen ? [{ icon: "view", label: "View department", onClick: handleOpen }] : []),
            ...(canEdit ? [{ icon: "edit", label: "Edit department", onClick: () => onEdit(department) }] : []),
          ]}
        />
      </div>

      {/* Description */}
      {department.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3">{department.description}</p>
      )}

      {/* Team Members & Department Head */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {teamMembers.length > 0 ? (
            <>
              <AvatarStack people={teamMembers} limit={3} size="sm" />
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                {teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 italic">No team members</span>
          )}
          {extraCount > 0 && <span className="sr-only">{extraCount} more team members</span>}
        </div>

        {departmentHead ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Head</span>
            <Avatar person={departmentHead} size="sm" />
            <span
              className={`text-[11px] font-semibold truncate max-w-[110px] ${
                departmentHead.isActive === false ? "text-red-500" : "text-slate-600"
              }`}
            >
              {departmentHead.fullName}
            </span>
          </div>
        ) : department.departmentHeadUserId ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Head</span>
            <div className="size-6 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center shadow-sm">
              <Icon name="person" size={12} className="text-amber-600" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Workload Indicator */}
      {avgWorkload > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${workloadColor}`}
              style={{ width: `${Math.min(avgWorkload, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-slate-500">{avgWorkload}% load</span>
        </div>
      )}
    </div>
  );
}
