// ProfileDetail.tsx
import type { User, UserProfileRecord } from "../../types";
import { Avatar, SectionCard, StatCard } from "../shared";
import { ProfilePictureUploader } from "../shared/ProfilePictureUploader";
import { Icon } from "../../components/ui/Icon";
import { SHOW_PROFILE_SKILLS } from "../../featureFlags";
import { roleDisplayName, roleDisplayNames } from "../../permissions";

interface ProfileDetailProps {
  user: User;
  profile: UserProfileRecord | null;
  canEdit: boolean;
  onEdit: () => void;
  token: string;
  onImageUpload?: (file: File) => Promise<void>;
}

export function ProfileDetail({ user, profile, canEdit, onEdit, token, onImageUpload }: ProfileDetailProps) {
  const rawBio = profile?.bio || user.bio;
  const bio = rawBio?.replace(/^Delivery profile for\s*/i, "").trim() || "";
  const jobTitle = profile?.jobTitle || user.jobTitle;
  const dateOfBirth = profile?.dateOfBirth;
  const address = profile?.address;
  const emergencyContact = profile?.emergencyContact;
  const linkedInUrl = profile?.linkedInUrl;

  const isActive = user.isActive !== false;

  return (
    <div className="flex flex-col gap-5">
      {/* Avatar header */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <div className="relative">
            <Avatar
              person={user}
              size="xl"
              src={user.profilePictureUrl ?? undefined}
              className="rounded-2xl ring-2 ring-white shadow-lg"
            />
            {isActive && (
              <span className="absolute bottom-1 right-1 size-4 rounded-full bg-emerald-500 border-2 border-white shadow" />
            )}
          </div>
          {onImageUpload && (
            <div className="mt-2">
              <ProfilePictureUploader userId={user.id} token={token} onUpload={onImageUpload} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight break-words">
              {user.fullName}
            </h2>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-semibold">Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-semibold">Inactive</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {jobTitle && (
              <span className="text-sm text-slate-600 font-medium flex items-center gap-1.5">
                <Icon name="work" size={14} className="text-indigo-500" />
                {jobTitle}
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Icon name="badge" size={12} />
              ID: {user.id}
            </span>
          </div>

          {user.roles && user.roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 text-[11px] font-semibold text-indigo-700 border border-indigo-200/60"
                >
                  {roleDisplayName(role)}
                </span>
              ))}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all"
            >
              <Icon name="edit" size={14} />
              Edit profile
            </button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Availability"
          value={`${Math.round(user.availabilityPercentage ?? 0)}%`}
          color="emerald"
          icon="schedule"
        />
        <StatCard
          label="Status"
          value={user.availabilityStatus || "Available"}
          color="blue"
          icon="info"
        />
        <StatCard
          label="AI Score"
          value={`${Math.round(user.aiWorkloadScore || 0)}%`}
          color="violet"
          icon="auto_awesome"
        />
        <StatCard
          label="Active Tasks"
          value={`${user.activeTaskCount ?? 0}`}
          color="amber"
          icon="task_alt"
        />
      </div>

      {/* About + Skills */}
      <SectionCard
        title="About"
        description={bio ? undefined : "No bio yet — click Edit profile to add one."}
        icon="description"
      >
        {bio ? (
          <p className="text-sm text-slate-600 leading-relaxed">{bio}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No bio available.</p>
        )}

        {SHOW_PROFILE_SKILLS && user.skills && user.skills.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Skills
            </div>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="group/skill inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm chip-pop"
                >
                  <Icon name="check_circle" size={12} className="text-slate-400 group-hover/skill:text-indigo-500 transition-colors" />
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Personal & Account Details */}
      <SectionCard
        title="Personal & account details"
        description="Contact information and account metadata"
        icon="person"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailItem icon="work" label="Job Title" value={jobTitle || "Not set"} />
          <DetailItem
            icon="cake"
            label="Date of Birth"
            value={dateOfBirth ? new Date(dateOfBirth).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Not set"}
          />
          <DetailItem icon="emergency" label="Emergency Contact" value={emergencyContact || "Not set"} />
          {linkedInUrl && (
            <DetailItem icon="link" label="LinkedIn" value={linkedInUrl} isLink />
          )}
          <DetailItem
            icon="verified_user"
            label="Account Status"
            value={isActive ? "Active" : "Inactive"}
            statusColor={isActive ? "emerald" : "red"}
          />
          <DetailItem icon="groups" label="Roles" value={roleDisplayNames(user.roles).join(", ") || "No roles assigned"} />
          <DetailItem icon="location_on" label="Address" value={address || "Not set"} fullWidth />
        </div>
      </SectionCard>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
  isLink = false,
  statusColor,
  fullWidth = false,
}: {
  icon: string;
  label: string;
  value: string;
  isLink?: boolean;
  statusColor?: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`group p-3.5 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-sm hover:shadow-indigo-100/50 transition-all duration-200 ${
        fullWidth ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors shrink-0">
          <Icon name={icon} size={15} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            {label}
          </div>
          <div className="text-sm font-semibold text-slate-700 break-words leading-snug">
            {isLink ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline decoration-indigo-300 decoration-2 underline-offset-2 transition-colors"
              >
                <span className="truncate">{value}</span>
                <Icon name="open_in_new" size={13} className="shrink-0" />
              </a>
            ) : statusColor ? (
              <span
                className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  statusColor === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor === "emerald" ? "bg-emerald-500" : "bg-red-500"}`} />
                {value}
              </span>
            ) : (
              value
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
