import { DeleteConfirmationModal } from "../../shared/index";

interface ConfirmDeleteModalProps {
  open: boolean;
  name: string;
  warning?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Thin wrapper around the shared `DeleteConfirmationModal` for the project pages.
 *
 * `DeleteConfirmationModal` is now self-contained (renders its own `<Modal>`), so this
 * component just conditionally mounts it — no `ModalOverlay` wrapper needed.
 */
export function ConfirmDeleteModal({ open, name, warning, onConfirm, onClose }: ConfirmDeleteModalProps) {
  if (!open) return null;
  return (
    <DeleteConfirmationModal
      name={name}
      warning={warning}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
