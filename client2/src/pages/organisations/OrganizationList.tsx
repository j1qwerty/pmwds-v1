import { useMemo } from "react";
import type { Department, OrganizationRecord, User } from "../../types";
import { AvatarStack, GlassCard, HoverActions } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface OrganizationListProps {
  organizations: OrganizationRecord[];
  selectedOrgId: string;
  /** Called when a row is clicked (opens the detail panel) */
  onSelect: (id: string) => void;
  /** All departments — used to resolve per-organization counts */
  departments?: Department[];
  /** All users — used to resolve per-organization member counts/avatars */
  users?: User[];
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: (org: OrganizationRecord) => void;
  onDelete?: (org: OrganizationRecord) => void;
}

/**
 * Compact list view for organizations: one glass card with divided rows.
 * Shows the same data & actions as the card grid.
 */
export function OrganizationList({
  organizations,
  selectedOrgId,
  onSelect,
  departments = [],
  users = [],
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
}: OrganizationListProps) {
  const deptCountByOrg = useMemo(() => {
    const map = new Map<string, number>();
    for (const dept of departments) {
      if (!dept.organizationId) continue;
      map.set(dept.organizationId, (map.get(dept.organizationId) ?? 0) + 1);
    }
    return map;
  }, [departments]);

  const membersByOrg = useMemo(() => {
    const map = new Map<string, User[]>();
    for (const user of users) {
      if (!user.organizationId) continue;
      const list = map.get(user.organizationId) ?? [];
      list.push(user);
      map.set(user.organizationId, list);
    }
    return map;
  }, [users]);

  return (
    <GlassCard className="overflow-hidden">
      <div className="divide-y divide-slate-100">
        {organizations.map((org, index) => {
          const isSelected = selectedOrgId === org.id;
          const deptCount = org.departmentCount || deptCountByOrg.get(org.id) || 0;
          const members = membersByOrg.get(org.id) ?? [];

          return (
            <div key={org.id} className="card-stagger" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(org.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(org.id);
                  }
                }}
                className={`group flex items-center gap-3 py-3 px-4 transition-colors cursor-pointer ${
                  isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50/70"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-indigo-100 text-indigo-600" : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <Icon name="account_balance" size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isSelected ? "text-indigo-700" : "text-slate-800 group-hover:text-slate-900"
                      }`}
                    >
                      {org.name}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200">
                      <Icon name="layers" size={10} />
                      {deptCount} dept{deptCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="people" size={11} />
                      {members.length} member{members.length !== 1 ? "s" : ""}
                    </span>
                    {org.contactEmail && <span className="truncate">· {org.contactEmail}</span>}
                  </div>
                </div>

                {members.length > 0 && (
                  <div className="hidden sm:block shrink-0">
                    <AvatarStack people={members} limit={3} size="sm" />
                  </div>
                )}

                {/* Actions — delete always visible (permission-gated), view/edit on hover */}
                <HoverActions
                  entity="organizations"
                  className="shrink-0"
                  always={
                    canDelete && onDelete
                      ? [{ icon: "delete", label: "Delete organization", tone: "danger", onClick: () => onDelete(org) }]
                      : []
                  }
                  onHover={[
                    { icon: "view", label: "View organization", onClick: () => onSelect(org.id) },
                    ...(canEdit && onEdit
                      ? [{ icon: "edit", label: "Edit organization", onClick: () => onEdit(org) }]
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
