// ProfileFormModal.tsx
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import type { User, UserProfileRecord } from "../../types";
import { Avatar, ModalCancelButton, ModalPrimaryButton, Sheet } from "../shared";

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

  const inputClass =
    "w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400";

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title="Edit profile"
      description={user.fullName}
      icon="edit"
      accent="primary"
      size="md"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalPrimaryButton
            onClick={() => handleSubmit()}
            loading={submitting}
            label="Save profile"
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
        className="space-y-4"
      >
        {/* Header preview */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Avatar person={user} size="lg" className="rounded-xl" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate">{user.fullName}</div>
            <div className="text-xs text-slate-500 truncate">{user.email || "—"}</div>
          </div>
        </div>

        {/* Job Title + Date of Birth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job title">
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              className={inputClass}
              placeholder="e.g., Senior Developer"
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        {/* Bio */}
        <Field label="Bio">
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none min-h-[80px] placeholder:text-slate-400"
            placeholder="Tell us about yourself..."
          />
        </Field>

        {/* Address */}
        <Field label="Address">
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-slate-400"
            placeholder="Full address"
          />
        </Field>

        {/* Emergency Contact & LinkedIn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Emergency contact">
            <input
              type="text"
              value={form.emergencyContact}
              onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
              className={inputClass}
              placeholder="Name and phone number"
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              type="url"
              value={form.linkedInUrl}
              onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
              className={inputClass}
              placeholder="https://linkedin.com/in/username"
            />
          </Field>
        </div>

        {/* Hidden submit so Enter key works */}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
