import { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import type { Department, OrganizationRecord, User } from "../../types";
import {
    AnimatedBackground,
    GlassCard,
    useNavHeader,
    LoadingPage,
    DeleteConfirmationModal,
    DeptFormModal,
    EmptyState,
    FilterBar,
    FilterDropdown,
    ViewToggle,
    PageAction,
    PageContainer,
    Sheet,
    StatCard,
    PERMISSION_GROUPS,
    usePermission,
    useToast,
} from "../shared";
import { useUserOrganization } from "../shared/useUserOrganization";
import { DepartmentDetailCard } from "./DepartmentDetailCard";
import { DepartmentList } from "./DepartmentList";
import { DepartmentCard } from "../organisations/DepartmentCard";

type ViewMode = "card" | "list";

export function DepartmentsPage() {
    const { auth } = useAuth();
    const perm = usePermission();
    const canCreateDepartments = perm.has(PERMISSION_GROUPS.department.create);
    const canDeleteDepartments = perm.has(PERMISSION_GROUPS.department.delete);
    const canEditDepartments = perm.has(PERMISSION_GROUPS.department.edit);
    const canViewManagementData = perm.hasAny(
        PERMISSION_GROUPS.project.view,
        PERMISSION_GROUPS.department.view,
        PERMISSION_GROUPS.user.view,
    );

    const [departments, setDepartments] = useState<Department[]>([]);
    const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState("");
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("card");
    const [detailOpen, setDetailOpen] = useState(false);
    const [deptModal, setDeptModal] = useState<{ open: boolean; editDept?: Department }>({ open: false });

    const { setNavHeader } = useNavHeader();

    useEffect(() => {
        setNavHeader({
            title: "Departments",
            description: "Manage departments across all organizations",
            action: canCreateDepartments ? {
                label: "New Department",
                onClick: () => setDeptModal({ open: true }),
                icon: "add",
            } : undefined,
        });
    }, [setNavHeader, canCreateDepartments]);

    const [deleteConfirm, setDeleteConfirm] = useState<{
        open: boolean;
        id: string;
        name: string;
    }>({ open: false, id: "", name: "" });

    const { isOrgAdmin, userOrganizationId, shouldFilterByOrg } = useUserOrganization(users, departments);

    const loadData = (preferredDeptId?: string) => {
        if (!auth) return;
        setLoading(true);
        Promise.all([
            api.getDepartments(auth.token),
            api.getOrganizations(auth.token),
            canViewManagementData ? api.getUsers(auth.token) : Promise.resolve([]),
        ])
            .then(([departmentData, organizationData, userData]) => {
                setDepartments(departmentData);
                setOrganizations(organizationData);
                setUsers(userData);

                const nextDeptId = preferredDeptId || selectedDeptId;
                if (nextDeptId && departmentData.some((department) => department.id === nextDeptId)) {
                    setSelectedDeptId(nextDeptId);
                } else if (departmentData.length) {
                    setSelectedDeptId(departmentData[0].id);
                } else {
                    setSelectedDeptId("");
                }
            })
            .catch((e) => addToast(`Error: ${e instanceof Error ? e.message : "Failed to load departments"}`, "error"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth, canViewManagementData]);

    useEffect(() => {
        if (shouldFilterByOrg && userOrganizationId && !selectedOrgId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedOrgId(userOrganizationId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldFilterByOrg, userOrganizationId]);

    // Load dashboard for selected department
    useEffect(() => {
        if (!auth || !selectedDeptId || !canViewManagementData) return;
        api.getDepartmentDashboard(auth.token, selectedDeptId).then(setDashboard).catch(() => setDashboard(null));
    }, [auth, selectedDeptId, canViewManagementData]);

    const filteredDepartments = useMemo(() => {
        let filtered = departments;
        if (shouldFilterByOrg && userOrganizationId) {
            filtered = filtered.filter(d => d.organizationId === userOrganizationId);
        }
        if (selectedOrgId) {
            filtered = filtered.filter(d => d.organizationId === selectedOrgId);
        }
        const term = searchTerm.trim().toLowerCase();
        if (term) {
            filtered = filtered.filter(d =>
                d.name.toLowerCase().includes(term) ||
                d.code.toLowerCase().includes(term) ||
                (d.description ?? "").toLowerCase().includes(term));
        }
        return filtered;
    }, [departments, selectedOrgId, searchTerm, shouldFilterByOrg, userOrganizationId]);

    const selectedDepartment = departments.find((d) => d.id === selectedDeptId) ?? null;
    const selectedOrganization = organizations.find((o) => o.id === (selectedOrgId || selectedDepartment?.organizationId));
    const selectedTeamMembers = selectedDepartment
        ? users.filter((user) =>
            user.departmentId === selectedDepartment.id ||
            user.departments?.some((department) => department.departmentId === selectedDepartment.id))
        : [];
    const canEditSelectedDepartment = Boolean(selectedDepartment && canEditDepartments);

    const departmentHead = selectedDepartment?.departmentHeadUserId
        ? users.find((u) => u.id === selectedDepartment.departmentHeadUserId)
        : undefined;

    const parentDepartment = selectedDepartment?.parentDepartmentId
        ? departments.find((d) => d.id === selectedDepartment.parentDepartmentId)
        : undefined;

    const childCount = departments.filter((d) => d.parentDepartmentId === selectedDeptId).length;

    // Aggregate metrics for stats row
    const stats = useMemo(() => {
        const memberIds = new Set<string>();
        filteredDepartments.forEach((d) => {
            users.forEach((u) => {
                if (u.departmentId === d.id || u.departments?.some((ud) => ud.departmentId === d.id)) {
                    memberIds.add(u.id);
                }
            });
        });
        const avg = filteredDepartments.length ? memberIds.size / filteredDepartments.length : 0;
        return {
            departments: filteredDepartments.length,
            members: memberIds.size,
            avgMembersPerDept: avg ? Math.round(avg * 10) / 10 : 0,
            organizations: organizations.length,
        };
    }, [filteredDepartments, users, organizations]);

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

    const orgOptions = useMemo(
        () => organizations.map((org) => ({ value: org.id, label: org.name })),
        [organizations],
    );

    void isOrgAdmin;

    const handleDelete = async () => {
        if (!auth) return;
        try {
            await api.deleteDepartment(auth.token, deleteConfirm.id);
            addToast("Department deleted successfully.");
            setDeleteConfirm({ open: false, id: "", name: "" });
            if (selectedDeptId === deleteConfirm.id) setSelectedDeptId("");
            setDetailOpen(false);
            loadData();
        } catch (e) {
            addToast(`Error: ${e instanceof Error ? e.message : "Deletion failed"}`, "error");
        }
    };

    const handleDeptSubmit = async (form: Record<string, unknown>) => {
        if (!auth) return;
        try {
            const payload = { ...form };
            let nextDeptId = selectedDeptId;
            if (deptModal.editDept) {
                await api.updateDepartment(auth.token, deptModal.editDept.id, payload);
                nextDeptId = deptModal.editDept.id;
            } else {
                const newDept = await api.createDepartment(auth.token, payload);
                nextDeptId = newDept.id || selectedDeptId;
                setSelectedDeptId(nextDeptId);
            }
            setDeptModal({ open: false });
            loadData(nextDeptId);
            addToast(deptModal.editDept ? "Department updated." : "Department created.");
        } catch (e) {
            addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
        }
    };

    const openDeptDetail = (deptId: string) => {
        setSelectedDeptId(deptId);
        setDetailOpen(true);
    };

    if (loading) return <LoadingPage label="Loading departments..." />;

    return (
        <div className="relative">
            <AnimatedBackground />

            <PageContainer
                stats={
                    <>
                        <StatCard label="Departments" value={stats.departments} color="indigo" icon="groups" />
                        <StatCard label="Team Members" value={stats.members} color="emerald" icon="people" />
                        <StatCard label="Avg Members / Dept" value={stats.avgMembersPerDept} color="violet" icon="monitoring" />
                        <StatCard label="Organizations" value={stats.organizations} color="amber" icon="corporate_fare" />
                    </>
                }
                filters={
                    <FilterBar
                        searchValue={searchTerm}
                        onSearchChange={setSearchTerm}
                        searchPlaceholder="Search departments..."
                        leftExtras={
                            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                                {filteredDepartments.length} of {departments.length}
                            </span>
                        }
                        actions={
                            <>
                                {perm.isSuperAdmin && (
                                    <FilterDropdown
                                        value={selectedOrgId}
                                        onChange={setSelectedOrgId}
                                        label="Org"
                                        icon="corporate_fare"
                                        options={orgOptions}
                                    />
                                )}
                                <ViewToggle value={viewMode} onChange={(mode) => setViewMode(mode as ViewMode)} available={["card", "list"]} />
                                {canCreateDepartments && (
                                    <PageAction
                                        label="New department"
                                        icon="add"
                                        onClick={() => setDeptModal({ open: true })}
                                    />
                                )}
                            </>
                        }
                    />
                }
            >
                {departments.length === 0 ? (
                    <GlassCard className="min-h-80 flex items-center justify-center">
                        <EmptyState
                            icon="groups"
                            title="No departments yet"
                            description="Create your first department to start organizing teams, projects, and workloads."
                            accent="primary"
                            action={
                                canCreateDepartments ? (
                                    <PageAction label="New department" icon="add" onClick={() => setDeptModal({ open: true })} />
                                ) : undefined
                            }
                        />
                    </GlassCard>
                ) : filteredDepartments.length === 0 ? (
                    <GlassCard className="min-h-80 flex items-center justify-center">
                        <EmptyState
                            icon="search_off"
                            title="No departments match the current filters"
                            description="Try a different search term, or clear the filters to see all departments."
                            compact
                            action={
                                (searchTerm || selectedOrgId) ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm("");
                                            setSelectedOrgId("");
                                        }}
                                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                                    >
                                        Clear filters
                                    </button>
                                ) : undefined
                            }
                        />
                    </GlassCard>
                ) : viewMode === "card" ? (
                    <div className="view-fade grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredDepartments.map((dept, index) => (
                            <DepartmentCard
                                key={dept.id}
                                department={dept}
                                index={index}
                                isAdmin={canEditDepartments}
                                canEdit={canEditDepartments}
                                canDelete={canDeleteDepartments}
                                onEdit={(d) => setDeptModal({ open: true, editDept: d })}
                                onDelete={(d) => setDeleteConfirm({ open: true, id: d.id, name: d.name })}
                                teamMembers={membersByDept.get(dept.id) ?? []}
                                organizationName={dept.organizationId ? orgNameById.get(dept.organizationId) : undefined}
                                onOpen={() => openDeptDetail(dept.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="view-fade">
                        <DepartmentList
                            departments={filteredDepartments}
                            selectedDeptId={selectedDeptId}
                            onSelectDept={openDeptDetail}
                            organizations={organizations}
                            users={users}
                            canEdit={canEditDepartments}
                            canDelete={canDeleteDepartments}
                            onEdit={(dept) => setDeptModal({ open: true, editDept: dept })}
                            onDelete={(dept) => setDeleteConfirm({ open: true, id: dept.id, name: dept.name })}
                        />
                    </div>
                )}
            </PageContainer>

            {/* Department detail — right sheet */}
            <Sheet
                open={detailOpen && !!selectedDepartment}
                onClose={() => setDetailOpen(false)}
                size="lg"
                icon="groups"
                accent="primary"
                title={selectedDepartment?.name}
                description={
                    selectedDepartment
                        ? `${selectedDepartment.code}${selectedOrganization ? ` · ${selectedOrganization.name}` : ""}`
                        : undefined
                }
            >
                {selectedDepartment && (
                    <DepartmentDetailCard
                        department={selectedDepartment}
                        organization={selectedOrganization}
                        departmentHead={departmentHead}
                        parentDepartment={parentDepartment}
                        childCount={childCount}
                        teamMembers={selectedTeamMembers}
                        dashboard={dashboard}
                        canEdit={canEditSelectedDepartment}
                        canDelete={canDeleteDepartments}
                        onEdit={() => setDeptModal({ open: true, editDept: selectedDepartment })}
                        onDelete={() => setDeleteConfirm({
                            open: true,
                            id: selectedDepartment.id,
                            name: selectedDepartment.name,
                        })}
                        allDepartments={departments}
                        allUsers={users}
                        allOrganizations={organizations}
                        canManageUsers={canEditDepartments}
                        isSuperAdmin={hasRoleKey(perm.roleKeys, RoleKey.SuperAdmin)}
                        onRefresh={() => loadData(selectedDeptId)}
                    />
                )}
            </Sheet>

            {/* Modals */}
            {deptModal.open && (
                <DeptFormModal
                    initialData={deptModal.editDept}
                    departments={departments}
                    organizations={organizations}
                    users={users}
                    selectedOrgId={selectedOrgId}
                    showOrganization={hasRoleKey(perm.roleKeys, RoleKey.SuperAdmin)}
                    onSubmit={handleDeptSubmit}
                    onCancel={() => setDeptModal({ open: false })}
                />
            )}

            {deleteConfirm.open && (
                <DeleteConfirmationModal
                    name={deleteConfirm.name}
                    warning="Deleting this department may affect assigned projects and team members."
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm({ open: false, id: "", name: "" })}
                />
            )}
        </div>
    );
}
