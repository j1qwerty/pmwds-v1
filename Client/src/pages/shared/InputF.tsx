interface InputFProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}

export function InputF({ label, value, onChange, type = "text", required = false, disabled = false }: InputFProps) {
  return (
    <div>
      <label className="text-[11px] font-bold text-[#191c1e] uppercase tracking-wider block mb-1">
        {label}{required && <span className="text-[#ba1a1a]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full p-2.5 rounded-lg border border-[#e0e3e5] text-[13px] outline-none bg-[#fafafa] box-border"
      />
    </div>
  );
}
