import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";
import { Avatar, GlassCard, GradientButton, PERMISSION_GROUPS, usePermission } from "../shared";
import { Icon } from "../../components/ui/Icon";

interface UserSkillsPanelProps {
  users: User[];
  onMessage: (msg: string) => void;
  onUpdate: () => void;
}

export function UserSkillsPanel({ users, onMessage, onUpdate }: UserSkillsPanelProps) {
  const { auth } = useAuth();
  const perm = usePermission();
  const canToggleActivation = perm.has(PERMISSION_GROUPS.user.manage);

  const [selectedUser, setSelectedUser] = useState(users[0]?.id || "");
  const [availabilityStatus, setAvailabilityStatus] = useState("");

  const selectedUserData = users.find((u) => u.id === selectedUser);

  useEffect(() => {
    if (!selectedUserData) return;
    setAvailabilityStatus(selectedUserData.availabilityStatus || "Available");
  }, [selectedUserData]);

  const handleDeactivate = async () => {
    if (!auth || !selectedUser) return;
    const target = users.find((u) => u.id === selectedUser);
    if (!target) return;
    try {
      if (target.isActive !== false) {
        await api.deactivateUser(auth.token, selectedUser);
        onMessage("User deactivated.");
      } else {
        await api.reactivateUser(auth.token, selectedUser);
        onMessage("User reactivated.");
      }
      onUpdate();
    } catch (e) {
      onMessage(`Error: ${e instanceof Error ? e.message : "Deactivation failed"}`);
    }
  };

  const handleAvailabilityChange = async (status: string) => {
    if (!auth || !selectedUser) return;
    const user = users.find((u) => u.id === selectedUser);
    try {
      await api.updateAvailability(auth.token, selectedUser, status, user?.availabilityPercentage || 100);
      onMessage("Availability updated.");
      onUpdate();
    } catch (e) {
      onMessage(`Error: ${e instanceof Error ? e.message : "Update failed"}`);
    }
  };

  return (
    <GlassCard className="p-4 md:p-6">
      <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Icon name="settings" size={18} className="text-indigo-500" />
        User Management
      </h3>

      <div className="max-w-[28rem] space-y-5">
        {/* User Selector */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Select User
          </label>
          <div className="relative">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
            >
              {users.filter((u) => u.isActive !== false).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
            <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* User Info Card */}
        {selectedUserData && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-100">
            <Avatar person={selectedUserData} size="lg" className="rounded-lg shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-700 truncate">{selectedUserData.fullName}</p>
              <p className="text-xs text-slate-400 truncate">{selectedUserData.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${selectedUserData.isActive === false
                      ? "bg-slate-100 text-slate-500"
                      : "bg-emerald-50 text-emerald-700"
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${selectedUserData.isActive === false ? "bg-slate-400" : "bg-emerald-500"
                      }`}
                  />
                  {selectedUserData.isActive === false ? "Inactive" : "Active"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Availability */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Availability Status
          </label>
          <div className="relative">
            <select
              value={availabilityStatus}
              onChange={(e) => {
                setAvailabilityStatus(e.target.value);
                if (e.target.value) void handleAvailabilityChange(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
            >
              <option>Available</option>
              <option>Busy</option>
              <option>Away</option>
              <option>In Meeting</option>
              <option>Deep Work</option>
              <option>Offline</option>
            </select>
            <Icon name="expand_more" size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Deactivate / Reactivate */}
        {canToggleActivation && (
          <GradientButton
            variant={selectedUserData?.isActive === false ? "ghost" : "danger"}
            onClick={handleDeactivate}
            className="w-full"
          >
            <span className="material-symbols-outlined text-sm">
              {selectedUserData?.isActive === false ? "restart_alt" : "person_off"}
            </span>
            {selectedUserData?.isActive === false ? "Reactivate User" : "Deactivate User"}
          </GradientButton>
        )}
      </div>
    </GlassCard>
  );
}
