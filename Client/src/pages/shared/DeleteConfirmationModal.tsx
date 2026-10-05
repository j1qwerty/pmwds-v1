interface DeleteConfirmationModalProps {
  name: string;
  warning?: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function DeleteConfirmationModal({ name, warning, onConfirm, onCancel, submitting = false }: DeleteConfirmationModalProps) {
  return (
    <div className="bg-white rounded-2xl p-8  w-full shadow-xl border border-slate-200">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-5">
        <span className="material-symbols-outlined text-red-500 text-[28px]">warning</span>
      </div>
      
      <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Deletion</h3>
      <p className="text-sm text-slate-600 mb-4">
        Are you sure you want to permanently delete <strong className="text-slate-900">{name}</strong>? This action cannot be undone.
      </p>
      
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-700 mb-4 flex items-start gap-2">
          <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">info</span>
          {warning}
        </div>
      )}
      
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border-none bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Deleting..." : "Delete Permanently"}
        </button>
      </div>
    </div>
  );
}