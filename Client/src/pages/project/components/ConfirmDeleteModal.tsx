import { DeleteConfirmationModal } from "../../shared/index";

interface ConfirmDeleteModalProps {
  open: boolean;
  name: string;
  warning?: string;
  /** Optional custom title forwarded to the shared modal */
  title?: string;
  /** Optional custom body copy forwarded to the shared modal */
  description?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Thin wrapper around the shared `DeleteConfirmationModal` for the project pages.
 *
 * `DeleteConfirmationModal` is self-contained (renders its own `<Modal>` with
 * icon="delete" / accent="danger"), so this component just conditionally mounts
 * it — no `ModalOverlay` wrapper needed.
 */
export function ConfirmDeleteModal({ open, name, warning, title, description, onConfirm, onClose }: ConfirmDeleteModalProps) {
  if (!open) return null;
  return (
    <DeleteConfirmationModal
      name={name}
      warning={warning}
      title={title}
      description={description}
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
