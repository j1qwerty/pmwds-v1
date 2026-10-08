interface SubtaskProgressBarProps {
  value: number;
  onChange: (val: number) => void;
}

export function SubtaskProgressBar({ value, onChange }: SubtaskProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-8">{value}%</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none bg-slate-200 cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow"
      />
    </div>
  );
}
