import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { Icon } from "../../components/ui/Icon";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_MAP: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  hideHeaderBorder?: boolean;
  footer?: ReactNode;
  /** Optional icon name (Material Symbols) rendered before the title */
  icon?: string;
  /** Optional accent color for the icon — "primary" | "warning" | "danger" | "success" | "info" | "neutral" */
  accent?: "primary" | "warning" | "danger" | "success" | "info" | "neutral";
  /** If true, content area scrolls (used for tall forms). Default true. */
  scrollable?: boolean;
}

const ACCENT_MAP: Record<NonNullable<ModalProps["accent"]>, string> = {
  primary: "bg-indigo-50 text-indigo-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-sky-50 text-sky-600",
  neutral: "bg-slate-100 text-slate-600",
};

/**
 * Snappy, modern modal. Replaces the old ModalOverlay for new UIs.
 *
 * - Faster entrance/exit (0.15s/0.10s) than the old 0.2s/0.3s
 * - Built-in header with optional icon + accent
 * - Optional footer slot for action buttons (keeps them visible while content scrolls)
 * - Cleaner backdrop (no double blur), tighter padding
 *
 * Usage:
 *   <Modal open={open} onClose={close} title="New User" icon="person_add" accent="primary" size="md" footer={<><CancelButton/><SaveButton/></>}>
 *     ...form fields...
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  size = "md",
  showCloseButton = true,
  closeOnBackdrop = true,
  hideHeaderBorder = false,
  footer,
  icon,
  accent = "primary",
  scrollable = true,
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Sync open state with internal visibility for exit animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while mounted
  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exiting) onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, exiting, onClose]);

  if (!visible) return null;

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 ${
        exiting ? "modal-backdrop-exit" : "modal-backdrop-enter"
      }`}
      style={{
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full ${SIZE_MAP[size]} ${
          exiting ? "modal-content-exit" : "modal-content-enter"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 overflow-hidden max-h-[90vh] flex flex-col">
          {(title || showCloseButton) && (
            <div
              className={`flex items-start gap-3 px-5 py-4 ${
                hideHeaderBorder ? "" : "border-b border-slate-100"
              }`}
            >
              {icon && (
                <div
                  className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${ACCENT_MAP[accent]}`}
                >
                  <Icon name={icon} size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-base font-bold text-slate-800 leading-tight">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          )}

          <div
            className={`flex-1 ${
              scrollable ? "overflow-y-auto" : ""
            } px-5 py-4`}
          >
            {children}
          </div>

          {footer && (
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Default cancel button used in modal footers */
export function ModalCancelButton({
  onClick,
  label = "Cancel",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
    >
      {label}
    </button>
  );
}

/** Default primary action button used in modal footers */
export function ModalPrimaryButton({
  onClick,
  label = "Save",
  loading = false,
  disabled = false,
  icon,
}: {
  onClick?: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Saving...
        </>
      ) : (
        <>
          {icon && <Icon name={icon} size={14} />}
          {label}
        </>
      )}
    </button>
  );
}

/** Danger action button used in modal footers (e.g. delete confirmations) */
export function ModalDangerButton({
  onClick,
  label = "Delete",
  loading = false,
  disabled = false,
}: {
  onClick?: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Deleting...
        </>
      ) : (
        label
      )}
    </button>
  );
}
