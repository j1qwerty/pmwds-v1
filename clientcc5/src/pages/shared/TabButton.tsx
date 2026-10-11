export function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  countColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
  countColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 items-center gap-2 px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-t-lg ${
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      <span className={`material-symbols-outlined text-[17px] leading-none ${active ? "text-indigo-600" : "text-slate-400"}`}>{icon}</span>
      {label}
      {count !== undefined && (
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
            countColor === "amber" ? "bg-amber-100 text-amber-700" : active ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600" />}
    </button>
  );
}
