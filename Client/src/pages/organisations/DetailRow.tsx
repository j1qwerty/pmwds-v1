interface DetailRowProps {
  label: string;
  value: string | number;
  icon?: string;
}

export function DetailRow({ label, value, icon }: DetailRowProps) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-700/30 py-3 last:border-b-0">
      {icon && (
        <span className="material-symbols-outlined text-base text-slate-500 shrink-0">{icon}</span>
      )}
      <span className="text-xs font-medium text-slate-400 min-w-[100px]">{label}</span>
      <span className="text-sm font-medium text-slate-200 truncate">{value || "—"}</span>
    </div>
  );
}