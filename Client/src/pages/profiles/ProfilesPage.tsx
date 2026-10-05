// ProfilesPage.tsx
import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User, UserProfileRecord } from "../../types";
import {
  AnimatedBackground,
  GlassCard,
  LoadingPage,
  useNavHeader,
  ModalOverlay,
  useToast,
  PERMISSION_GROUPS,
  usePermission,
} from "../shared";
import { ProfileList } from "./ProfileList";
import { ProfileDetail } from "./ProfileDetail";
import { ProfileFormModal } from "./ProfileFormModal";
import { Icon } from "../../components/ui/Icon";


export function ProfilesPage() {
  const { auth, updateCurrentUser } = useAuth();
  const perm = usePermission();
  const { addToast } = useToast();
  const canViewProfileList = perm.has(PERMISSION_GROUPS.user.view);
  const canManageProfiles = perm.has(PERMISSION_GROUPS.user.edit);
  const isOwnProfile = !canViewProfileList;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
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
      title: isOwnProfile ? "My Profile" : "Profiles",
      description: isOwnProfile ? "View and manage your profile details" : "View and manage user profiles and details",
      action: canManageProfiles && selectedUser ? {
        label: "Edit Profile",
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
    setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...result.user } : u));
    setSelectedUser(prev => prev ? { ...prev, ...result.user } : null);
    if (selectedUser.id === auth.userId) {
      updateCurrentUser({
        fullName: result.user.fullName,
        email: result.user.email,
        profilePictureUrl: result.user.profilePictureUrl,
      });
    }
    addToast("Profile picture updated.");
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.fullName.toLowerCase().includes(search) ||
      (user.email && user.email.toLowerCase().includes(search)) ||
      (user.jobTitle && user.jobTitle.toLowerCase().includes(search))
    );
  });

  if (loading) return <LoadingPage label="Loading profiles..." />;

  return (
    <div className="min-h-screen">
      <AnimatedBackground />

      {/* Main Layout */}
      <div className={`relative z-10 grid gap-6 ${isOwnProfile ? "grid-cols-1 max-w-5xl mx-auto" : "grid-cols-[320px_1fr]"}`}>
        {/* Left Panel: Profile List - hidden for own profile view */}
        {!isOwnProfile && (
          <div className="sticky top-6 self-start">
            <ProfileList
              users={filteredUsers}
              selectedUserId={selectedUser?.id || ""}
              onSelect={setSelectedUser}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </div>
        )}

        {/* Right Panel: Profile Detail */}
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
          <GlassCard className="p-16 text-center flex flex-col items-center justify-center flex-1 min-h-[600px]">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center mb-6 shadow-inner">
              <Icon name="person_search" size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Select a Profile</h3>
            <p className="text-sm text-slate-500 max-w-[28rem]">
              Choose a user from the left panel to view their detailed profile information
            </p>
          </GlassCard>
        )}
      </div>

      {/* Profile Form Modal */}
      {profileModal && selectedUser && (
        <ModalOverlay onClose={() => setProfileModal(false)}>
          <ProfileFormModal
            user={selectedUser}
            profile={profile}
            onSubmit={handleProfileSubmit}
            onCancel={() => setProfileModal(false)}
          />
        </ModalOverlay>
      )}
    </div>
  );
}