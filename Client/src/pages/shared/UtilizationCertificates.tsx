import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api";
import type {
  Milestone,
  Task,
  UtilizationCertificate,
  UtilizationCertificateStatus,
} from "../../types";
import { PERMISSION_GROUPS, usePermission } from "./RoleGate";
import { useToast } from "./Toast";
import { useAuth } from "../../auth";
import { formatRupees } from "../../ui";

/**
 * Self-contained overlay, portalled to <body>.
 *
 * Width is constrained on the panel itself (`w-full max-w-*`), which is the
 * pattern the working modals in this app use — putting the max-width on the
 * wrapper collapses the panel to near-zero width and lets content spill out.
 */
function UcModal({
  children,
  onClose,
  widthClassName,
}: {
  children: React.ReactNode;
  onClose: () => void;
  widthClassName: string;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative w-full ${widthClassName} flex justify-center`}
      >
        {/* Close button lives on the wrapper, not inside the panel: the panel is
            scrollable, so an absolutely positioned button inside it gets clipped. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const MAX_FILE_BYTES = 10_000_000;

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];

const STATUS_STYLES: Record<UtilizationCertificateStatus, { label: string; className: string; icon: string }> = {
  Draft: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    icon: "edit_note",
  },
  Submitted: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "outbox",
  },
  UnderReview: {
    label: "Under review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: "hourglass_top",
  },
  Approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "verified",
  },
  Rejected: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    icon: "cancel",
  },
};

const EMPTY_FORM = {
  certificateNumber: "",
  fundingSource: "",
  amountClaimed: "",
  amountUtilized: "",
  periodStart: "",
  periodEnd: "",
  linkType: "none" as "none" | "milestone" | "task",
  linkId: "",
  purpose: "",
  title: "",
  description: "",
};

type FormState = typeof EMPTY_FORM;

export interface UtilizationCertificatesProps {
  projectId: string;
  /** Milestones and tasks of the project, used to link a certificate to the work it pays for. */
  milestones?: Milestone[];
  tasks?: Task[];
}

export function UtilizationCertificates({
  projectId,
  milestones = [],
  tasks = [],
}: UtilizationCertificatesProps) {
  const { auth } = useAuth();
  const perm = usePermission();
  const { addToast } = useToast();

  const [certificates, setCertificates] = useState<UtilizationCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<UtilizationCertificate | null>(null);
  const [reviewApprove, setReviewApprove] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  // The explainer is on demand: a click pins it open, hover previews it briefly.
  const [helpPinned, setHelpPinned] = useState(false);
  const [helpHovered, setHelpHovered] = useState(false);
  const showHelp = helpPinned || helpHovered;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only the two coarse gates stay client-side: whether the section is visible at
  // all, and whether to offer the "Submit UC" button. Per-certificate actions
  // come from the server via `capabilities` instead.
  const canView = perm.has(PERMISSION_GROUPS.utilizationCertificate.view);
  const canSubmit = perm.has(PERMISSION_GROUPS.utilizationCertificate.create);

  const load = useCallback(async () => {
    if (!auth?.token || !projectId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCertificates(await api.getProjectUtilizationCertificates(auth.token, projectId));
    } catch {
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, projectId, canView]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply the server's version of a single certificate immediately, so the
  // buttons follow the new status even before the list refetch lands.
  const applyCertificate = (updated: UtilizationCertificate) => {
    setCertificates((current) =>
      current.map((cert) => (cert.id === updated.id ? updated : cert)),
    );
  };

  const totals = useMemo(
    () =>
      certificates.reduce(
        (acc, cert) => {
          acc.claimed += cert.amountClaimed;
          acc.utilized += cert.amountUtilized;
          if (cert.status === "Approved") acc.approved += 1;
          if (cert.status === "Rejected") acc.rejected += 1;
          if (cert.status === "Submitted" || cert.status === "UnderReview") acc.pending += 1;
          return acc;
        },
        { claimed: 0, utilized: 0, approved: 0, rejected: 0, pending: 0 },
      ),
    [certificates],
  );

  const linkOptions = useMemo(() => {
    if (form.linkType === "milestone") {
      return milestones.map((m) => ({ value: m.id, label: m.name }));
    }
    if (form.linkType === "task") {
      return tasks.map((t) => ({ value: t.id, label: t.title }));
    }
    return [];
  }, [form.linkType, milestones, tasks]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFile(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (): string | null => {
    if (!file) return "Attach the signed utilization certificate file.";
    if (file.size > MAX_FILE_BYTES) return "The file must be 10 MB or smaller.";
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return "Only PDF, Word, Excel, JPEG, PNG or WebP files are accepted.";
    }
    if (!form.certificateNumber.trim()) return "Certificate number is required.";
    if (!form.fundingSource.trim()) return "Funding source is required.";
    const claimed = Number(form.amountClaimed);
    const utilized = Number(form.amountUtilized);
    if (!claimed || claimed <= 0) return "Amount claimed must be greater than zero.";
    if (Number.isNaN(utilized) || utilized < 0) return "Amount utilized cannot be negative.";
    if (utilized > claimed) return "Amount utilized cannot exceed the amount claimed.";
    if (!form.periodStart || !form.periodEnd) return "The accounting period is required.";
    if (form.periodEnd < form.periodStart) return "Period end cannot be before period start.";
    if (form.linkType !== "none" && !form.linkId) return "Select the milestone or task being certified.";
    return null;
  };

  const handleSubmit = async () => {
    if (!auth?.token) return;
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }
    if (!file) return;

    setSaving(true);
    setFormError(null);
    try {
      await api.submitUtilizationCertificate(auth.token, file, {
        projectId,
        certificateNumber: form.certificateNumber.trim(),
        fundingSource: form.fundingSource.trim(),
        amountClaimed: Number(form.amountClaimed),
        amountUtilized: Number(form.amountUtilized || 0),
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        milestoneId: form.linkType === "milestone" ? form.linkId : null,
        taskId: form.linkType === "task" ? form.linkId : null,
        purpose: form.purpose.trim() || null,
        title: form.title.trim() || null,
        description: form.description.trim() || null,
      });
      addToast("Utilization certificate submitted as a draft");
      setShowForm(false);
      resetForm();
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setFormError(message);
      addToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSendForReview = async (cert: UtilizationCertificate) => {
    if (!auth?.token) return;
    setBusyId(cert.id);
    try {
      applyCertificate(await api.submitUtilizationCertificateForReview(auth.token, cert.id));
      addToast("Certificate sent for review");
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not send for review", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleReview = async () => {
    if (!auth?.token || !reviewTarget) return;
    if (!reviewApprove && !reviewNotes.trim()) {
      addToast("A reason is required when rejecting a certificate", "error");
      return;
    }
    setBusyId(reviewTarget.id);
    try {
      applyCertificate(
        await api.reviewUtilizationCertificate(
          auth.token,
          reviewTarget.id,
          reviewApprove,
          reviewNotes.trim() || undefined,
        ),
      );
      addToast(reviewApprove ? "Certificate approved" : "Certificate rejected");
      setReviewTarget(null);
      setReviewNotes("");
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Review failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cert: UtilizationCertificate) => {
    if (!auth?.token) return;
    setBusyId(cert.id);
    try {
      await api.deleteUtilizationCertificate(auth.token, cert.id);
      addToast("Certificate deleted");
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Could not delete", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (cert: UtilizationCertificate) => {
    if (!auth?.token) return;
    setBusyId(cert.id);
    try {
      const blob = await api.downloadProjectDocument(auth.token, projectId, cert.documentId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = cert.title || `${cert.certificateNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Download failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (!canView) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-indigo-600 text-[18px] shrink-0">
            workspace_premium
          </span>
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
            Utilization Certificates
          </h4>
          {certificates.length > 0 && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {certificates.length}
            </span>
          )}
          {/* What a UC is, and who signs it off, is available on demand rather than
              always on screen — click to pin it open, or hover to preview it. */}
          <button
            type="button"
            onClick={() => setHelpPinned((pinned) => !pinned)}
            onMouseEnter={() => setHelpHovered(true)}
            onMouseLeave={() => setHelpHovered(false)}
            onFocus={() => setHelpHovered(true)}
            onBlur={() => setHelpHovered(false)}
            aria-expanded={showHelp}
            aria-label="What is a Utilization Certificate?"
            title="What is a Utilization Certificate?"
            className={`size-4 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              showHelp
                ? "bg-indigo-600 text-white"
                : "bg-slate-200 text-slate-500 hover:bg-indigo-600 hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[11px] leading-none">?</span>
          </button>
        </div>
        {canSubmit && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold hover:bg-indigo-700 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Submit UC
          </button>
        )}
      </div>

      {showHelp && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-indigo-600 text-[18px] mt-0.5 shrink-0">
              verified_user
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-indigo-900">What is a Utilization Certificate (UC)?</p>
              <p className="text-[11px] text-indigo-800/90 mt-1 leading-relaxed">
                A UC is the formal document that proves grant money, government funds or a corporate
                contribution was spent strictly for its intended purpose. Anyone working on this
                project&rsquo;s milestones or tasks can raise one against the work they delivered. It
                is reviewed and signed off by an Admin — or by the head of this project&rsquo;s
                primary department — and only then is it accepted as valid.
              </p>
              <p className="text-[10px] text-indigo-700/80 mt-1.5 font-medium">
                Lifecycle: Draft → Submitted → Under review → Approved or Rejected. Approved
                certificates are locked and cannot be edited or deleted.
              </p>
            </div>
          </div>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryTile label="Total claimed" value={formatRupees(totals.claimed)} />
          <SummaryTile
            label="Total utilized"
            value={formatRupees(totals.utilized)}
            tone={totals.claimed > 0 && totals.utilized > totals.claimed ? "warn" : "ok"}
          />
          <SummaryTile label="Approved" value={String(totals.approved)} tone="ok" />
          <SummaryTile label="Awaiting review" value={String(totals.pending)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-5">
          <span className="material-symbols-outlined text-slate-400 animate-spin">progress_activity</span>
        </div>
      ) : certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-slate-200 rounded-xl">
          <span className="material-symbols-outlined text-slate-300 text-3xl mb-1.5">workspace_premium</span>
          <p className="text-xs font-medium text-slate-500">No utilization certificates yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {canSubmit
              ? "Raise one to prove the funds released to this project were used as intended."
              : "Certificates appear here once a contributor submits one."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {certificates.map((cert) => {
            const status = STATUS_STYLES[cert.status] ?? STATUS_STYLES.Draft;
            // Every action flag comes from the server, which already applied the
            // role permission, the project scope, the workflow status and the
            // "never review your own claim" rule.
            const caps = cert.capabilities;
            const overClaimed = cert.amountUtilized > cert.amountClaimed;

            return (
              <div
                key={cert.id}
                className="rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-slate-800 truncate">{cert.certificateNumber}</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${status.className}`}
                      >
                        <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{cert.fundingSource}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(cert)}
                    disabled={busyId === cert.id}
                    title="Download certificate"
                    className="size-7 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <span className="material-symbols-outlined text-indigo-600 text-[16px]">
                      {busyId === cert.id ? "hourglass_top" : "download"}
                    </span>
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-slate-400 text-[10px]">Claimed</p>
                    <p className="font-semibold text-slate-700">{formatRupees(cert.amountClaimed)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Utilized</p>
                    <p className="font-semibold text-slate-700">{formatRupees(cert.amountUtilized)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Unutilized</p>
                    <p className={`font-semibold ${cert.unutilizedAmount > 0 ? "text-amber-600" : "text-slate-700"}`}>
                      {formatRupees(cert.unutilizedAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-400">
                      Period {formatDate(cert.periodStart)} → {formatDate(cert.periodEnd)}
                    </span>
                    <span className={`font-semibold ${overClaimed ? "text-rose-600" : "text-slate-600"}`}>
                      {cert.utilizationPercentage}% used
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overClaimed ? "bg-rose-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, cert.utilizationPercentage))}%` }}
                    />
                  </div>
                </div>

                {(cert.milestoneTitle || cert.taskTitle) && (
                  <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px] text-slate-400">
                      {cert.milestoneTitle ? "flag" : "task_alt"}
                    </span>
                    <span className="truncate">
                      {cert.milestoneTitle ? `Milestone: ${cert.milestoneTitle}` : `Task: ${cert.taskTitle}`}
                    </span>
                  </p>
                )}

                {cert.purpose && (
                  <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2">{cert.purpose}</p>
                )}

                {cert.reviewNotes && (
                  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Reviewer note
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{cert.reviewNotes}</p>
                  </div>
                )}

                {((caps.canSubmitForReview || caps.canReview || caps.canDelete) || cert.status === "Submitted") && (
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    {caps.canSubmitForReview && (
                      <ActionButton
                        label="Send for review"
                        icon="outbox"
                        disabled={busyId === cert.id}
                        onClick={() => handleSendForReview(cert)}
                        tone="primary"
                      />
                    )}
                    {caps.canReview && (
                      <ActionButton
                        label="Review"
                        icon="fact_check"
                        disabled={busyId === cert.id}
                        onClick={() => {
                          setReviewTarget(cert);
                          setReviewApprove(true);
                          setReviewNotes("");
                        }}
                        tone="primary"
                      />
                    )}
                    {caps.canDelete && (
                      <ActionButton
                        label="Delete"
                        icon="delete"
                        disabled={busyId === cert.id}
                        onClick={() => handleDelete(cert)}
                        tone="danger"
                      />
                    )}
                    {cert.status === "Submitted" && caps.isOwner && !caps.canReview && (
                      <p className="text-[10px] text-slate-400 italic w-full">
                        Awaiting review by an Admin or the head of this project&rsquo;s primary
                        department.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <UcModal onClose={() => setShowForm(false)} widthClassName="max-w-[48rem]">
          <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">workspace_premium</span>
                Submit a Utilization Certificate
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Proves that funds released to this project were spent for their intended purpose. Saved
                as a draft first, then sent to an Admin for sign-off.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#191c1e] uppercase tracking-wider block mb-1">
                  Certificate file<span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-[12px] text-slate-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-[11px] file:font-semibold file:cursor-pointer hover:file:bg-indigo-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  PDF, Word, Excel or image. Max 10 MB.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Certificate number" required>
                  <input
                    value={form.certificateNumber}
                    onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })}
                    placeholder="e.g. UC-2026-0042"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Funding source" required>
                  <input
                    value={form.fundingSource}
                    onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                    placeholder="e.g. Government Grant / Client retainer"
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Amount claimed" required hint="Money sanctioned and released.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountClaimed}
                    onChange={(e) => setForm({ ...form, amountClaimed: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Amount utilized" required hint="Cannot exceed the amount claimed.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountUtilized}
                    onChange={(e) => setForm({ ...form, amountUtilized: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Period start" required>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Period end" required>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Certifies which work?">
                  <select
                    value={form.linkType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        linkType: e.target.value as FormState["linkType"],
                        linkId: "",
                      })
                    }
                    className={fieldClass}
                  >
                    <option value="none">Not linked</option>
                    <option value="milestone" disabled={milestones.length === 0}>
                      A milestone
                    </option>
                    <option value="task" disabled={tasks.length === 0}>
                      A task
                    </option>
                  </select>
                </Field>
                {form.linkType !== "none" && (
                  <Field label="Select" required>
                    <select
                      value={form.linkId}
                      onChange={(e) => setForm({ ...form, linkId: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="">Select…</option>
                      {linkOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Purpose of the spend">
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  rows={3}
                  placeholder="Briefly describe what the funds were used for."
                  className={`${fieldClass} resize-y`}
                />
              </Field>

              <Field label="Document title">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Defaults to the uploaded file name"
                  className={fieldClass}
                />
              </Field>

              {formError && (
                <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save as draft"}
              </button>
            </div>
          </div>
        </UcModal>
      )}

      {reviewTarget && (
        <UcModal onClose={() => setReviewTarget(null)} widthClassName="max-w-[32rem]">
          <div className="bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Review utilization certificate</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {reviewTarget.certificateNumber} · {formatRupees(reviewTarget.amountUtilized)} of{" "}
                {formatRupees(reviewTarget.amountClaimed)} utilized
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReviewApprove(true)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    reviewApprove
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setReviewApprove(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    !reviewApprove
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Reject
                </button>
              </div>
              <Field label={reviewApprove ? "Notes (optional)" : "Reason for rejection"} required={!reviewApprove}>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className={`${fieldClass} resize-y`}
                  placeholder={
                    reviewApprove
                      ? "Anything the record should note."
                      : "Tell the contributor what needs to be fixed."
                  }
                />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReview}
                disabled={busyId === reviewTarget.id}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                  reviewApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {reviewApprove ? "Approve certificate" : "Reject certificate"}
              </button>
            </div>
          </div>
        </UcModal>
      )}
    </div>
  );
}

const fieldClass =
  "w-full p-2.5 rounded-lg border border-[#e0e3e5] text-[13px] outline-none bg-[#fafafa] box-border focus:border-indigo-400";

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-[#191c1e] uppercase tracking-wider block mb-1">
        {label}
        {required && <span className="text-[#ba1a1a]">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-slate-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <p className="text-[10px] text-slate-400 truncate">{label}</p>
      <p className={`text-[12px] font-bold ${toneClass} truncate`}>{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "primary" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-colors disabled:opacity-50 ${toneClass}`}
    >
      <span className="material-symbols-outlined text-[13px]">{icon}</span>
      {label}
    </button>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}