interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({ value, max = 100, label, showPercent = true }: ProgressBarProps) {
  const percent = Math.min((value / max) * 100, 100);
  
  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="mb-1 flex justify-between text-xs">
          {label && <span className="text-slate-400">{label}</span>}
          {showPercent && <span className="font-medium text-slate-300">{Math.round(percent)}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}