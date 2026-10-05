interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "sky" | "emerald" | "amber" | "rose";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const variants = {
    default: "bg-slate-700/50 text-slate-300",
    sky: "bg-sky-400/10 text-sky-300 border-sky-400/20",
    emerald: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    amber: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    rose: "bg-rose-400/10 text-rose-300 border-rose-400/20",
  };

  return (
    <span className={`inline-flex items-center rounded-md border border-slate-600/30 px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}