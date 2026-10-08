// ProfileFormModal.tsx
import { useState, useEffect, type FormEvent } from "react";
import type { User, UserProfileRecord } from "../../types";
import { Avatar, Modal, ModalCancelButton, ModalPrimaryButton } from "../shared";

interface ProfileFormModalProps {
  open: boolean;
  user: User;
  profile: UserProfileRecord | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ProfileFormModal({ open, user, profile, onSubmit, onCancel }: ProfileFormModalProps) {
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

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onSubmit({
      ...form,
      dateOfBirth: form.dateOfBirth || null,
    });
    // Parent will close the modal and the submitting flag will reset when the
    // modal is reopened. Reset shortly after to avoid a stuck spinner if the
    // save fails and the user keeps the modal open.
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`Edit Profile · ${user.fullName}`}
      description="Update personal and professional details"
      icon="person"
      accent="primary"
      size="lg"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label="Save Profile"
            icon="check"
          />
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(e);
        }}
        className="flex flex-col gap-4"
      >
        {/* Header preview */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Avatar person={user} size="lg" className="rounded-xl" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate">{user.fullName}</div>
            <div className="text-xs text-slate-500 truncate">{user.email || "—"}</div>
          </div>
        </div>

        {/* Job Title */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Job Title
          </label>
          <input
            type="text"
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none bg-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            placeholder="e.g., Senior Developer"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Date of Birth
          </label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Bio
          </label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Tell us about yourself..."
          />
        </div>

        {/* Address */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Address
          </label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none bg-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            placeholder="Full address"
          />
        </div>

        {/* Emergency Contact & LinkedIn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Emergency Contact
            </label>
            <input
              type="text"
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none bg-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="Name and phone number"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={form.linkedInUrl}
              onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none bg-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              placeholder="https://linkedin.com/in/username"
            />
          </div>
        </div>

        {/* Hidden submit so Enter key works */}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
}
