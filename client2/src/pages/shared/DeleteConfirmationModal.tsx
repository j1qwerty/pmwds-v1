import { useState } from "react";
import { Modal, ModalCancelButton, ModalDangerButton } from "./Modal";
import { Icon } from "../../components/ui/Icon";

interface DeleteConfirmationModalProps {
  name: string;
  warning?: string;
  /** Optional custom title (defaults to "Confirm deletion") */
  title?: string;
  /** Optional custom body copy (defaults to a message naming `name`) */
  description?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Self-contained delete confirmation modal.
 *
 * Renders its own `<Modal>` (always open when mounted — the parent controls
 * mounting via conditional rendering). Callers that previously wrapped this
 * component in `<ModalOverlay>` no longer need to do so.
 */
export function DeleteConfirmationModal({ name, warning, title, description, onConfirm, onCancel }: DeleteConfirmationModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={title ?? "Confirm deletion"}
      description={description ?? `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`}
      icon="delete"
      accent="danger"
      size="sm"
      footer={
        <>
          <ModalCancelButton onClick={onCancel} />
          <ModalDangerButton onClick={handleConfirm} loading={deleting} label="Delete permanently" />
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
