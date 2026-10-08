import { useEffect, type ReactNode } from "react";

interface ModalOverlayProps {
  children: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  contentClassName?: string;
  widthClassName?: string;
}

export function ModalOverlay({
  children,
  onClose,
  showCloseButton = true,
  closeOnBackdrop = true,
  contentClassName = "",
  widthClassName = "max-w-2xl",
}: ModalOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/35 backdrop-blur-md z-1000 animate-[fadeIn_0.2s_ease] overflow-y-auto overscroll-contain"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full ${widthClassName} animate-[slideUp_0.3s_ease] flex justify-center`}
        >
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
          <div className={`w-full ${contentClassName}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
