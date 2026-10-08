import type { ReactNode } from "react";
import { Modal, type ModalSize, type ModalSizeProp } from "./Modal";

interface ModalOverlayProps {
  children: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  contentClassName?: string;
  /** Tailwind max-width class, e.g. "max-w-2xl" (default) or "max-w-4xl" */
  widthClassName?: string;
  /** Skip the white card chrome (see Modal `bare`). Content owns its own background + close. */
  bare?: boolean;
}

/**
 * Named sizes that map 1:1 onto Modal's size prop. Any other `max-w-*`
 * string is forwarded to Modal as a raw width class.
 */
const WIDTH_TO_SIZE: Record<string, ModalSize> = {
  "max-w-md": "sm",
  "max-w-lg": "md",
  "max-w-2xl": "lg",
  "max-w-4xl": "xl",
  "max-w-6xl": "2xl",
};

/**
 * Backward-compatible overlay wrapper, now implemented ON TOP of the shared
 * `<Modal>` so every existing caller gets the modern style for free:
 *
 * - NO separate "bg parent" element and NO floating X outside the card —
 *   a single white card with the close button INSIDE, top-right
 * - backdrop click + Esc close, smooth 0.15s enter / 0.12s exit
 * - rendered through a portal on document.body (no clipping / squeezed
 *   width from transformed or blurred ancestors)
 *
 * Props are unchanged from the legacy implementation.
 */
export function ModalOverlay({
  children,
  onClose,
  showCloseButton = true,
  closeOnBackdrop = true,
  contentClassName = "",
  widthClassName = "max-w-2xl",
  bare = false,
}: ModalOverlayProps) {
  const key = widthClassName.trim();
  const size: ModalSizeProp = WIDTH_TO_SIZE[key] ?? key;

  return (
    <Modal
      open={true}
      onClose={onClose}
      showCloseButton={showCloseButton}
      closeOnBackdrop={closeOnBackdrop}
      size={size}
      contentClassName={contentClassName}
      bare={bare}
    >
      {children}
    </Modal>
  );
}
