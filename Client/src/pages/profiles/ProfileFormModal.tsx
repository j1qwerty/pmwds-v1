import { useState, useEffect, type FormEvent } from "react";
import type { User, UserProfileRecord } from "../../types";
import { Avatar } from "../shared";

interface ProfileFormModalProps {
  user: User;
  profile: UserProfileRecord | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ProfileFormModal({ user, profile, onSubmit, onCancel }: ProfileFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    bio: profile?.bio || user?.bio || "",
    jobTitle: profile?.jobTitle || user?.jobTitle || "",
    dateOfBirth: profile?.dateOfBirth?.slice(0, 10) || "",
    address: profile?.address || "",
    emergencyContact: profile?.emergencyContact || "",
    linkedInUrl: profile?.linkedInUrl || "",
  });

  useEffect(() => {
    setForm({
      bio: profile?.bio || user?.bio || "",
      jobTitle: profile?.jobTitle || user?.jobTitle || "",
      dateOfBirth: profile?.dateOfBirth?.slice(0, 10) || "",
      address: profile?.address || "",
      emergencyContact: profile?.emergencyContact || "",
      linkedInUrl: profile?.linkedInUrl || "",
    });
  }, [profile, user]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      ...form,
      dateOfBirth: form.dateOfBirth || null,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-8 w-[600px] max-w-[95vw] shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar person={user} size="lg" className="rounded-xl" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Edit Profile · {user.fullName}
          </h2>
          <p className="text-sm text-slate-500">
            Update personal and professional details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Job Title */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Job Title
          </label>
          <input
            type="text"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
            placeholder="e.g., Senior Developer"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Date of Birth
          </label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Address
          </label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Full address"
          />
        </div>

        {/* Emergency Contact & LinkedIn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Emergency Contact
            </label>
            <input
              type="text"
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="Name and phone number"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={form.linkedInUrl}
              onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none bg-white placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="https://linkedin.com/in/username"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border-none bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
