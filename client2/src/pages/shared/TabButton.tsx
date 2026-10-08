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
      onClick={onClick}
      className={`
        px-5 py-3 rounded-t-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 relative
        ${active
          ? "bg-white text-indigo-600 border border-slate-200 border-b-white -mb-px shadow-sm"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-transparent"
        }
      `}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      {label}
      {count !== undefined && (
        <span className={`
          px-2 py-0.5 rounded-full text-xs font-bold
          ${countColor === "amber"
            ? "bg-amber-100 text-amber-700"
            : active
              ? "bg-indigo-100 text-indigo-600"
              : "bg-slate-100 text-slate-500"
          }
        `}>
          {count}
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-500" />
      )}
    </button>
  );
}
