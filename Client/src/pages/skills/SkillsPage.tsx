import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { Department, OrganizationRecord, SkillRecord, User } from "../../types";
import { Icon } from "../../components/ui/Icon";
import {
  AnimatedBackground,
  GlassCard,
  LoadingPage,
  useNavHeader,
  ModalOverlay,
  DeleteConfirmationModal,
  PERMISSION_GROUPS,
  usePermission,
  Avatar,
  useToast,
} from "../shared";
import { SkillFormModal } from "./SkillFormModal";

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
      description: "Manage skill taxonomy and user assignments",
      action: canWrite ? {
        label: "Create Skill",
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

  if (loading) return <LoadingPage label="Loading skills..." />;

  return (
    <div>
      <AnimatedBackground />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left Panel: Skills Table */}
        <div className="lg:col-span-2">
          <GlassCard className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                        <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                <option value="">All</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto max-h-[650px]">
              {filteredSkills.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Icon name={searchTerm ? "search_off" : "school"} size={22} className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-500">
                    {searchTerm ? "No matching skills" : "No skills yet"}
                  </p>
                  {!searchTerm && canWrite && (
                    <button
                      onClick={() => setSkillModal({ open: true })}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Icon name="add" size={15} />
                      Create Skill
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Skill</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Category</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Users</th>
                      {canManage && <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSkills.map((skill) => {
                      const realUserCount = skillUserCounts[skill.id] || 0;
                      return (
                        <tr
                          key={skill.id}
                          onClick={() => { setSelectedSkillId(skill.id); setRightTab("skill"); }}
                          className={`cursor-pointer transition-colors ${
                            selectedSkillId === skill.id && rightTab === "skill"
                              ? "bg-indigo-50/60 border-l-2 border-l-indigo-500"
                              : "hover:bg-slate-50 border-l-2 border-l-transparent"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <Icon name="school" size={15} className="text-indigo-600" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-700">{skill.name}</p>
                                {skill.description && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{skill.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {skill.category ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">
                                {skill.category}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-medium text-slate-500">{realUserCount}</span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSkillModal({ open: true, editSkill: skill }); }}
                                  className="size-7 rounded-md border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
                                  title="Edit skill"
                                >
                                  <Icon name="edit" size={14} className="text-slate-500" />
                                </button>
                                {canDeleteSkill(skill) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, skill }); }}
                                    className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                    title="Delete skill"
                                  >
                                    <Icon name="delete" size={14} className="text-red-500" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-3">
          {/* Tab Bar */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setRightTab("skill")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                rightTab === "skill"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="school" size={15} className="align-text-bottom mr-1" />
              By Skill
            </button>
            <button
              onClick={() => setRightTab("user")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                rightTab === "user"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="people" size={15} className="align-text-bottom mr-1" />
              By User
            </button>
          </div>

          {rightTab === "skill" ? (
            /* ================ BY SKILL TAB ================ */
            <GlassCard className="h-full">
              {!selectedSkill ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                  <Icon name="touch_app" size={32} className="mb-3" />
                  <p className="text-sm font-medium text-slate-400">Select a skill from the list</p>
                  <p className="text-xs text-slate-300 mt-1">Manage user assignments and proficiency levels</p>
                </div>
              ) : (
                <div className="p-5 md:p-6 space-y-6">
                  <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Icon name="school" size={22} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-800">{selectedSkill.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedSkill.category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-50 text-violet-600">
                            {selectedSkill.category}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {assignedUsers.length} user{assignedUsers.length !== 1 ? "s" : ""} assigned
                        </span>
                      </div>
                      {selectedSkill.description && (
                        <p className="text-xs text-slate-500 mt-2">{selectedSkill.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Assigned Users */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Assigned Users
                    </h4>

                    {assignedUsers.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
                        <Icon name="person_off" size={24} className="text-slate-300 mb-2" />
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
                              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors"
                            >
                              <Avatar person={user} size="sm" className="shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-700 truncate">{user.fullName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{user.email} {user.isActive === false && <span className="text-slate-400">(Inactive)</span>}</p>
                              </div>

                              {canManage ? (
                                <>
                                  <div className="flex items-center gap-2 min-w-[140px]">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Prof</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={5}
                                      value={assignment.proficiencyLevel}
                                      onChange={(e) => {
                                        const val = Math.min(5, Math.max(1, Number(e.target.value)));
                                        handleUpdateAssignment(user.id, selectedSkillId!, val, assignment.experienceMonths);
                                      }}
                                      className="w-10 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                      title="Value 1-5"
                                    />
                                    <span className="text-[9px] text-slate-400">/5</span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase shrink-0 mr-1">Exp</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateAssignment(user.id, selectedSkillId!, assignment.proficiencyLevel, Math.max(0, assignment.experienceMonths - 1));
                                      }}
                                      className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
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
                                      className="w-14 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateAssignment(user.id, selectedSkillId!, assignment.proficiencyLevel, Math.min(600, assignment.experienceMonths + 1));
                                      }}
                                      className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                                    >
                                      <Icon name="add" size={11} />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(user.id, selectedSkillId!)}
                                    className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                                    title="Remove skill from user"
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
                  </div>

                  {/* Add User */}
                  {canManage && unassignedUsers.length > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Assign to User
                      </h4>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="relative flex-1 min-w-[180px]">
                          <select
                            value={newUserId}
                            onChange={(e) => setNewUserId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                          >
                            <option value="">Select a user...</option>
                            {unassignedUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.fullName}</option>
                            ))}
                          </select>
                          <Icon name="expand_more" size={15} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Prof</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={newProficiency}
                            onChange={(e) => setNewProficiency(Math.min(5, Math.max(1, Number(e.target.value))))}
                            className="w-10 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                            title="Value 1-5"
                          />
                          <span className="text-[9px] text-slate-400">/5</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Exp</label>
                          <button
                            type="button"
                            onClick={() => setNewExperience(Math.max(0, newExperience - 1))}
                            className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            <Icon name="remove" size={11} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            value={newExperience}
                            onChange={(e) => setNewExperience(e.target.value === "" ? 0 : Number(e.target.value))}
                            className="w-14 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setNewExperience(Math.min(600, newExperience + 1))}
                            className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            <Icon name="add" size={11} />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={!newUserId}
                          onClick={handleAssignSkill}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                        >
                          <Icon name="add" size={15} />
                          Assign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          ) : (
            /* ================ BY USER TAB ================ */
            <GlassCard className="h-full">
              <div className="p-5 md:p-6 space-y-5">
                {/* User Filters */}
                <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="relative flex-1 min-w-[180px]">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>

                  <select
                    value={userOrgFilter}
                    onChange={(e) => { setUserOrgFilter(e.target.value); setUserDeptFilter(""); }}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                  >
                    <option value="">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>

                  <select
                    value={userDeptFilter}
                    onChange={(e) => setUserDeptFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                  >
                    <option value="">All Departments</option>
                    {filteredDepts.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>

                  <span className="text-[10px] text-slate-400 ml-auto">
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* User List */}
                  <div className="lg:col-span-1 max-h-[500px] overflow-y-auto space-y-1">
                    {filteredUsers.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <Icon name="search_off" size={24} className="mb-2" />
                        <p className="text-xs">No users found</p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            selectedUserId === user.id
                              ? "border-indigo-200 bg-indigo-50/60"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar person={user} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700 truncate">{user.fullName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Selected User Skills */}
                  <div className="lg:col-span-2">
                    {!selectedUser ? (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                        <Icon name="touch_app" size={28} className="mb-2" />
                        <p className="text-xs text-slate-400">Select a user to manage their skills</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                          <Avatar person={selectedUser} size="md" />
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{selectedUser.fullName}</p>
                            <p className="text-[10px] text-slate-400">
                              {selectedUser.skillDetails?.length || 0} skill{(selectedUser.skillDetails?.length || 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        {(!selectedUser.skillDetails || selectedUser.skillDetails.length === 0) ? (
                          <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl">
                            <Icon name="school" size={22} className="text-slate-300 mb-1" />
                            <p className="text-xs text-slate-400">No skills assigned</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {selectedUser.skillDetails.map((skill) => (
                              <div
                                key={skill.skillId}
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white"
                              >
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                  <Icon name="school" size={14} className="text-indigo-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-700">{skill.skillName}</p>
                                </div>

                                {canManage ? (
                                  <>
                                    <div className="flex items-center gap-2 min-w-[130px]">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase shrink-0">Prof</label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={skill.proficiencyLevel}
                                        onChange={(e) => {
                                          const val = Math.min(5, Math.max(1, Number(e.target.value)));
                                          handleUpdateAssignment(selectedUser.id, skill.skillId, val, skill.experienceMonths);
                                        }}
                                        className="w-10 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        title="Value 1-5"
                                      />
                                      <span className="text-[9px] text-slate-400">/5</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase shrink-0 mr-1">Exp</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateAssignment(selectedUser.id, skill.skillId, skill.proficiencyLevel, Math.max(0, skill.experienceMonths - 1));
                                        }}
                                        className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
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
                                        className="w-12 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateAssignment(selectedUser.id, skill.skillId, skill.proficiencyLevel, Math.min(600, skill.experienceMonths + 1));
                                        }}
                                        className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                                      >
                                        <Icon name="add" size={11} />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAssignment(selectedUser.id, skill.skillId)}
                                      className="size-7 rounded-md border border-red-200 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
                                      title="Remove skill from user"
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

                        {/* Add Skill to User */}
                        {canManage && skillsNotAssignedToUser.length > 0 && (
                          <div className="pt-3 border-t border-slate-100">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                              Assign New Skill
                            </h5>
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="relative flex-1 min-w-[150px]">
                                <select
                                  value={newUserSkillId}
                                  onChange={(e) => setNewUserSkillId(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                                >
                                  <option value="">Select skill...</option>
                                  {skillsNotAssignedToUser.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                <Icon name="expand_more" size={15} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Prof</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={newUserSkillProf}
                                  onChange={(e) => setNewUserSkillProf(Math.min(5, Math.max(1, Number(e.target.value))))}
                                  className="w-10 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                  title="Value 1-5"
                                />
                                <span className="text-[9px] text-slate-400">/5</span>
                              </div>

                              <div className="flex items-center gap-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Exp</label>
                                <button
                                  type="button"
                                  onClick={() => setNewUserSkillExp(Math.max(0, newUserSkillExp - 1))}
                                  className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                  <Icon name="remove" size={11} />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={600}
                                  value={newUserSkillExp}
                                  onChange={(e) => setNewUserSkillExp(e.target.value === "" ? 0 : Number(e.target.value))}
                                  className="w-12 px-1.5 py-1 rounded-md border border-slate-200 text-center text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => setNewUserSkillExp(Math.min(600, newUserSkillExp + 1))}
                                  className="size-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                  <Icon name="add" size={11} />
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={!newUserSkillId}
                                onClick={handleAssignSkillToUser}
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                              >
                                <Icon name="add" size={15} />
                                Assign
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {skillModal.open && (
        <ModalOverlay onClose={() => setSkillModal({ open: false })}>
          <SkillFormModal
            initialData={skillModal.editSkill}
            onSubmit={handleSkillSubmit}
            onCancel={() => setSkillModal({ open: false })}
          />
        </ModalOverlay>
      )}

      {deleteConfirm.open && deleteConfirm.skill && (
        <ModalOverlay onClose={() => setDeleteConfirm({ open: false, skill: null })}>
          <DeleteConfirmationModal
            name={deleteConfirm.skill.name}
            warning="Deleting this skill will remove it from user profiles that reference it."
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, skill: null })}
          />
        </ModalOverlay>
      )}
    </div>
  );
}


