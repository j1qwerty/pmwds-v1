import { useState } from "react";
import { Modal, ModalCancelButton, ModalDangerButton } from "./Modal";
import { Icon } from "../../components/ui/Icon";

interface ConfirmDeleteModalProps {
  open: boolean;
  name: string;
  warning?: string;
  /** Optional custom title (defaults to "Confirm deletion") */
  title?: string;
  /** Optional custom body copy (defaults to a message naming `name`) */
  description?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Self-contained delete confirmation dialog (center, small, danger accent).
 *
 * Built directly on the shared `<Modal>`: single white card with the X
 * INSIDE top-right, backdrop click + Esc close, smooth 0.15s/0.12s
 * animations, and a red ModalDangerButton in the footer.
 *
 * Gated by the `open` prop — parents can keep it mounted and toggle it,
 * unlike `DeleteConfirmationModal` which is controlled by mounting.
 */
export function ConfirmDeleteModal({
  open,
  name,
  warning,
  title,
  description,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  const requestClose = () => {
    if (!deleting) onClose();
  };

  return (
    <Modal
      open={true}
      onClose={requestClose}
      title={title ?? "Confirm deletion"}
      description={
        description ??
        `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`
      }
      icon="delete"
      accent="danger"
      size="sm"
      closeOnBackdrop={!deleting}
      footer={
        <>
          <ModalCancelButton onClick={requestClose} />
          <ModalDangerButton
            onClick={handleConfirm}
            loading={deleting}
            label="Delete permanently"
          />
        </>
      }
    >
      {warning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <Icon name="info" size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">{warning}</p>
        </div>
      )}
    </Modal>
  );
}
