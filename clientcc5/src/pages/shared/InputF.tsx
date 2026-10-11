import { useId } from "react";

interface InputFProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}

export function InputF({ label, value, onChange, type = "text", required = false, disabled = false }: InputFProps) {
  // The label is associated with the input by id, and the required asterisk is kept
  // *outside* the label element.
  //
  // Two reasons, both of which broke real consumers:
  //
  // 1. Without htmlFor/id the control has no accessible name, so a screen reader
  //    announces a bare text box and clicking the label does not focus the field.
  // 2. With the asterisk inside the label the label text becomes "Name*", so the
  //    accessible name is polluted and anything resolving the field by an exact
  //    label match fails. A required marker is decorative; the "required" state is
  //    already conveyed by the input's own required attribute.
  const id = useId();

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <label htmlFor={id} className="text-[11px] font-bold text-[#191c1e] uppercase tracking-wider">
          {label}
        </label>
        {required && (
          <span aria-hidden="true" className="text-[11px] font-bold text-[#ba1a1a]">
            *
          </span>
        )}
      </div>
      <input
        id={id}
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