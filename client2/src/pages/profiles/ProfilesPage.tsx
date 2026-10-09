// ProfilesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useAppData } from "../../appData";
import type { Department, OrganizationRecord, User, UserProfileRecord } from "../../types";
import { roleDisplayNames } from "../../permissions";
import { Icon } from "../../components/ui/Icon";
import {
  AnimatedBackground,
  Avatar,
  EmptyState,
  FilterBar,
  FilterDropdown,
  GlassCard,
  HoverActions,
  SortDropdown,
  LoadingPage,
  ModalCancelButton,
  ModalPrimaryButton,
  PageContainer,
  PERMISSION_GROUPS,
  Sheet,
  StatCard,
  useNavHeader,
  usePermission,
  useToast,
  ViewToggle,
  type ViewMode,
} from "../shared";
import { ProfileList } from "./ProfileList";
import { ProfileDetail } from "./ProfileDetail";
import { ProfileFormModal } from "./ProfileFormModal";

/* ── Sort ───────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
  { value: "role", label: "Role" },
  { value: "department", label: "Department" },
  { value: "newest", label: "Newest (last login)" },
  { value: "oldest", label: "Oldest (last login)" },
];

const nameCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Role / job-title label used for cards, panel header and role sorting. */
function profileRoleLabel(user: User): string {
  return roleDisplayNames(user.roles).join(", ") || user.jobTitle || "";
}

/** Department label used for cards, panel header and department sorting. */
function profileDeptLabel(user: User, departments: Department[]): string {
  return (
    user.departments?.length
      ? user.departments.map((item) => item.departmentName).join(", ")
      : departments.find((d) => d.id === user.departmentId)?.name || user.department
  ) || "Unassigned";
}

export function ProfilesPage() {
  const { auth, updateCurrentUser } = useAuth();
  const perm = usePermission();
  const { addToast } = useToast();
  const { departments, organizations } = useAppData().data;
  const canViewProfileList = perm.has(PERMISSION_GROUPS.user.view);
  const canManageProfiles = perm.has(PERMISSION_GROUPS.user.edit);
  const isOwnProfile = !canViewProfileList;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [view, setView] = useState<ViewMode>("card");
  const [sortValue, setSortValue] = useState("name-asc");
  const [showDetail, setShowDetail] = useState(false);

  const [profileModal, setProfileModal] = useState(false);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    if (isOwnProfile) {
      api.getMe(auth.token)
        .then((me) => {
          setUsers([me]);
          setSelectedUser(me);
        })
        .catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to load profile.", "error"))
        .finally(() => setLoading(false));
    } else {
      api.getUsers(auth.token)
        .then((userData) => {
          setUsers(userData);
          if (!selectedUser && userData.length > 0) {
            setSelectedUser(userData[0]);
          }
        })
        .catch((cause) => addToast(cause instanceof Error ? cause.message : "Failed to load profiles.", "error"))
        .finally(() => setLoading(false));
    }
  }, [auth, isOwnProfile]);

  useEffect(() => {
    if (!auth || !selectedUser) {
      setProfile(null);
      return;
    }
    api.getProfile(auth.token, selectedUser.id)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [auth, selectedUser]);

  const { setNavHeader } = useNavHeader();

  useEffect(() => {
    setNavHeader({
      title: isOwnProfile ? "My profile" : "Profiles",
      description: isOwnProfile ? "View and manage your profile details" : "People, personal details, skills, and account metadata",
      action: canManageProfiles && selectedUser ? {
        label: "Edit profile",
        onClick: () => setProfileModal(true),
        icon: "edit",
      } : undefined,
    });
  }, [setNavHeader, isOwnProfile, canManageProfiles, selectedUser]);

  const handleProfileSubmit = async (payload: Record<string, unknown>) => {
    if (!auth || !selectedUser) return;
    try {
      const updatedProfile = await api.upsertProfile(auth.token, selectedUser.id, payload);
      setProfile(updatedProfile);
      setProfileModal(false);
      addToast("Profile saved successfully.");
    } catch (e) {
      addToast(`Error: ${e instanceof Error ? e.message : "Save failed"}`, "error");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!auth || !selectedUser) return;
    const result = await api.uploadUserProfilePicture(auth.token, selectedUser.id, file);
    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...result.user } : u)));
    setSelectedUser((prev) => (prev ? { ...prev, ...result.user } : null));
    if (selectedUser.id === auth.userId) {
      updateCurrentUser({
        fullName: result.user.fullName,
        email: result.user.email,
        profilePictureUrl: result.user.profilePictureUrl,
      });
    }
    addToast("Profile picture updated.");
  };

  // KPI row — derived from the already-loaded people list
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive !== false).length;
    const withProfile = users.filter((u) => Boolean(u.profileId)).length;
    return { total: users.length, active, inactive: users.length - active, withProfile };
  }, [users]);

  const orgOptions = useMemo(
    () => organizations.map((org) => ({ value: org.id, label: org.name })),
    [organizations],
  );

  const filteredDepartments = useMemo(
    () => (selectedOrg ? departments.filter((d) => d.organizationId === selectedOrg) : departments),
    [departments, selectedOrg],
  );

  const deptOptions = useMemo(
    () => filteredDepartments.map((dept) => ({ value: dept.id, label: dept.name })),
    [filteredDepartments],
  );

  // Filter users
  const filteredUsers = useMemo(() => users.filter((user) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      user.fullName.toLowerCase().includes(search) ||
      (user.email && user.email.toLowerCase().includes(search)) ||
      (user.jobTitle && user.jobTitle.toLowerCase().includes(search));
    const matchesDept =
      !selectedDept ||
      user.departmentId === selectedDept ||
      user.departments?.some((d) => d.departmentId === selectedDept);
    const userDept = departments.find((d) => d.id === user.departmentId);
    const userOrgId =
      user.organizationId ??
      userDept?.organizationId ??
      user.departments?.find((item) => item.organizationId)?.organizationId;
    const matchesOrg = !selectedOrg || userOrgId === selectedOrg;
    return Boolean(matchesSearch) && matchesDept && matchesOrg;
  }), [users, searchTerm, selectedDept, selectedOrg, departments]);

  // Sort (additive — filtering above is untouched)
  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    const lastLogin = (u: User) => (u.lastLoginDate ? new Date(u.lastLoginDate).getTime() : 0);
    const byName = (a: User, b: User) => nameCollator.compare(a.fullName, b.fullName);
    switch (sortValue) {
      case "name-desc":
        return list.sort((a, b) => nameCollator.compare(b.fullName, a.fullName));
      case "role":
        return list.sort(
          (a, b) =>
            nameCollator.compare(profileRoleLabel(a), profileRoleLabel(b)) || byName(a, b),
        );
      case "department":
        return list.sort(
          (a, b) =>
            nameCollator.compare(profileDeptLabel(a, departments), profileDeptLabel(b, departments)) ||
            byName(a, b),
        );
      case "newest":
        return list.sort((a, b) => lastLogin(b) - lastLogin(a) || byName(a, b));
      case "oldest":
        return list.sort((a, b) => lastLogin(a) - lastLogin(b) || byName(a, b));
      case "name-asc":
      default:
        return list.sort(byName);
    }
  }, [filteredUsers, sortValue, departments]);

  const activeFilterCount =
    (searchTerm ? 1 : 0) + (selectedDept ? 1 : 0) + (selectedOrg ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDept("");
    setSelectedOrg("");
  };

  const openDetail = (user: User) => {
    setSelectedUser(user);
    setShowDetail(true);
  };

  // Card/row edit action — selects that person, then opens the existing profile form
  const openProfileEdit = (user: User) => {
    setSelectedUser(user);
    setProfileModal(true);
  };

  if (loading) return <LoadingPage label="Loading profiles..." />;

  // Own-profile mode: no directory permission — show the personal profile directly.
  if (isOwnProfile) {
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10 max-w-5xl mx-auto pb-10">
          {selectedUser ? (
            <ProfileDetail
              user={selectedUser}
              profile={profile}
              canEdit={canManageProfiles}
              onEdit={() => setProfileModal(true)}
              token={auth?.token ?? ""}
              onImageUpload={canManageProfiles || selectedUser.id === auth?.userId ? handleImageUpload : undefined}
            />
          ) : (
            <GlassCard>
              <EmptyState
                icon="person_search"
                title="Profile unavailable"
                description="We could not load your profile. Please try again in a moment."
                accent="primary"
              />
            </GlassCard>
          )}
        </div>

        {selectedUser && (
          <ProfileFormModal
            open={profileModal}
            user={selectedUser}
            profile={profile}
            onSubmit={handleProfileSubmit}
            onCancel={() => setProfileModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatedBackground />

      <PageContainer
        stats={
          <>
            <StatCard label="Total people" value={stats.total} color="indigo" icon="people" />
            <StatCard label="Active" value={stats.active} color="emerald" icon="check_circle" />
            <StatCard label="Inactive" value={stats.inactive} color="red" icon="person_off" />
            <StatCard label="With profiles" value={stats.withProfile} color="violet" icon="badge" />
          </>
        }
        filters={
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search profiles by name, email, or job title..."
            actions={
              <>
                {perm.isAdmin && (
                  <FilterDropdown
                    value={selectedOrg}
                    onChange={(val) => {
                      setSelectedOrg(val);
                      setSelectedDept("");
                    }}
                    label="Org"
                    icon="apartment"
                    options={orgOptions}
                    width="min-w-[160px]"
                  />
                )}
                <FilterDropdown
                  value={selectedDept}
                  onChange={setSelectedDept}
                  label="Dept"
                  icon="account_tree"
                  options={deptOptions}
                  width="min-w-[160px]"
                />
                <SortDropdown value={sortValue} onChange={setSortValue} options={SORT_OPTIONS} />
                <ViewToggle value={view} onChange={setView} available={["card", "list"]} />
              </>
            }
          />
        }
      >
        {/* Results meta */}
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-700">{sortedUsers.length}</strong> of {users.length} people
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
            >
              <Icon name="filter_alt_off" size={12} />
              Clear filters
            </button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <EmptyState
            icon="person_search"
            title="No profiles found"
            description="No people match the current filters. Clear filters to see the full directory."
            accent="primary"
            action={
              activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
                >
                  <Icon name="filter_alt_off" size={14} />
                  Clear all filters
                </button>
              ) : undefined
            }
          />
        ) : view === "card" ? (
          <div key="card" className="view-fade grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
            {sortedUsers.map((user, idx) => (
              <div key={user.id} className="card-stagger" style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
                <ProfileCard
                  user={user}
                  departments={departments}
                  organizations={organizations}
                  selected={selectedUser?.id === user.id}
                  onSelect={openDetail}
                  canEdit={canManageProfiles}
                  onEdit={openProfileEdit}
                />
              </div>
            ))}
          </div>
        ) : (
          <div key="list" className="view-fade pb-10">
            <ProfileList
              users={sortedUsers}
              selectedUserId={selectedUser?.id || ""}
              onSelect={openDetail}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              hideSearch
              canEdit={canManageProfiles}
              onEdit={openProfileEdit}
            />
          </div>
        )}
      </PageContainer>

      {/* Profile detail sheet — right-slide view panel */}
      <Sheet
        open={showDetail && Boolean(selectedUser)}
        onClose={() => setShowDetail(false)}
        title={
          selectedUser ? (
            <span className="flex items-center gap-3 min-w-0">
              <Avatar
                person={selectedUser}
                size="md"
                src={selectedUser.profilePictureUrl ?? undefined}
                className="rounded-xl shrink-0"
              />
              <span className="flex flex-col min-w-0">
                <span className="text-base font-bold text-slate-800 leading-tight truncate">
                  {selectedUser.fullName}
                </span>
                <span className="text-xs text-slate-500 font-normal truncate">
                  {[profileRoleLabel(selectedUser) || "No role", profileDeptLabel(selectedUser, departments)]
                    .join(" · ")}
                </span>
              </span>
            </span>
          ) : (
            "Profile details"
          )
        }
        description={selectedUser?.email}
        size="lg"
        footer={
          selectedUser ? (
            <>
              <ModalCancelButton label="Close" onClick={() => setShowDetail(false)} />
              {canManageProfiles && (
                <ModalPrimaryButton
                  label="Edit profile"
                  icon="edit"
                  onClick={() => setProfileModal(true)}
                />
              )}
            </>
          ) : undefined
        }
      >
        {selectedUser && (
          <ProfileDetail
            user={selectedUser}
            profile={profile}
            canEdit={canManageProfiles}
            onEdit={() => setProfileModal(true)}
            token={auth?.token ?? ""}
            onImageUpload={canManageProfiles || selectedUser.id === auth?.userId ? handleImageUpload : undefined}
          />
        )}
      </Sheet>

      {/* Profile Form Modal */}
      {selectedUser && (
        <ProfileFormModal
          open={profileModal}
          user={selectedUser}
          profile={profile}
          onSubmit={handleProfileSubmit}
          onCancel={() => setProfileModal(false)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ProfileCard({
  user,
  departments,
  organizations,
  selected,
  onSelect,
  canEdit = false,
  onEdit,
}: {
  user: User;
  departments: Department[];
  organizations: OrganizationRecord[];
  selected: boolean;
  onSelect: (user: User) => void;
  canEdit?: boolean;
  onEdit?: (user: User) => void;
}) {
  const dept = departments.find((d) => d.id === user.departmentId);
  const org = organizations.find((item) => item.id === (user.organizationId ?? dept?.organizationId));
  const deptLabel = profileDeptLabel(user, departments);
  const isActive = user.isActive !== false;
  const roleLabel = profileRoleLabel(user) || "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(user)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(user);
        }
      }}
      className={`group text-left w-full h-full cursor-pointer rounded-2xl p-4 flex flex-col transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5 hover:border-indigo-200 hover:-translate-y-0.5 border bg-white/97  shadow-sm ${
        selected ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar person={user} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800 truncate">{user.fullName}</h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
          {user.jobTitle && <p className="text-[11px] text-slate-400 truncate mt-0.5">{user.jobTitle}</p>}
        </div>
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
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mt-3 mb-3">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 max-w-full">
          <Icon name="badge" size={11} className="shrink-0" />
          <span className="truncate">{roleLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 max-w-full">
          <Icon name="account_tree" size={11} className="shrink-0" />
          <span className="truncate">{deptLabel}</span>
        </span>
      </div>

      {/* Actions — view/edit revealed on hover (edit permission-gated) */}
      <div className="mt-auto pt-3">
        <HoverActions
          entity="users"
          onHover={[
            { icon: "view", label: "View profile", onClick: () => onSelect(user) },
            ...(canEdit && onEdit ? [{ icon: "edit", label: "Edit profile", onClick: () => onEdit(user) }] : []),
          ]}
        />
      </div>
    </div>
  );
}
