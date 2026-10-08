import { useMemo } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { AvatarStack, GlassCard, getDepartmentColor, HoverActions } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface DepartmentListProps {
  departments: Department[];
  selectedDeptId: string;
  /** Called when a row is clicked (opens the detail panel) */
  onSelectDept: (id: string) => void;
  /** All organizations — used to resolve parent organization labels */
  organizations?: OrganizationRecord[];
  /** All users — used to resolve per-department member counts/avatars */
  users?: User[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (dept: Department) => void;
  onDelete?: (dept: Department) => void;
}

/**
 * Compact list view for departments: one glass card with divided rows.
 * Shows the same data & actions as the card grid.
 */
export function DepartmentList({
  departments,
  selectedDeptId,
  onSelectDept,
  organizations = [],
  users = [],
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: DepartmentListProps) {
  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizations) map.set(org.id, org.name);
    return map;
  }, [organizations]);

  const membersByDept = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const user of users) {
      const deptIds = new Set<string>();
      if (user.departmentId) deptIds.add(user.departmentId);
      for (const assignment of user.departments ?? []) {
        if (assignment.departmentId) deptIds.add(assignment.departmentId);
      }
      for (const deptId of deptIds) {
        const list = map.get(deptId) ?? [];
        list.push(user);
        map.set(deptId, list);
      }
    }
    return map;
  }, [users]);

  return (
    <GlassCard className="overflow-hidden">
      <div className="divide-y divide-slate-100">
        {departments.map((dept, index) => {
          const isSelected = selectedDeptId === dept.id;
          const color = getDepartmentColor(index);
          const members = membersByDept.get(dept.id) ?? [];
          const orgName = dept.organizationId ? orgNameById.get(dept.organizationId) : undefined;

          return (
            <div key={dept.id} className="card-stagger" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectDept(dept.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDept(dept.id);
                  }
                }}
                className={`group flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer ${
                  isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50/70"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${color.bg} flex items-center justify-center shrink-0`}>
                  <Icon name="groups" size={17} className={color.text} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isSelected ? "text-indigo-700" : "text-slate-800 group-hover:text-slate-900"
                      }`}
                    >
                      {dept.name}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${color.bg} ${color.text} ${color.border}`}
                    >
                      {dept.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    {orgName && (
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <Icon name="account_balance" size={11} />
                        <span className="truncate">{orgName}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Icon name="people" size={11} />
                      {members.length} member{members.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {members.length > 0 && (
                  <div className="hidden sm:block shrink-0">
                    <AvatarStack people={members} limit={3} size="sm" />
                  </div>
                )}

                {/* Actions — delete always visible (permission-gated), view/edit on hover */}
                <HoverActions
                  entity="departments"
                  className="shrink-0"
                  always={
                    canDelete && onDelete
                      ? [{ icon: "delete", label: "Delete department", tone: "danger", onClick: () => onDelete(dept) }]
                      : []
                  }
                  onHover={[
                    { icon: "view", label: "View department", onClick: () => onSelectDept(dept.id) },
                    ...(canEdit && onEdit
                      ? [{ icon: "edit", label: "Edit department", onClick: () => onEdit(dept) }]
                      : []),
                  ]}
                />

                <Icon
                  name="chevron_right"
                  size={16}
                  className={`shrink-0 transition-all ${
                    isSelected ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
