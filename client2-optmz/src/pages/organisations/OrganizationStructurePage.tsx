import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, User } from "../../types";
import { Icon } from "../../components/ui/Icon";
import {
  AnimatedBackground,
  DeleteConfirmationModal,
  OrgFormModal,
  DeptFormModal,
  EmptyState,
  GlassCard,
  HoverActions,
  StatCard,
  LoadingPage,
  AvatarStack,
  FilterBar,
  SortDropdown,
  ViewToggle,
  PageAction,
  PageContainer,
  Sheet,
  getDepartmentColor,
  PERMISSION_GROUPS,
  usePermission,
  useNavHeader,
  useToast,
} from "../shared";
import { OrganizationList } from "./OrganizationList";
import { OrganizationDetail } from "./OrganizationDetail";

type ViewMode = "card" | "list";
type SortMode = "name" | "departments-desc" | "departments-asc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "departments-desc", label: "Most departments" },
  { value: "departments-asc", label: "Fewest departments" },
];

export function OrganizationStructurePage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const canCreateOrganization = perm.hasAny(PERMISSION_GROUPS.system.manage, PERMISSION_GROUPS.organization.create);
  const canManageOrganization = perm.hasAny(
    PERMISSION_GROUPS.organization.create,
    PERMISSION_GROUPS.organization.edit,
    PERMISSION_GROUPS.organization.delete,
  );
  const canManageDepartments = perm.has(PERMISSION_GROUPS.department.manage);
  const canCreateDepartments = perm.has(PERMISSION_GROUPS.department.create);
  const canDeleteOrganization = perm.has(PERMISSION_GROUPS.organization.delete);

  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<OrganizationRecord | null>(null);
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [detailOpen, setDetailOpen] = useState(false);

  const [orgModal, setOrgModal] = useState<{ open: boolean; editOrg?: OrganizationRecord }>({ open: false });
  const [deptModal, setDeptModal] = useState<{ open: boolean; editDept?: Department }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: "org" | "dept";
    id: string;
    name: string;
    warning?: string;
  }>({ open: false, type: "org", id: "", name: "" });

  const loadData = (preferredOrgId?: string) => {
    if (!auth) return;
    setLoading(true);
    Promise.all([
      api.getOrganizations(auth.token),
      api.getDepartments(auth.token),
      canManageDepartments ? api.getUsers(auth.token) : Promise.resolve([]),
    ])
      .then(([organizationData, departmentData, userData]) => {
        setOrganizations(organizationData);
        setDepartments(departmentData);
        setUsers(userData);

        const nextOrgId = preferredOrgId || selectedOrgId;
        if (nextOrgId && organizationData.some((org) => org.id === nextOrgId)) {
          setSelectedOrgId(nextOrgId);
        } else if (organizationData.length) {
          setSelectedOrgId(organizationData[0].id);
        } else {
          setSelectedOrgId("");
        }
      })
      .catch((e) => addToast(`Error: ${e instanceof Error ? e.message : "Failed to load organizations"}`, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, canManageDepartments]);

  useEffect(() => {
    if (!auth || !selectedOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedOrgDetail(null);
      return;
    }
    let cancelled = false;
    api.getOrganization(auth.token, selectedOrgId).then((org) => {
      if (!cancelled) setSelectedOrgDetail(org);
    }).catch(() => {
      if (!cancelled) setSelectedOrgDetail(null);
    });
    return () => { cancelled = true; };
  }, [auth, selectedOrgId]);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId) ?? null;
  const orgDepartments = departments.filter((d) => d.organizationId === selectedOrgId);

  // Aggregate metrics for stats row
  const stats = useMemo(
    () => ({
      organizations: organizations.length,
      departments: departments.length,
      members: users.length,
      capacity: departments.reduce((sum, d) => sum + (d.maxCapacity || 0), 0),
    }),
    [organizations, departments, users],
  );

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

  const deptCountFor = (org: OrganizationRecord) =>
    org.departmentCount || deptCountByOrg.get(org.id) || 0;

  const filteredOrgs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = organizations;
    if (term) {
      list = list.filter(
        (org) =>
          org.name.toLowerCase().includes(term) ||
          (org.contactEmail ?? "").toLowerCase().includes(term) ||
          (org.address ?? "").toLowerCase().includes(term),
      );
    }
    const sorted = [...list];
    if (sortMode === "departments-desc") {
      sorted.sort((a, b) => deptCountFor(b) - deptCountFor(a) || a.name.localeCompare(b.name));
    } else if (sortMode === "departments-asc") {
      sorted.sort((a, b) => deptCountFor(a) - deptCountFor(b) || a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations, searchTerm, sortMode, deptCountByOrg]);

  const checkBeforeDelete = (type: "org" | "dept", id: string, name: string) => {
    let warning = "";
    if (type === "org") {
      const linked = departments.filter((d) => d.organizationId === id);
      if (linked.length) {
        warning = `This organization has ${linked.length} department(s). Deleting it will remove all associated departments and their data permanently.`;
      }
    } else {
      warning = "Deleting this department may affect assigned projects and team members.";
    }
    setDeleteConfirm({ open: true, type, id, name, warning });
  };

  const handleDelete = async () => {
    if (!auth) return;
    try {
      if (deleteConfirm.type === "org") {
        await api.deleteOrganization(auth.token, deleteConfirm.id);
        if (selectedOrgId === deleteConfirm.id) setSelectedOrgId("");
      } else {
        await api.deleteDepartment(auth.token, deleteConfirm.id);
      }
      addToast(`${deleteConfirm.type === "org" ? "Organization" : "Department"} deleted successfully.`);
      setDeleteConfirm({ open: false, type: "org", id: "", name: "" });
      setDetailOpen(false);
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Deletion failed"}`, "error");
    }
  };

  const handleOrgSubmit = async (form: Record<string, unknown>) => {
    if (!auth) return;
    try {
      let nextOrgId = selectedOrgId;
      if (orgModal.editOrg) {
        await api.updateOrganization(auth.token, orgModal.editOrg.id, form);
        nextOrgId = orgModal.editOrg.id;
      } else {
        const newOrg = await api.createOrganization(auth.token, form);
        nextOrgId = newOrg.id || selectedOrgId;
        setSelectedOrgId(nextOrgId);
      }
      setOrgModal({ open: false });
      loadData(nextOrgId);
      addToast(orgModal.editOrg ? "Organization updated." : "Organization created.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const handleDeptSubmit = async (form: Record<string, unknown>) => {
    if (!auth) return;
    try {
      const payload = { ...form, organizationId: form.organizationId || selectedOrgId };
      if (deptModal.editDept) {
        await api.updateDepartment(auth.token, deptModal.editDept.id, payload);
      } else {
        await api.createDepartment(auth.token, payload);
      }
      setDeptModal({ open: false });
      loadData();
      addToast(deptModal.editDept ? "Department updated." : "Department created.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Organisations",
      description: "Manage organizations and their departments",
      action: canCreateOrganization ? {
        label: "New Organization",
        onClick: () => setOrgModal({ open: true }),
        icon: "add_business",
      } : undefined,
    });
  }, [setNavHeader, canCreateOrganization]);

  const openOrgDetail = (orgId: string) => {
    setSelectedOrgId(orgId);
    setDetailOpen(true);
  };

  if (loading) return <LoadingPage label="Loading organizations..." />;

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Organizations" value={stats.organizations} color="indigo" icon="corporate_fare" />
            <StatCard label="Departments" value={stats.departments} color="violet" icon="groups" />
            <StatCard label="Team Members" value={stats.members} color="emerald" icon="people" />
            <StatCard label="Total Capacity" value={stats.capacity} color="amber" icon="trending_up" />
          </>
        }
        filters={
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search organizations..."
            leftExtras={
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                {filteredOrgs.length} of {organizations.length}
              </span>
            }
            actions={
              <>
                <SortDropdown value={sortMode} onChange={(value) => setSortMode(value as SortMode)} options={SORT_OPTIONS} />
                <ViewToggle value={viewMode} onChange={(mode) => setViewMode(mode as ViewMode)} available={["card", "list"]} />
                {canCreateOrganization && (
                  <PageAction
                    label="New organization"
                    icon="add"
                    onClick={() => setOrgModal({ open: true })}
                  />
                )}
              </>
            }
          />
        }
      >
        {organizations.length === 0 ? (
          <GlassCard className="min-h-80 flex items-center justify-center">
            <EmptyState
              icon="account_balance"
              title="No organizations yet"
              description="Create your first organization to start structuring teams, departments, and projects."
              accent="primary"
              action={
                canCreateOrganization ? (
                  <PageAction label="New organization" icon="add" onClick={() => setOrgModal({ open: true })} />
                ) : undefined
              }
            />
          </GlassCard>
        ) : filteredOrgs.length === 0 ? (
          <GlassCard className="min-h-80 flex items-center justify-center">
            <EmptyState
              icon="search_off"
              title="No organizations match the current filters"
              description="Try a different search term, or clear the search to see all organizations."
              compact
              action={
                searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Clear search
                  </button>
                ) : undefined
              }
            />
          </GlassCard>
        ) : viewMode === "card" ? (
          <div className="view-fade grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrgs.map((org, index) => (
              <OrganizationCard
                key={org.id}
                org={org}
                index={index}
                deptCount={deptCountFor(org)}
                members={membersByOrg.get(org.id) ?? []}
                canManage={canManageOrganization}
                canDelete={canDeleteOrganization}
                onOpen={() => openOrgDetail(org.id)}
                onEdit={() => setOrgModal({ open: true, editOrg: org })}
                onDelete={() => checkBeforeDelete("org", org.id, org.name)}
              />
            ))}
          </div>
        ) : (
          <div className="view-fade">
            <OrganizationList
              organizations={filteredOrgs}
              selectedOrgId={selectedOrgId}
              onSelect={openOrgDetail}
              departments={departments}
              users={users}
              canEdit={canManageOrganization}
              canDelete={canDeleteOrganization}
              onEdit={(org) => setOrgModal({ open: true, editOrg: org })}
              onDelete={(org) => checkBeforeDelete("org", org.id, org.name)}
            />
          </div>
        )}
      </PageContainer>

      {/* Organization detail — right sheet */}
      <Sheet
        open={detailOpen && !!selectedOrg}
        onClose={() => setDetailOpen(false)}
        size="lg"
        icon="account_balance"
        accent="primary"
        title={selectedOrg?.name}
        description={
          selectedOrg
            ? `${deptCountFor(selectedOrg)} department${deptCountFor(selectedOrg) !== 1 ? "s" : ""} · ${(membersByOrg.get(selectedOrg.id) ?? []).length} member${(membersByOrg.get(selectedOrg.id) ?? []).length !== 1 ? "s" : ""}`
            : undefined
        }
      >
        {selectedOrg && (
          <OrganizationDetail
            organization={selectedOrgDetail ?? selectedOrg}
            departments={orgDepartments}
            users={users}
            isAdmin={canManageOrganization}
            canDeleteOrg={canDeleteOrganization}
            canManageDepartments={canManageDepartments}
            canCreateDepartments={canCreateDepartments}
            canEditDepartment={() => perm.has(PERMISSION_GROUPS.department.edit)}
            onEditOrg={() => setOrgModal({ open: true, editOrg: selectedOrg })}
            onDeleteOrg={() => checkBeforeDelete("org", selectedOrg.id, selectedOrg.name)}
            onAddDept={() => setDeptModal({ open: true })}
            onEditDept={(dept) => setDeptModal({ open: true, editDept: { ...dept, organizationId: selectedOrg.id } })}
            onDeleteDept={(dept) => checkBeforeDelete("dept", dept.id, dept.name)}
          />
        )}
      </Sheet>

      {/* Modals */}
      {orgModal.open && (
        <OrgFormModal
          initialData={orgModal.editOrg}
          onSubmit={handleOrgSubmit}
          onCancel={() => setOrgModal({ open: false })}
        />
      )}

      {deptModal.open && (
        <DeptFormModal
          initialData={deptModal.editDept}
          departments={departments}
          organizations={organizations}
          users={users}
          selectedOrgId={selectedOrgId}
          onSubmit={handleDeptSubmit}
          onCancel={() => setDeptModal({ open: false })}
        />
      )}

      {deleteConfirm.open && (
        <DeleteConfirmationModal
          name={deleteConfirm.name}
          warning={deleteConfirm.warning}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ open: false, type: "org", id: "", name: "" })}
        />
      )}
    </div>
  );
}

interface OrganizationCardProps {
  org: OrganizationRecord;
  index: number;
  deptCount: number;
  members: User[];
  canManage: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function OrganizationCard({ org, index, deptCount, members, canManage, canDelete, onOpen, onEdit, onDelete }: OrganizationCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <GlassCard
      role="button"
      tabIndex={0}
      aria-label={`View ${org.name}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="card-stagger group p-4 flex flex-col cursor-pointer hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Icon name="account_balance" size={17} className="text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-slate-800 truncate group-hover:text-slate-900">{org.name}</h3>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {org.contactEmail || org.address || "No contact details"}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200">
          <Icon name="layers" size={10} />
          {deptCount} dept{deptCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Department chips */}
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[26px]">
        {org.departments.length > 0 ? (
          <>
            {org.departments.slice(0, 4).map((dept, i) => {
              const color = getDepartmentColor(i);
              return (
                <span
                  key={dept.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                  title={`${dept.name} (${dept.code})`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                  {dept.name}
                </span>
              );
            })}
            {org.departments.length > 4 && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                +{org.departments.length - 4} more
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-slate-400 italic">No departments yet</span>
        )}
      </div>

      {/* Footer: members + actions */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {members.length > 0 ? (
            <>
              <AvatarStack people={members} limit={3} size="sm" />
              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 italic">No members</span>
          )}
        </div>

        {/* Actions — delete always visible (permission-gated), view/edit on hover */}
        <HoverActions
          entity="organizations"
          always={
            canDelete
              ? [{ icon: "delete", label: "Delete organization", tone: "danger", onClick: onDelete }]
              : []
          }
          onHover={[
            { icon: "view", label: "View organization", onClick: onOpen },
            ...(canManage ? [{ icon: "edit", label: "Edit organization", onClick: onEdit }] : []),
          ]}
        />
      </div>
    </GlassCard>
  );
}
