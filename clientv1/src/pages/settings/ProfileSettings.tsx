import { useState } from "react";
import type { AuthState } from "../../auth";
import { roleDisplayNames } from "../../permissions";
import { api } from "../../api";
import { Avatar, SectionCard } from "../shared";
import { ProfilePictureUploader } from "../shared/ProfilePictureUploader";
import { Icon } from "../../components/ui/Icon";

interface ProfileSettingsProps {
  auth: AuthState | null;
  onSave: () => void;
  onLogout: () => void;
}

const READONLY_INPUT =
  "w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500 outline-none cursor-default";

export function ProfileSettings({ auth, onSave, onLogout }: ProfileSettingsProps) {
  // Presentation-only feedback: the save itself is instant, the brief
  // spinner makes the action feel acknowledged.
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    onSave();
    window.setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Profile information"
        description="Personal details and avatar"
        icon="person"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Avatar
              person={{ fullName: auth?.fullName, profilePictureUrl: auth?.profilePictureUrl }}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800">{auth?.fullName ?? "—"}</div>
              <div className="text-xs text-slate-500 mb-2.5">
                Images are cropped square and compressed before upload.
              </div>
              {auth && (
                <ProfilePictureUploader
                  userId={auth.userId}
                  token={auth.token}
                  onUpload={async (file) => {
                    await api.uploadUserProfilePicture(auth.token, auth.userId, file);
                    onSave();
                  }}
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              value={auth?.email ?? ""}
              disabled
              aria-label="Email"
              className={READONLY_INPUT}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Full name
            </label>
            <input
              value={auth?.fullName ?? ""}
              disabled
              aria-label="Full name"
              className={READONLY_INPUT}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Account information"
        description="Identifier and assigned roles"
        icon="verified_user"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              User ID
            </label>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center">
              <span className="text-sm font-mono text-slate-500 truncate">{auth?.userId ?? "—"}</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Roles
            </label>
            <div className="min-h-10 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-1.5 overflow-x-auto">
              {auth && roleDisplayNames(auth.roles).length > 0 ? (
                roleDisplayNames(auth.roles).map((role) => (
                  <span
                    key={role}
                    className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100"
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-5 mt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="save" size={14} />
                Save settings
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all"
          >
            <Icon name="logout" size={14} />
            Logout
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
