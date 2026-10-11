import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function GradientButton({ variant = "primary", className = "", children, ...props }: GradientButtonProps) {
  const base = "px-5 py-2.5 text-[13px] font-semibold rounded-xl border cursor-pointer inline-flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/25",
    ghost: "bg-transparent text-indigo-600 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400",
    danger: "bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}