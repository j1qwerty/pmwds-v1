interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: string;
}

export function StatCard({ label, value, sublabel, icon }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
          {sublabel && (
            <p className="mt-0.5 text-xs text-slate-500">{sublabel}</p>
          )}
        </div>
        {icon && (
          <span className="material-symbols-outlined text-xl text-slate-500">{icon}</span>
        )}
      </div>
    </div>
  );
}