import { useEffect, useState, useMemo } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RoleKey, hasRoleKey } from "../../permissions";
import type { Department, OrganizationRecord, User } from "../../types";
import { Icon } from "../../components/ui/Icon";
import {
    AnimatedBackground,
    GlassCard,
    useNavHeader,
    LoadingPage,
    ModalOverlay,
    DeleteConfirmationModal,
    DeptFormModal,
    PERMISSION_GROUPS,
    usePermission,
    useToast,
} from "../shared";
import { useUserOrganization } from "../shared/useUserOrganization";
import { DepartmentDetailCard } from "./DepartmentDetailCard";
import { DepartmentList } from "./DepartmentList";


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

    useEffect(() => { loadData(); }, [auth, canViewManagementData]);

    useEffect(() => {
        if (shouldFilterByOrg && userOrganizationId && !selectedOrgId) {
            setSelectedOrgId(userOrganizationId);
        }
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
        return filtered;
    }, [departments, selectedOrgId, shouldFilterByOrg, userOrganizationId]);

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

    const handleDelete = async () => {
        if (!auth) return;
        try {
            await api.deleteDepartment(auth.token, deleteConfirm.id);
            addToast("Department deleted successfully.");
            setDeleteConfirm({ open: false, id: "", name: "" });
            if (selectedDeptId === deleteConfirm.id) setSelectedDeptId("");
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

    if (loading) return <LoadingPage label="Loading departments..." />;

    return (
        <div>
            <AnimatedBackground />





            {/* Main Layout */}
            <div className="grid grid-cols-[320px_1fr] gap-6 relative z-10">
                {/* Left Panel: Department List */}
                <DepartmentList
                    departments={filteredDepartments}
                    // users={users}cls
                    
                    selectedDeptId={selectedDeptId}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    onSelectDept={setSelectedDeptId}
                    organizationName={selectedOrgId ? selectedOrganization?.name : "All Departments"}
                    organizations={organizations}
                    selectedOrgId={selectedOrgId}
                    onSelectOrg={setSelectedOrgId}
                    isSuperAdmin={perm.isSuperAdmin}
                />

                {/* Right Panel: Department Detail */}
                <div className="flex flex-col gap-5">
                    {selectedDepartment ? (
                        <>

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


                        </>
                    ) : (
                        <GlassCard className="p-16 text-center flex flex-col items-center justify-center flex-1 min-h-96">
                            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
                                <Icon name="groups" size={28} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Department</h3>
                            <p className="text-sm text-slate-400 ">
                                Choose a department from the left panel to view its details and metrics
                            </p>
                        </GlassCard>
                    )}
                </div>
            </div>

            {/* Modals */}
            {deptModal.open && (
                <ModalOverlay onClose={() => setDeptModal({ open: false })}>
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
                </ModalOverlay>
            )}

            {deleteConfirm.open && (
                <ModalOverlay onClose={() => setDeleteConfirm({ open: false, id: "", name: "" })}>
                    <DeleteConfirmationModal
                        name={deleteConfirm.name}
                        warning="Deleting this department may affect assigned projects and team members."
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteConfirm({ open: false, id: "", name: "" })}
                    />
                </ModalOverlay>
            )}
        </div>
    );
}
