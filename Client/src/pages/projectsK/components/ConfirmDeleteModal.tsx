import { useState } from "react";
import { DeleteConfirmationModal, ModalOverlay } from "../../shared";

interface ConfirmDeleteModalProps {
  open: boolean;
  name: string;
  warning?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({ open, name, warning, onConfirm, onClose }: ConfirmDeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;
  return (
    <ModalOverlay onClose={onClose}>
      <DeleteConfirmationModal
        name={name}
        warning={warning}
        submitting={submitting}
        onConfirm={() => { setSubmitting(true); onConfirm(); }}
        onCancel={onClose}
      />
    </ModalOverlay>
  );
}
