interface SelectFProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectF({ label, value, onChange, options }: SelectFProps) {
  return (
    <div>
      <label className="text-[11px] font-bold text-[#191c1e] uppercase tracking-wider block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 rounded-lg border border-[#e0e3e5] text-[13px] outline-none bg-[#fafafa] box-border"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}