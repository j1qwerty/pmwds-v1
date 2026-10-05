// ProfileDetail.tsx
import type { User, UserProfileRecord } from "../../types";
import { Avatar, GlassCard, GradientButton } from "../shared";
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
    <div className="flex flex-col gap-6">
      {/* Main Profile Card */}
      <GlassCard className="overflow-visible !p-0">
        {/* Cover Banner with Pattern */}
        <div className="h-40 sm:h-48 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 relative rounded-t-2xl overflow-hidden">
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/30 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </div>
          {/* Grid Pattern Overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          ></div>
          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/30 to-transparent"></div>
        </div>

        <div className="px-5 sm:px-8 pb-8 relative">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-start gap-5 -mt-16 sm:-mt-20 mb-8 relative z-10">
            {/* Avatar */}
            <div className="relative flex-shrink-0 z-20 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-md opacity-60 group-hover:opacity-80 transition-opacity"></div>
                <Avatar
                  person={user}
                  size="xl"
                  className="relative rounded-2xl ring-4 ring-white shadow-2xl w-28 h-28 sm:w-36 sm:h-36"
                />
                
              </div>
              <div className="mt-4">
                 {onImageUpload && (
                    <ProfilePictureUploader userId={user.id} token={token} onUpload={onImageUpload} />
                  )}
              </div>
              
              {isActive && (
                <span className="absolute bottom-1 right-1 size-5 sm:size-6 rounded-full bg-emerald-500 border-[3px] border-white shadow-lg z-20 ring-2 ring-emerald-500/20">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></span>
                </span>
              )}
            </div>

            {/* Name and Title */}
            <div className="flex-1 -mt-8 sm:pt-16 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight break-words">
                      {user.fullName}
                    </h1>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-semibold text-emerald-700">Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        <span className="text-xs font-semibold text-red-700">Inactive</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {jobTitle && (
                      <span className="text-base text-slate-600 font-medium flex items-center gap-2">
                        <Icon name="work" size={16} className="text-indigo-500" />
                        {jobTitle}
                      </span>
                    )}
                    {jobTitle && <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>}
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <Icon name="badge" size={14} />
                      ID: {user.id}
                    </span>
                  </div>

                  {user.roles && user.roles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 text-xs font-semibold text-indigo-700 border border-indigo-200/60 shadow-sm"
                        >
                          {roleDisplayName(role)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 relative z-30 sm:self-start">
                 
                  {canEdit && (
                    <GradientButton onClick={onEdit} className="shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all">
                      <Icon name="edit" size={16} />
                      Edit Profile
                    </GradientButton>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 relative z-10">
            <StatCard
              icon="schedule"
              iconBg="from-emerald-500 to-teal-500"
              label="Availability"
              value={`${Math.round(user.availabilityPercentage ?? 0)}%`}
              sublabel="Current capacity"
            />
            <StatCard
              icon="info"
              iconBg="from-blue-500 to-cyan-500"
              label="Status"
              value={user.availabilityStatus || "Available"}
              sublabel="Current state"
            />
            <StatCard
              icon="auto_awesome"
              iconBg="from-purple-500 to-pink-500"
              label="AI Score"
              value={`${Math.round(user.aiWorkloadScore || 0)}%`}
              sublabel="Workload metric"
            />
            <StatCard
              icon="task_alt"
              iconBg="from-amber-500 to-orange-500"
              label="Active Tasks"
              value={`${user.activeTaskCount ?? 0}`}
              sublabel="In progress"
            />
          </div>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4">
                <Icon name="unfold_more" size={20} className="text-slate-300" />
              </span>
            </div>
          </div>

          {/* Bio & Skills Section */}
          <div className="mb-8">
            {/* <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                <Icon name="description" size={18} className="text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">About</h3>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/60">
              <p className="text-sm text-slate-600 leading-relaxed">
                {bio || "No bio available. Click edit to add a description about yourself."}
              </p>
            </div> */}

            {SHOW_PROFILE_SKILLS && user.skills && user.skills.length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Skills</div>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <span
                      key={skill}
                      className="group/skill inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm"
                    >
                      <Icon name="check_circle" size={12} className="text-slate-400 group-hover/skill:text-indigo-500 transition-colors" />
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Personal & Account Details */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                <Icon name="person" size={18} className="text-blue-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Personal & Account Details</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <DetailItem icon="work" label="Job Title" value={jobTitle || "Not set"} />
              <DetailItem
                icon="cake"
                label="Date of Birth"
                value={dateOfBirth ? new Date(dateOfBirth).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Not set"}
              />
              <DetailItem icon="emergency" label="Emergency Contact" value={emergencyContact || "Not set"} />
              {linkedInUrl && (
                <DetailItem icon="link" label="LinkedIn" value={linkedInUrl} isLink={true} />
              )}
              <DetailItem icon="verified_user" label="Account Status" value={isActive ? "Active" : "Inactive"} statusColor={isActive ? "emerald" : "red"} />
              <DetailItem icon="groups" label="Roles" value={roleDisplayNames(user.roles).join(", ") || "No roles assigned"} />
              <DetailItem icon="location_on" label="Address" value={address || "Not set"} fullWidth />
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sublabel,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="group relative p-4 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${iconBg} shadow-md`}>
          <Icon name={icon} size={16} className="text-white" />
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-xl font-bold text-slate-900 tracking-tight">{value}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{sublabel}</div>
      </div>
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
      className={`group p-4 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/50 transition-all duration-200 ${
        fullWidth ? "sm:col-span-2 lg:col-span-3" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors shrink-0">
          <Icon name={icon} size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
          <div className="text-sm font-semibold text-slate-700 break-words leading-snug">
            {isLink ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline decoration-indigo-300 decoration-2 underline-offset-2 transition-colors"
              >
                <span className="truncate">{value}</span>
                <Icon name="open_in_new" size={14} className="shrink-0" />
              </a>
            ) : statusColor ? (
              <span
                className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  statusColor === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusColor === "emerald" ? "bg-emerald-500" : "bg-red-500"}`}
                ></span>
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