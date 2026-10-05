import type { ReactNode } from "react";

interface InfoChipProps {
  icon: ReactNode;
  label: string;
  value: string;
}

export function InfoChip({ icon, label, value }: InfoChipProps) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs cursor-default">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700 truncate max-w-[120px]">{value}</span>
    </div>
  );
}
