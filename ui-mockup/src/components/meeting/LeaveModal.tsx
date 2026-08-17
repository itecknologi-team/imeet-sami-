interface LeaveModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function LeaveModal({ onCancel, onConfirm }: LeaveModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-text">Leave meeting?</h2>
        <p className="mt-2 text-sm text-muted">You can rejoin this meeting anytime using the same link.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-[10px] border border-border px-4 py-2 text-sm font-medium text-text hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="focus-ring rounded-[10px] bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
