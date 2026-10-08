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

export function ProfileSettings({ auth, onSave, onLogout }: ProfileSettingsProps) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Profile Information"
        description="Personal details and avatar"
        icon="person"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <Avatar
              person={{ fullName: auth?.fullName, profilePictureUrl: auth?.profilePictureUrl }}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-700">{auth?.fullName ?? "—"}</div>
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
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              value={auth?.email ?? ""}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Full Name
            </label>
            <input
              value={auth?.fullName ?? ""}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 outline-none"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Account Information"
        description="Identifier and assigned roles"
        icon="shield"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              User ID
            </label>
            <input
              value={auth?.userId ?? ""}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 font-mono outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Roles
            </label>
            <input
              value={roleDisplayNames(auth?.roles).join(", ")}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-slate-50 text-slate-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-5 mt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
          >
            <Icon name="save" size={14} />
            Save Settings
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all"
          >
            <Icon name="logout" size={14} />
            Logout
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
