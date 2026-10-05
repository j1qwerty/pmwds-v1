import { FiMessageSquare } from "react-icons/fi";

interface ProgressCommentFormProps {
  progress: number;
  progressComment: string;
  onCommentChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProgressCommentForm({
  progress,
  progressComment,
  onCommentChange,
  onSubmit,
}: ProgressCommentFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200/60 space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <FiMessageSquare className="w-3.5 h-3.5" /> Comment
      </div>
      <textarea
        value={progressComment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Add a comment with this update..."
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-indigo-300 resize-none"
      />
      <button
        type="submit"
        className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
      >
        Update Progress ({progress}%)
      </button>
    </form>
  );
}
