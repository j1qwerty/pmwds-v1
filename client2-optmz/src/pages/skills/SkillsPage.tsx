import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, SkillRecord, User } from "../../types";
import { Icon } from "../../components/ui/Icon";
import {
  AnimatedBackground,
  GlassCard,
  PageSkeleton,
  useNavHeader,
  DeleteConfirmationModal,
  PERMISSION_GROUPS,
  usePermission,
  Avatar,
  useToast,
  PageContainer,
  SectionCard,
  StatCard,
  FilterBar,
  FilterDropdown,
  ViewToggle,
  EmptyState,
  TabButton,
  Sheet,
  type ViewMode,
} from "../shared";
import { SkillFormModal } from "./SkillFormModal";

const PROF_INPUT =
  "w-11 h-8 px-1 rounded-md bg-slate-50 border border-slate-200 text-center text-[11px] font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const EXP_INPUT =
  "w-14 h-8 px-1 rounded-md bg-slate-50 border border-slate-200 text-center text-[11px] font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

const STEP_BUTTON =
  "size-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-colors";

export function SkillsPage() {
  const { auth } = useAuth();
  const perm = usePermission();
  const canManage = perm.hasAny(PERMISSION_GROUPS.system.manage, PERMISSION_GROUPS.user.edit);
  const canWrite = canManage;

  const canDeleteSkill = (skill: SkillRecord) =>
    perm.isSuperAdmin ||
    (perm.has(PERMISSION_GROUPS.user.edit) && (skill.createdBy === auth?.userId || Boolean(skill.organizationId)));

  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"skill" | "user">("user");
  const [view, setView] = useState<ViewMode>("card");

  const [skillModal, setSkillModal] = useState<{ open: boolean; editSkill?: SkillRecord }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; skill: SkillRecord | null }>({ open: false, skill: null });

  const [newUserId, setNewUserId] = useState("");
  const [newProficiency, setNewProficiency] = useState(3);
  const [newExperience, setNewExperience] = useState(12);

  const [userSearch, setUserSearch] = useState("");
  const [userOrgFilter, setUserOrgFilter] = useState("");
  const [userDeptFilter, setUserDeptFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [newUserSkillId, setNewUserSkillId] = useState("");
  const [newUserSkillProf, setNewUserSkillProf] = useState(3);
  const [newUserSkillExp, setNewUserSkillExp] = useState(12);

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: "Skills",
      description: "Manage the skill catalogue and user assignments",
      action: canWrite ? {
        label: "New skill",
        onClick: () => setSkillModal({ open: true }),
        icon: "add",
      } : undefined,
    });
  }, [setNavHeader, canWrite]);

  const loadData = () => {
    if (!auth) return;
    setLoading(true);
    Promise.all([
      api.getSkills(auth.token),
      api.getUsers(auth.token),
      api.getDepartments(auth.token),
      api.getOrganizations(auth.token),
    ])
      .then(([skillData, userData, deptData, orgData]) => {
        setSkills(skillData);
        setUsers(userData);
        setDepartments(deptData);
        setOrganizations(orgData);
      })
      .catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to load data.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [auth]);

  const categories = [...new Set(skills.map(s => s.category).filter(Boolean))];

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = !searchTerm ||
      skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (skill.description && skill.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const skillUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const user of users) {
      for (const sd of user.skillDetails || []) {
        counts[sd.skillId] = (counts[sd.skillId] || 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const selectedSkill = skills.find(s => s.id === selectedSkillId) || null;

  const assignedUsers = useMemo(() => {
    if (!selectedSkillId) return [];
    return users.filter(u =>
      u.skillDetails?.some(s => s.skillId === selectedSkillId)
    );
  }, [users, selectedSkillId]);

  const unassignedUsers = useMemo(() => {
    if (!selectedSkillId) return [];
    return users.filter(u =>
      u.isActive !== false && !u.skillDetails?.some(s => s.skillId === selectedSkillId)
    );
  }, [users, selectedSkillId]);

  const getUserAssignment = (user: User, skillId: string) => {
    return user.skillDetails?.find(s => s.skillId === skillId) || null;
  };

  const filteredDepts = userOrgFilter
    ? departments.filter(d => d.organizationId === userOrgFilter)
    : departments;

  const filteredUsers = users.filter(user => {
    if (user.isActive === false) return false;
    const matchesSearch = !userSearch ||
      user.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(userSearch.toLowerCase()));
    const userDeptIds = user.departments?.map(d => d.departmentId) || [];
    const matchesDept = !userDeptFilter || userDeptIds.includes(userDeptFilter) || user.departmentId === userDeptFilter;
    const userOrgId = user.organizationId ?? departments.find(d => d.id === user.departmentId)?.organizationId;
    const matchesOrg = !userOrgFilter || userOrgId === userOrgFilter;
    return matchesSearch && matchesDept && matchesOrg;
  });

  const selectedUser = users.find(u => u.id === selectedUserId) || null;

  const skillsNotAssignedToUser = useMemo(() => {
    if (!selectedUserId) return [];
    const user = users.find(u => u.id === selectedUserId);
    const userSkillIds = new Set(user?.skillDetails?.map(s => s.skillId) || []);
    return skills.filter(s => !userSkillIds.has(s.id));
  }, [skills, users, selectedUserId]);

  const handleSkillSubmit = async (payload: Record<string, unknown>) => {
    if (!auth) return;
    try {
      if (skillModal.editSkill) {
        await api.updateSkill(auth.token, skillModal.editSkill.id, payload);
        addToast("Skill updated successfully.");
    } else {
        await api.createSkill(auth.token, payload);
        addToast("Skill created successfully.");
      }
      setSkillModal({ open: false });
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!auth || !deleteConfirm.skill) return;
    try {
      await api.deleteSkill(auth.token, deleteConfirm.skill.id);
      addToast("Skill deleted successfully.");
      setDeleteConfirm({ open: false, skill: null });
      if (selectedSkillId === deleteConfirm.skill.id) setSelectedSkillId(null);
      loadData();
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Deletion failed"}`, "error");
    }
  };

  const handleAssignSkill = async () => {
    if (!auth || !selectedSkillId || !newUserId) return;
    try {
      await api.addUserSkill(auth.token, newUserId, selectedSkillId, newProficiency, newExperience);
      setUsers(prev => prev.map(u => {
        if (u.id !== newUserId) return u;
        return {
          ...u,
          skillDetails: [...(u.skillDetails || []), { skillId: selectedSkillId, skillName: selectedSkill?.name || "", proficiencyLevel: newProficiency, experienceMonths: newExperience }]
        };
      }));
      addToast("Skill assigned successfully.");
      setNewUserId("");
      setNewProficiency(3);
      setNewExperience(12);
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Assignment failed"}`, "error");
    }
  };

  const handleUpdateAssignment = async (userId: string, skillId: string, proficiencyLevel: number, experienceMonths: number) => {
    if (!auth) return;
    try {
      await api.updateUserSkill(auth.token, userId, skillId, proficiencyLevel, experienceMonths);
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          skillDetails: (u.skillDetails || []).map(s =>
            s.skillId === skillId ? { ...s, proficiencyLevel, experienceMonths } : s
          )
        };
      }));
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Update failed"}`, "error");
    }
  };

  const handleRemoveAssignment = async (userId: string, skillId: string) => {
    if (!auth) return;
    try {
      await api.removeUserSkill(auth.token, userId, skillId);
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          skillDetails: (u.skillDetails || []).filter(s => s.skillId !== skillId)
        };
      }));
      addToast("Skill assignment removed.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Removal failed"}`, "error");
    }
  };

  const handleAssignSkillToUser = async () => {
    if (!auth || !selectedUserId || !newUserSkillId) return;
    try {
      await api.addUserSkill(auth.token, selectedUserId, newUserSkillId, newUserSkillProf, newUserSkillExp);
      const newSkill = skills.find(s => s.id === newUserSkillId);
      setUsers(prev => prev.map(u => {
        if (u.id !== selectedUserId) return u;
        return {
          ...u,
          skillDetails: [...(u.skillDetails || []), { skillId: newUserSkillId, skillName: newSkill?.name || "", proficiencyLevel: newUserSkillProf, experienceMonths: newUserSkillExp }]
        };
      }));
      addToast("Skill assigned successfully.");
      setNewUserSkillId("");
      setNewUserSkillProf(3);
      setNewUserSkillExp(12);
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Assignment failed"}`, "error");
    }
  };

  // ── Derived stats (presentation) ──
  const totalAssignments = useMemo(
    () => Object.values(skillUserCounts).reduce((sum, n) => sum + n, 0),
    [skillUserCounts]
  );
  const usersWithSkills = useMemo(
    () => users.filter((u) => (u.skillDetails?.length ?? 0) > 0).length,
    [users]
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const skill of skills) {
      if (skill.category) counts[skill.category] = (counts[skill.category] || 0) + 1;
    }
    return counts;
  }, [skills]);
  const chipCategories = categories.slice(0, 7);
  const hasMoreCategories = categories.length > chipCategories.length;

  const openSkill = (skill: SkillRecord) => {
    setSelectedSkillId(skill.id);
    setRightTab("skill");
  };

  const clearSkillFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
  };

  if (loading) return <PageSkeleton />;

  const statsRow = (
    <>
      <StatCard label="Total skills" value={skills.length} color="indigo" icon="school" />
      <StatCard label="Categories" value={categories.length} color="violet" icon="layers" />
      <StatCard label="Assignments" value={totalAssignments} color="emerald" icon="group" />
      <StatCard label="People with skills" value={usersWithSkills} color="amber" icon="person" />
    </>
  );

  return (
    <div>
      <AnimatedBackground />

      <PageContainer
        stats={statsRow}
        filters={
          rightTab === "skill" ? (
            <FilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search skills..."
              chipGroups={[
                {
                  key: "category",
                  options: [
                    { value: "", label: "All", count: skills.length },
                    ...chipCategories.map((cat) => ({ value: cat, label: cat, count: categoryCounts[cat] ?? 0 })),
                  ],
                  value: selectedCategory,
                  onChange: setSelectedCategory,
                },
              ]}
              leftExtras={<span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{filteredSkills.length} skill{filteredSkills.length !== 1 ? "s" : ""}</span>}
              actions={
                <>
                  {hasMoreCategories && (
                    <FilterDropdown
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                      options={categories.map((cat) => ({ value: cat, label: cat }))}
                      label="Category"
                      icon="layers"
                    />
                  )}
                  <ViewToggle value={view} onChange={setView} available={["card", "list"]} />
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setSkillModal({ open: true })}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                    >
                      <Icon name="add" size={14} />
                      New skill
                    </button>
                  )}
                </>
              }
            />
          ) : (
            <FilterBar
              searchValue={userSearch}
              onSearchChange={setUserSearch}
              searchPlaceholder="Search users..."
              leftExtras={<span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}</span>}
              actions={
                <>
                  <FilterDropdown
                    value={userOrgFilter}
                    onChange={(value) => { setUserOrgFilter(value); setUserDeptFilter(""); }}
                    options={organizations.map((org) => ({ value: org.id, label: org.name }))}
                    label="Organization"
                    icon="account_balance"
                  />
                  <FilterDropdown
                    value={userDeptFilter}
                    onChange={setUserDeptFilter}
                    options={filteredDepts.map((dept) => ({ value: dept.id, label: dept.name }))}
                    label="Department"
                    icon="groups"
                  />
                </>
              }
            />
          )
        }
      >
        {/* Mode tabs */}
        <div className="flex items-end gap-1 mb-0 -mb-px relative z-10">
          <TabButton
            active={rightTab === "skill"}
            onClick={() => setRightTab("skill")}
            icon="school"
            label="By skill"
            count={skills.length}
          />
          <TabButton
            active={rightTab === "user"}
            onClick={() => setRightTab("user")}
            icon="people"
            label="By user"
            count={users.length}
          />
        </div>

        {/* ============ BY SKILL ============ */}
        {rightTab === "skill" && (
          <div key={view} className="view-fade">
            {skills.length === 0 ? (
              <GlassCard>
                <EmptyState
                  icon="school"
                  title="No skills yet"
                  description="Create the first skill to start building your team's expertise catalogue."
                  action={canWrite ? (
                    <button
                      type="button"
                      onClick={() => setSkillModal({ open: true })}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                    >
                      <Icon name="add" size={14} />
                      New skill
                    </button>
                  ) : undefined}
                />
              </GlassCard>
            ) : filteredSkills.length === 0 ? (
              <GlassCard>
                <EmptyState
                  icon="search_off"
                  title="No skills match the current filters"
                  description="Try a different search term or category."
                  action={
                    <button
                      type="button"
                      onClick={clearSkillFilters}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <Icon name="filter_alt_off" size={14} />
                      Clear filters
                    </button>
                  }
                />
              </GlassCard>
            ) : view === "card" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSkills.map((skill, i) => {
                  const realUserCount = skillUserCounts[skill.id] || 0;
                  const isSelected = selectedSkillId === skill.id && rightTab === "skill";
                  return (
                    <GlassCard
                      key={skill.id}
                      className={`p-4 cursor-pointer card-stagger transition-all ${isSelected ? "ring-2 ring-indigo-200 border-indigo-200" : "hover:border-indigo-200"}`}
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      onClick={() => openSkill(skill)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSkill(skill); } }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                          <Icon name="school" size={18} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">{skill.name}</p>
                            {skill.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
                                {skill.category}
                              </span>
                            )}
                          </div>
                          {skill.description ? (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{skill.description}</p>
                          ) : (
                            <p className="text-xs text-slate-300 italic mt-1">No description</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          <Icon name="group" size={13} className="text-slate-400" />
                          {realUserCount} user{realUserCount !== 1 ? "s" : ""}
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSkillModal({ open: true, editSkill: skill }); }}
                              className="size-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
                              title="Edit skill"
                              aria-label={`Edit skill: ${skill.name}`}
                            >
                              <Icon name="edit" size={14} className="text-slate-500" />
                            </button>
                            {canDeleteSkill(skill) && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, skill }); }}
                                className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Delete skill"
                                aria-label={`Delete skill: ${skill.name}`}
                              >
                                <Icon name="delete" size={14} className="text-red-500" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            ) : (
              <GlassCard className="overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {filteredSkills.map((skill, i) => {
                    const realUserCount = skillUserCounts[skill.id] || 0;
                    const isSelected = selectedSkillId === skill.id && rightTab === "skill";
                    return (
                      <div
                        key={skill.id}
                        onClick={() => openSkill(skill)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSkill(skill); } }}
                        className={`flex items-center gap-3 py-3 px-4 cursor-pointer hover:bg-slate-50/70 transition-colors card-stagger ${isSelected ? "bg-indigo-50/50" : ""}`}
                        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      >
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                          <Icon name="school" size={16} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{skill.name}</p>
                            {skill.category && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
                                {skill.category}
                              </span>
                            )}
                          </div>
                          {skill.description && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">{skill.description}</p>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 shrink-0">
                          <Icon name="group" size={13} className="text-slate-400" />
                          {realUserCount}
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSkillModal({ open: true, editSkill: skill }); }}
                              className="size-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
                              title="Edit skill"
                              aria-label={`Edit skill: ${skill.name}`}
                            >
                              <Icon name="edit" size={14} className="text-slate-500" />
                            </button>
                            {canDeleteSkill(skill) && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, skill }); }}
                                className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                title="Delete skill"
                                aria-label={`Delete skill: ${skill.name}`}
                              >
                                <Icon name="delete" size={14} className="text-red-500" />
                              </button>
                            )}
                          </div>
                        )}
                        <Icon name="chevron_right" size={16} className="text-slate-300 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ============ BY USER ============ */}
        {rightTab === "user" && (
          <GlassCard className="p-5 md:p-6 view-fade">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* User list */}
              <div className="lg:col-span-1 max-h-[520px] overflow-y-auto space-y-1 pr-1">
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    icon="search_off"
                    title="No users found"
                    description="Try adjusting the search or organization filters."
                    compact
                  />
                ) : (
                  filteredUsers.map((user, i) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all card-stagger ${
                        selectedUserId === user.id
                          ? "border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-100"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                      style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar person={user} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 truncate">{user.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                        </div>
                        {selectedUserId === user.id && (
                          <Icon name="chevron_right" size={15} className="text-indigo-500 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Selected user skills */}
              <div className="lg:col-span-2">
                {!selectedUser ? (
                  <EmptyState
                    icon="touch_app"
                    title="Select a user"
                    description="Pick a person from the list to view and manage their skills."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <Avatar person={selectedUser} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800">{selectedUser.fullName}</p>
                        <p className="text-[11px] text-slate-400">
                          {selectedUser.skillDetails?.length || 0} skill{(selectedUser.skillDetails?.length || 0) !== 1 ? "s" : ""} assigned
                        </p>
                      </div>
                    </div>

                    {(!selectedUser.skillDetails || selectedUser.skillDetails.length === 0) ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                        <Icon name="school" size={22} className="text-slate-300 mb-1 mx-auto" />
                        <p className="text-xs text-slate-400">No skills assigned to this user yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                        {selectedUser.skillDetails.map((skill, i) => (
                          <div
                            key={skill.skillId}
                            className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors card-stagger"
                            style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                              <Icon name="school" size={14} className="text-indigo-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700">{skill.skillName}</p>
                            </div>

                            {canManage ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Prof</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={skill.proficiencyLevel}
                                    onChange={(e) => {
                                      const val = Math.min(5, Math.max(1, Number(e.target.value)));
                                      handleUpdateAssignment(selectedUser.id, skill.skillId, val, skill.experienceMonths);
                                    }}
                                    className={PROF_INPUT}
                                    title="Value 1-5"
                                    aria-label={`${skill.skillName} proficiency for ${selectedUser.fullName}`}
                                  />
                                  <span className="text-[10px] text-slate-400">/5</span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Exp</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateAssignment(selectedUser.id, skill.skillId, skill.proficiencyLevel, Math.max(0, skill.experienceMonths - 1));
                                    }}
                                    className={STEP_BUTTON}
                                    title="Decrease experience"
                                    aria-label="Decrease experience"
                                  >
                                    <Icon name="remove" size={11} />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={600}
                                    value={skill.experienceMonths}
                                    onChange={(e) => {
                                      handleUpdateAssignment(selectedUser.id, skill.skillId, skill.proficiencyLevel, e.target.value === "" ? 0 : Number(e.target.value));
                                    }}
                                    className={EXP_INPUT}
                                    aria-label={`${skill.skillName} experience months for ${selectedUser.fullName}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateAssignment(selectedUser.id, skill.skillId, skill.proficiencyLevel, Math.min(600, skill.experienceMonths + 1));
                                    }}
                                    className={STEP_BUTTON}
                                    title="Increase experience"
                                    aria-label="Increase experience"
                                  >
                                    <Icon name="add" size={11} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignment(selectedUser.id, skill.skillId)}
                                  className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                                  title="Remove skill from user"
                                  aria-label={`Remove ${skill.skillName} from ${selectedUser.fullName}`}
                                >
                                  <Icon name="close" size={14} className="text-red-500" />
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span>Prof: {skill.proficiencyLevel}/5</span>
                                <span>Exp: {skill.experienceMonths}mo</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assign new skill */}
                    {canManage && skillsNotAssignedToUser.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                          Assign new skill
                        </h5>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="relative flex-1 min-w-[150px]">
                            <select
                              value={newUserSkillId}
                              onChange={(e) => setNewUserSkillId(e.target.value)}
                              className="w-full h-9 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                              aria-label="Skill to assign"
                            >
                              <option value="">Select skill...</option>
                              {skillsNotAssignedToUser.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <Icon name="expand_more" size={15} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prof</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={newUserSkillProf}
                              onChange={(e) => setNewUserSkillProf(Math.min(5, Math.max(1, Number(e.target.value))))}
                              className={PROF_INPUT}
                              title="Value 1-5"
                              aria-label="Proficiency level"
                            />
                            <span className="text-[10px] text-slate-400">/5</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Exp</label>
                            <button
                              type="button"
                              onClick={() => setNewUserSkillExp(Math.max(0, newUserSkillExp - 1))}
                              className={STEP_BUTTON}
                              title="Decrease experience"
                              aria-label="Decrease experience"
                            >
                              <Icon name="remove" size={11} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={600}
                              value={newUserSkillExp}
                              onChange={(e) => setNewUserSkillExp(e.target.value === "" ? 0 : Number(e.target.value))}
                              className={EXP_INPUT}
                              aria-label="Experience months"
                            />
                            <button
                              type="button"
                              onClick={() => setNewUserSkillExp(Math.min(600, newUserSkillExp + 1))}
                              className={STEP_BUTTON}
                              title="Increase experience"
                              aria-label="Increase experience"
                            >
                              <Icon name="add" size={11} />
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={!newUserSkillId}
                            onClick={handleAssignSkillToUser}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Icon name="add" size={14} />
                            Assign
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        )}
      </PageContainer>

      {/* ── Skill detail sheet ── */}
      <Sheet
        open={rightTab === "skill" && !!selectedSkill}
        onClose={() => setSelectedSkillId(null)}
        title={selectedSkill?.name ?? ""}
        description={selectedSkill?.category ?? undefined}
        icon="school"
        accent="primary"
        size="lg"
      >
        {selectedSkill && (
          <div className="space-y-6">
            {/* Skill meta */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Icon name="school" size={20} className="text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedSkill.category && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
                      {selectedSkill.category}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {assignedUsers.length} user{assignedUsers.length !== 1 ? "s" : ""} assigned
                  </span>
                </div>
                {selectedSkill.description && (
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{selectedSkill.description}</p>
                )}
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setSkillModal({ open: true, editSkill: selectedSkill })}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                >
                  <Icon name="edit" size={14} />
                  Edit skill
                </button>
              )}
            </div>

            {/* Assigned users */}
            <SectionCard
              title="Assigned users"
              description="People who have this skill"
              icon="group"
            >
              {assignedUsers.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  <Icon name="person_off" size={22} className="text-slate-300 mb-1.5 mx-auto" />
                  <p className="text-xs text-slate-400">No users assigned to this skill yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedUsers.map((user) => {
                    const assignment = getUserAssignment(user, selectedSkillId!);
                    if (!assignment) return null;
                    return (
                      <div
                        key={user.id}
                        className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors"
                      >
                        <Avatar person={user} size="sm" className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 truncate">{user.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {user.email} {user.isActive === false && <span className="text-slate-400">(Inactive)</span>}
                          </p>
                        </div>

                        {canManage ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Prof</label>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={assignment.proficiencyLevel}
                                onChange={(e) => {
                                  const val = Math.min(5, Math.max(1, Number(e.target.value)));
                                  handleUpdateAssignment(user.id, selectedSkillId!, val, assignment.experienceMonths);
                                }}
                                className={PROF_INPUT}
                                title="Value 1-5"
                                aria-label={`${selectedSkill?.name} proficiency for ${user.fullName}`}
                              />
                              <span className="text-[10px] text-slate-400">/5</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Exp</label>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateAssignment(user.id, selectedSkillId!, assignment.proficiencyLevel, Math.max(0, assignment.experienceMonths - 1));
                                }}
                                className={STEP_BUTTON}
                                title="Decrease experience"
                                aria-label="Decrease experience"
                              >
                                <Icon name="remove" size={11} />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={600}
                                value={assignment.experienceMonths}
                                onChange={(e) => {
                                  handleUpdateAssignment(user.id, selectedSkillId!, assignment.proficiencyLevel, e.target.value === "" ? 0 : Number(e.target.value));
                                }}
                                className={EXP_INPUT}
                                aria-label={`${selectedSkill?.name} experience months for ${user.fullName}`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateAssignment(user.id, selectedSkillId!, assignment.proficiencyLevel, Math.min(600, assignment.experienceMonths + 1));
                                }}
                                className={STEP_BUTTON}
                                title="Increase experience"
                                aria-label="Increase experience"
                              >
                                <Icon name="add" size={11} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(user.id, selectedSkillId!)}
                              className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                              title="Remove skill from user"
                              aria-label={`Remove ${selectedSkill?.name} from ${user.fullName}`}
                            >
                              <Icon name="close" size={14} className="text-red-500" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>Prof: {assignment.proficiencyLevel}/5</span>
                            <span>Exp: {assignment.experienceMonths}mo</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Assign to user */}
            {canManage && unassignedUsers.length > 0 && (
              <SectionCard
                title="Assign to user"
                description="Add this skill to a user's profile"
                icon="person_add"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="relative flex-1 min-w-[180px]">
                    <select
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                      aria-label="User to assign"
                    >
                      <option value="">Select a user...</option>
                      {unassignedUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </select>
                    <Icon name="expand_more" size={15} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prof</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={newProficiency}
                      onChange={(e) => setNewProficiency(Math.min(5, Math.max(1, Number(e.target.value))))}
                      className={PROF_INPUT}
                      title="Value 1-5"
                      aria-label="Proficiency level"
                    />
                    <span className="text-[10px] text-slate-400">/5</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Exp</label>
                    <button
                      type="button"
                      onClick={() => setNewExperience(Math.max(0, newExperience - 1))}
                      className={STEP_BUTTON}
                      title="Decrease experience"
                      aria-label="Decrease experience"
                    >
                      <Icon name="remove" size={11} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={newExperience}
                      onChange={(e) => setNewExperience(e.target.value === "" ? 0 : Number(e.target.value))}
                      className={EXP_INPUT}
                      aria-label="Experience months"
                    />
                    <button
                      type="button"
                      onClick={() => setNewExperience(Math.min(600, newExperience + 1))}
                      className={STEP_BUTTON}
                      title="Increase experience"
                      aria-label="Increase experience"
                    >
                      <Icon name="add" size={11} />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!newUserId}
                    onClick={handleAssignSkill}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon name="add" size={14} />
                    Assign
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </Sheet>

      {skillModal.open && (
        <SkillFormModal
          initialData={skillModal.editSkill}
          onSubmit={handleSkillSubmit}
          onCancel={() => setSkillModal({ open: false })}
        />
      )}

      {deleteConfirm.open && deleteConfirm.skill && (
        <DeleteConfirmationModal
          name={deleteConfirm.skill.name}
          warning="Deleting this skill will remove it from user profiles that reference it."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ open: false, skill: null })}
        />
      )}
    </div>
  );
}
