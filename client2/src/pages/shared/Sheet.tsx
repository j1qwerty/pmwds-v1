import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/ui/Icon";

type SheetSize = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<SheetSize, string> = {
  // NOTE: do NOT use max-w-sm/md/lg/xl here. This project's @theme defines
  // --spacing-{sm,md,lg,xl}, so Tailwind v4 resolves those max-w names against
  // the spacing scale (e.g. max-w-xl -> 2.5rem) instead of the container scale,
  // which squeezes the panel into a narrow sliver off-screen. Explicit rem
  // values match the classic container widths (md 28rem, xl 36rem).
  sm: "max-w-[28rem]",
  md: "max-w-[36rem]",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  size?: SheetSize;
  /** Optional icon rendered in a soft accent tile before the title */
  icon?: string;
  accent?: "primary" | "warning" | "danger" | "success" | "info" | "neutral";
  footer?: ReactNode;
  showCloseButton?: boolean;
}

const ACCENT_MAP: Record<NonNullable<SheetProps["accent"]>, string> = {
  primary: "bg-indigo-50 text-indigo-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-sky-50 text-sky-600",
  neutral: "bg-slate-100 text-slate-600",
};

/**
 * Right-hand slide-in panel (a "drawer" / "side sheet").
 *
 * Use for:
 *  - detail views (record summary without leaving the page)
 *  - contextual editing (edit forms with the list still visible behind)
 *  - filters and secondary workflows
 *
 * Faster and lighter than a centered modal: content slides from the right,
 * the page behind stays visible through a soft scrim.
 *
 * Rendered through a portal on document.body, so no ancestor transform,
 * animation or blur can shrink the panel — children ALWAYS get the full
 * sheet width (the content area is flex-1 w-full min-w-0).
 *
 * Usage:
 *   <Sheet open={open} onClose={close} title="Edit user" icon="person_edit" accent="primary"
 *          size="md" footer={<><ModalCancelButton …/><ModalPrimaryButton …/></>}>
 *     ...form fields...
 *   </Sheet>
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  description,
  size = "md",
  icon,
  accent = "primary",
  footer,
  showCloseButton = true,
}: SheetProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
    } else if (visible) {
      setExiting(true);
      const t = setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleScrimClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] flex justify-end ${exiting ? "sheet-scrim-exit" : "sheet-scrim-enter"}`}
      style={{
        background: "rgba(15, 23, 42, 0.35)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onClick={handleScrimClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full ${SIZE_MAP[size]} h-full flex flex-col bg-white shadow-2xl shadow-slate-900/20 border-l border-slate-200/80 ${
          exiting ? "sheet-panel-exit" : "sheet-panel-enter"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
            {icon && (
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${ACCENT_MAP[accent]}`}>
                <Icon name={icon} size={18} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-base font-bold text-slate-800 leading-tight">{title}</h3>
              )}
              {description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content always spans the full panel width — never a narrow column */}
        <div className="flex-1 w-full min-w-0 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
