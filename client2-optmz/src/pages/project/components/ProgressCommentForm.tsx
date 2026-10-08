import { FiMessageSquare } from "react-icons/fi";

interface ProgressCommentFormProps {
  progress: number;
  progressComment: string;
  onCommentChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Optional async state — disables the submit button and shows a spinner. */
  loading?: boolean;
}

export function ProgressCommentForm({
  progress,
  progressComment,
  onCommentChange,
  onSubmit,
  loading = false,
}: ProgressCommentFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <FiMessageSquare className="w-3.5 h-3.5" /> Comment
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {progress}%
        </span>
      </div>
      <textarea
        value={progressComment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Add a comment with this update..."
        rows={2}
        className="w-full min-h-[64px] px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
        )}
        {loading ? "Updating..." : `Update progress (${progress}%)`}
      </button>
    </form>
  );
}
